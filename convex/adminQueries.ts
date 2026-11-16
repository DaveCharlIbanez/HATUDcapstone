import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { DOCUMENT_KINDS } from "./documents";
import { approvalStatusOf } from "./lib/approval";
import type { PaymentMethod } from "./lib/paymentMethods";
import { requireRole } from "./lib/withAuth";
import { ONLINE_WINDOW_MS } from "./presence";

/**
 * The admin dashboard.
 *
 * One query returns a single snapshot: the headline counts and the lists
 * underneath them can never disagree, because they are read in the same
 * transaction. Every list is bounded — the panel must never read an
 * unbounded collection.
 */

/** How many rows of each list the panel shows. */
const LIST_LIMIT = 25;

export interface AdminDriverRow {
  _id: Id<"operators">;
  approvalStatus: "approved" | "pending" | "rejected";
  averageRating: number;
  createdAt: number;
  currentLocation: { latitude: number; longitude: number } | null;
  documentCount: number;
  documentKinds: string[];
  email: string;
  isAvailable: boolean;
  /**
   * On shift and the app was seen within `ONLINE_WINDOW_MS` (fixoct51).
   * `isAvailable` alone is the shift switch, which stays on when the app is
   * closed.
   */
  isOnline: boolean;
  /** When the driver's app last sent a heartbeat, or null if never. */
  lastSeenAt: number | null;
  licenseNumber: string;
  missingDocuments: string[];
  name: string;
  phone: string;
  ratingCount: number;
  rejectionNote: string | null;
  vehicleInfo: { color: string; model: string; plateNumber: string };
}

export interface AdminRideRow {
  _id: Id<"rides">;
  commuterName: string;
  createdAt: number;
  driverName: string | null;
  dropoffAddress: string;
  fare: number;
  pickupAddress: string;
  status: string;
}

export interface AdminLiveRideRow extends AdminRideRow {
  commuterLocation: { latitude: number; longitude: number } | null;
  dropoff: { latitude: number; longitude: number };
  operatorLocation: { latitude: number; longitude: number } | null;
  pickup: { latitude: number; longitude: number };
}

export interface AdminRiderRow {
  _id: Id<"commuters">;
  createdAt: number;
  email: string;
  name: string;
  phone: string;
  rides: number;
  spent: number;
}

export interface AdminPaymentRow {
  _id: Id<"payments">;
  amount: number;
  createdAt: number;
  /** Where the money moved, so the revenue can be read by method. */
  provider: PaymentMethod;
  referenceNumber: string;
  riderName: string;
}

export interface AdminFeedbackRow {
  _id: Id<"feedback">;
  comment: string | null;
  createdAt: number;
  driverName: string;
  rating: number;
  riderName: string;
}

/** How many users of each type the roster lists. */
const ROSTER_LIMIT = 500;

/** A commuter or operator account, with whether its app is open (fixoct51). */
export interface AdminUserRow {
  email: string;
  /** Operators only: whether the shift switch is on. */
  isAvailable?: boolean;
  /** The app sent a heartbeat within `ONLINE_WINDOW_MS`. */
  isOnline: boolean;
  /** The last heartbeat, or null if the app has never sent one. */
  lastSeenAt: number | null;
  name: string;
  role: "commuter" | "operator";
  userId: Id<"users">;
}

export interface AdminCancellationRow {
  cancelled: number;
  completed: number;
}

export interface AdminDashboard {
  cancellations: {
    averageWaitMs: number | null;
    byVehicleType: AdminCancellationRow[];
    cancelled: number;
    completed: number;
    rate: number;
  };
  drivers: AdminDriverRow[];
  feedback: AdminFeedbackRow[];
  liveRides: AdminLiveRideRow[];
  metrics: {
    activeDrivers: number;
    /** Commuters and operators with the app open right now. */
    activeUsers: number;
    averageRating: number;
    approvedDrivers: number;
    cancelledTrips: number;
    completedTrips: number;
    liveTrips: number;
    pendingDrivers: number;
    pendingTrips: number;
    ratingCount: number;
    rejectedDrivers: number;
    revenue: number;
    riders: number;
    /** Every commuter and operator account. Admins are not counted. */
    totalUsers: number;
  };
  payments: AdminPaymentRow[];
  recentRides: AdminRideRow[];
  riders: AdminRiderRow[];
  /**
   * Every commuter and every operator, online first, then by last seen. The
   * admin filters it to the active users or shows the whole list.
   */
  userRoster: {
    commuters: AdminUserRow[];
    operators: AdminUserRow[];
  };
}

export const getDashboard = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

    // Counts are exact: the whole table is read for the number. A ride
    // table that grows past a few hundred thousand rows should move these
    // totals onto a denormalised counter, but the admin panel needs the real
    // figure, not a capped one.
    const operators = await ctx.db.query("operators").collect();
    const commuters = await ctx.db.query("commuters").collect();
    const rides = await ctx.db.query("rides").collect();
    const payments = await ctx.db.query("payments").collect();
    const feedback = await ctx.db.query("feedback").collect();

    // Who has the app open (fixoct51). There is one presence row per user,
    // so the table is no larger than the user table read above.
    const now = Date.now();
    const presence = await ctx.db.query("presence").collect();
    const lastSeenByUser = new Map<Id<"users">, number>(
      presence.map((row) => [row.userId, row.lastSeenAt])
    );
    const seenAtByUser = new Map<Id<"users">, number>(
      presence
        .filter((row) => now - row.lastSeenAt < ONLINE_WINDOW_MS)
        .map((row) => [row.userId, row.lastSeenAt])
    );
    const isOnline = (operator: (typeof operators)[number]) =>
      operator.isAvailable && seenAtByUser.has(operator.userId);

    // Ratings, per driver.
    const ratingsByOperator = new Map<Id<"operators">, number[]>();
    for (const entry of feedback) {
      const list = ratingsByOperator.get(entry.operatorId) ?? [];
      list.push(entry.rating);
      ratingsByOperator.set(entry.operatorId, list);
    }

    // Which credential documents each driver has uploaded.
    const documentRows = await ctx.db.query("operatorDocuments").collect();
    const kindsByOperator = new Map<Id<"operators">, string[]>();
    for (const document of documentRows) {
      const list = kindsByOperator.get(document.operatorId) ?? [];
      list.push(document.kind);
      kindsByOperator.set(document.operatorId, list);
    }

    const drivers: AdminDriverRow[] = operators
      .slice(0, LIST_LIMIT)
      .map((operator) => {
        const ratings = ratingsByOperator.get(operator._id) ?? [];
        const total = ratings.reduce((sum, rating) => sum + rating, 0);
        const documentKinds = kindsByOperator.get(operator._id) ?? [];
        return {
          _id: operator._id,
          approvalStatus: approvalStatusOf(operator),
          averageRating:
            ratings.length === 0
              ? 0
              : Math.round((total / ratings.length) * 10) / 10,
          createdAt: operator.createdAt,
          currentLocation: operator.currentLocation ?? null,
          documentCount: documentKinds.length,
          documentKinds,
          email: operator.email,
          isAvailable: operator.isAvailable,
          isOnline: isOnline(operator),
          lastSeenAt: lastSeenByUser.get(operator.userId) ?? null,
          licenseNumber: operator.licenseNumber,
          missingDocuments: DOCUMENT_KINDS.filter(
            (kind) => !documentKinds.includes(kind)
          ),
          name: operator.name,
          phone: operator.phone,
          ratingCount: ratings.length,
          rejectionNote: operator.rejectionNote ?? null,
          vehicleInfo: operator.vehicleInfo,
        };
      });

    const commuterNameById = new Map<Id<"commuters">, string>(
      commuters.map((commuter) => [commuter._id, commuter.name])
    );
    const driverNameById = new Map<Id<"operators">, string>(
      operators.map((operator) => [operator._id, operator.name])
    );

    const liveRides: AdminLiveRideRow[] = rides
      .filter(
        (ride) => ride.status === "accepted" || ride.status === "inProgress"
      )
      .slice(0, LIST_LIMIT)
      .map((ride) => ({
        _id: ride._id,
        commuterLocation: ride.commuterLocation ?? null,
        commuterName: commuterNameById.get(ride.commuterId) ?? "Passenger",
        createdAt: ride.createdAt,
        dropoff: ride.dropoff,
        dropoffAddress: ride.dropoff.address,
        driverName: ride.operatorId
          ? (driverNameById.get(ride.operatorId) ?? "Driver")
          : null,
        fare: ride.fare,
        operatorLocation: ride.operatorLocation ?? null,
        pickup: ride.pickup,
        pickupAddress: ride.pickup.address,
        status: ride.status,
      }));

    const recentRides: AdminRideRow[] = rides
      .filter((ride) => ride.status === "completed")
      .slice(0, LIST_LIMIT)
      .map((ride) => ({
        _id: ride._id,
        commuterName: commuterNameById.get(ride.commuterId) ?? "Passenger",
        createdAt: ride.createdAt,
        dropoffAddress: ride.dropoff.address,
        driverName: ride.operatorId
          ? (driverNameById.get(ride.operatorId) ?? "Driver")
          : null,
        fare: ride.fare,
        pickupAddress: ride.pickup.address,
        status: ride.status,
      }));

    // Rider totals: how many trips each commuter has taken and what they
    // have paid.
    const ridesByCommuter = new Map<Id<"commuters">, number>();
    for (const ride of rides) {
      ridesByCommuter.set(
        ride.commuterId,
        (ridesByCommuter.get(ride.commuterId) ?? 0) + 1
      );
    }
    const spentByCommuter = new Map<Id<"commuters">, number>();
    for (const payment of payments) {
      if (payment.status === "SETTLED") {
        spentByCommuter.set(
          payment.commuterId,
          (spentByCommuter.get(payment.commuterId) ?? 0) + payment.amount
        );
      }
    }

    const riders: AdminRiderRow[] = commuters
      .slice(0, LIST_LIMIT)
      .map((commuter) => ({
        _id: commuter._id,
        createdAt: commuter.createdAt,
        email: commuter.email,
        name: commuter.name,
        phone: commuter.phone,
        rides: ridesByCommuter.get(commuter._id) ?? 0,
        spent: spentByCommuter.get(commuter._id) ?? 0,
      }));

    const settledPayments = payments.filter(
      (payment) => payment.status === "SETTLED"
    );

    const paymentRows: AdminPaymentRow[] = settledPayments
      .slice(0, LIST_LIMIT)
      .map((payment) => ({
        _id: payment._id,
        amount: payment.amount,
        createdAt: payment.createdAt,
        provider: payment.provider,
        referenceNumber: payment.referenceNumber,
        riderName: commuterNameById.get(payment.commuterId) ?? "Passenger",
      }));

    const feedbackRows: AdminFeedbackRow[] = [...feedback]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, LIST_LIMIT)
      .map((entry) => ({
        _id: entry._id,
        comment: entry.comment ?? null,
        createdAt: entry.createdAt,
        driverName: driverNameById.get(entry.operatorId) ?? "Driver",
        rating: entry.rating,
        riderName: commuterNameById.get(entry.commuterId) ?? "Passenger",
      }));

    // Cancellations: how often a request is dropped, and how long the rider
    // waited before giving up. Only rides cancelled after `cancelledAt` was
    // recorded carry a usable wait time.
    const cancelledRides = rides.filter((ride) => ride.status === "cancelled");
    const completedCount = rides.filter(
      (ride) => ride.status === "completed"
    ).length;
    const waitTimes = cancelledRides
      .filter((ride) => ride.cancelledAt !== undefined)
      .map((ride) => (ride.cancelledAt as number) - ride.createdAt);
    const averageWaitMs =
      waitTimes.length === 0
        ? null
        : waitTimes.reduce((sum, wait) => sum + wait, 0) / waitTimes.length;

    // There is one ride type, so the cancellations are not broken down by
    // anything: they are a share of the rides that were taken.
    const byVehicleType: AdminCancellationRow[] = [
      {
        cancelled: cancelledRides.length,
        completed: rides.filter((ride) => ride.status === "completed").length,
      },
    ];

    const totalRatings = feedback.reduce((sum, entry) => sum + entry.rating, 0);
    // On shift is not enough: the app has to be open too (fixoct51).
    const activeDrivers = operators.filter(isOnline).length;

    const toRow = (
      person: { email: string; name: string; userId: Id<"users"> },
      role: AdminUserRow["role"]
    ): AdminUserRow => ({
      email: person.email,
      isOnline: seenAtByUser.has(person.userId),
      lastSeenAt: lastSeenByUser.get(person.userId) ?? null,
      name: person.name,
      role,
      userId: person.userId,
    });
    // Online first, then the most recently seen, then the never seen by name.
    const byPresence = (a: AdminUserRow, b: AdminUserRow) =>
      Number(b.isOnline) - Number(a.isOnline) ||
      (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0) ||
      a.name.localeCompare(b.name);
    const commuterRows = commuters
      .map((commuter) => toRow(commuter, "commuter"))
      .sort(byPresence);
    const operatorRows = operators
      .map((operator) => ({
        ...toRow(operator, "operator"),
        isAvailable: operator.isAvailable,
      }))
      .sort(byPresence);
    const activeUserCount =
      commuterRows.filter((row) => row.isOnline).length +
      operatorRows.filter((row) => row.isOnline).length;
    const approvedDrivers = operators.filter(
      (operator) => approvalStatusOf(operator) === "approved"
    ).length;
    const pendingDrivers = operators.filter(
      (operator) => approvalStatusOf(operator) === "pending"
    ).length;
    const rejectedDrivers = operators.filter(
      (operator) => approvalStatusOf(operator) === "rejected"
    ).length;

    return {
      cancellations: {
        averageWaitMs,
        byVehicleType,
        cancelled: cancelledRides.length,
        completed: completedCount,
        rate:
          cancelledRides.length + completedCount === 0
            ? 0
            : cancelledRides.length / (cancelledRides.length + completedCount),
      },
      drivers,
      feedback: feedbackRows,
      liveRides,
      metrics: {
        activeDrivers,
        activeUsers: activeUserCount,
        averageRating:
          feedback.length === 0
            ? 0
            : Math.round((totalRatings / feedback.length) * 10) / 10,
        approvedDrivers,
        cancelledTrips: cancelledRides.length,
        completedTrips: completedCount,
        liveTrips: liveRides.length,
        pendingDrivers,
        pendingTrips: rides.filter((ride) => ride.status === "pending").length,
        ratingCount: feedback.length,
        rejectedDrivers,
        revenue: settledPayments.reduce(
          (total, payment) => total + payment.amount,
          0
        ),
        riders: commuters.length,
        totalUsers: commuters.length + operators.length,
      },
      payments: paymentRows,
      recentRides,
      riders,
      userRoster: {
        commuters: commuterRows.slice(0, ROSTER_LIMIT),
        operators: operatorRows.slice(0, ROSTER_LIMIT),
      },
    };
  },
});
