import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    phone: v.string(),
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    // When the terms and conditions were accepted, and which version. The
    // fields are optional so the accounts that predate the terms do not need
    // a backfill.
    acceptedTermsAt: v.optional(v.number()),
    acceptedTermsVersion: v.optional(v.string()),
    // When the address was verified with a one-time code. Optional, for the
    // same reason: the accounts that predate the code are not re-verified.
    emailVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_role", ["role"]),

  commuters: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    savedLocations: v.array(
      v.object({
        name: v.string(),
        address: v.string(),
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  operators: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    licenseNumber: v.string(),
    vehicleInfo: v.object({
      plateNumber: v.string(),
      model: v.string(),
      color: v.string(),
    }),
    isAvailable: v.boolean(),
    // Optional so the field can be added without a backfill: an operator
    // without a value predates the approval flow and counts as approved.
    approvalStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
    // Why the last application was refused, shown to the driver so they can
    // fix it and resubmit.
    rejectionNote: v.optional(v.string()),
    currentLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_license", ["licenseNumber"])
    .index("by_isAvailable", ["isAvailable"]),

  // The credential documents a driver uploads for review. One row per
  // document kind, so a replacement never rewrites the operator record.
  operatorDocuments: defineTable({
    operatorId: v.id("operators"),
    kind: v.union(
      v.literal("license"),
      v.literal("registration"),
      v.literal("officialReceipt"),
      v.literal("insurance")
    ),
    storageId: v.string(),
    contentType: v.string(),
    size: v.number(),
    fileName: v.optional(v.string()),
    uploadedAt: v.number(),
    replacedCount: v.optional(v.number()),
  })
    .index("by_operatorId", ["operatorId"])
    .index("by_operatorId_and_kind", ["operatorId", "kind"]),

  admins: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    permissions: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  rides: defineTable({
    commuterId: v.id("commuters"),
    operatorId: v.optional(v.id("operators")),
    pickup: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    dropoff: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    // The ride type. There is one: every ride is a Standard ride.
    //
    // It was wider once — there were Priority rides and motorcycle classes
    // that were never offered — and the rows that named them were rewritten
    // by `internal.repair.vehicleType` before this was narrowed.
    vehicleType: v.optional(v.literal("standard")),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    fare: v.number(),
    distance: v.number(),
    // When the request was dropped. `updatedAt` cannot be used for this: it
    // is bumped by every unrelated patch on the ride.
    cancelledAt: v.optional(v.number()),
    // When the trip ended. It is what tells a trip the passenger has just
    // finished apart from one they finished days ago.
    completedAt: v.optional(v.number()),
    // When the passenger chose not to rate the trip. Rating is optional, and
    // once it has been skipped the prompt is not shown again.
    ratingDismissedAt: v.optional(v.number()),
    // When the passenger confirmed the driver and the trip began. The driver
    // needs this to know the passenger is ready; without it the confirmation
    // was a purely local animation that never reached the server.
    confirmedAt: v.optional(v.number()),
    // When a driver accepted the ride. It starts the passenger's one-minute
    // window to cancel (fixoct46). Absent on rides accepted before it existed.
    acceptedAt: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(
        v.literal("unpaid"),
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed")
      )
    ),
    // The method the rider chose when the ride was booked.
    //
    // It is the rider's intent, and it is fixed for the life of the ride: the
    // driver has to know before they accept whether they are collecting cash.
    // It is optional because the rides that predate the choice do not have
    // one; those are read as GCash, which is what they were settled through.
    paymentMethod: v.optional(
      v.union(v.literal("gcash"), v.literal("maya"), v.literal("cash"))
    ),
    // When the driver confirmed, in so many words, that they had the fare in
    // hand for a cash ride. It is absent when the ride was closed by a build
    // that does not know the confirmation exists, which an operator may want
    // to follow up.
    cashCollectedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    operatorLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        updatedAt: v.number(),
      })
    ),
    commuterLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        updatedAt: v.number(),
      })
    ),
    // The rider booked a demo trip: the vehicle is driven along the road by
    // the server instead of following GPS. Missing means a live trip — which
    // is what every build that predates the choice books.
    demoMode: v.optional(v.boolean()),
    // When the simulated trip reached the destination. On a demo trip the
    // driver cannot end the ride before this is set. See
    // `convex/rideSimulation.ts`.
    arrivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_commuterId", ["commuterId"])
    .index("by_operatorId", ["operatorId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  // The road a started trip is driven along, from the pickup to the
  // destination. Written once when the trip starts and never changed, so the
  // screens download it once. Kept apart from the moving position below so
  // the large line is not rewritten every few seconds.
  rideRoutes: defineTable({
    rideId: v.id("rides"),
    /** The road, as `[longitude, latitude]` points. */
    coordinates: v.array(v.array(v.number())),
    /** How far along the road each point is, in metres. */
    cumulativeMeters: v.array(v.number()),
    totalMeters: v.number(),
    /** Where the road came from: the router, or a straight-line fallback. */
    source: v.union(v.literal("router"), v.literal("estimate")),
    createdAt: v.number(),
  }).index("by_rideId", ["rideId"]),

  // Where the simulated vehicle is on a started trip. The server moves it
  // every three seconds; it is the only thing that changes during the trip.
  rideSimulations: defineTable({
    rideId: v.id("rides"),
    /** The road has been fetched and the vehicle is moving. */
    ready: v.boolean(),
    traveledMeters: v.number(),
    totalMeters: v.number(),
    speedKmh: v.number(),
    latitude: v.number(),
    longitude: v.number(),
    lastTickAt: v.number(),
    /** Which step is next. A step with any other number is a stray, and stops. */
    seq: v.number(),
    arrivedAt: v.optional(v.number()),
  })
    .index("by_rideId", ["rideId"])
    .index("by_arrivedAt_and_lastTickAt", ["arrivedAt", "lastTickAt"]),

  // The road distance between two places, as the router measured it.
  //
  // Fares are charged on this, and the same row is used for the quote and
  // for the booking, so the passenger is never quoted one price and charged
  // another. The rows are keyed by the rounded coordinates of the two places.
  routeDistances: defineTable({
    /** Rounded pickup and dropoff, joined. */
    key: v.string(),
    /** The road distance in kilometres. */
    distanceKm: v.number(),
    /** When it was measured. */
    fetchedAt: v.number(),
    /** Where it came from: the router, or the fallback estimate. */
    source: v.union(v.literal("router"), v.literal("estimate")),
  }).index("by_key", ["key"]),

  // A sign-up that is waiting for its one-time code to be entered.
  //
  // The whole pending sign-up is held here, including the hashed password,
  // so that verifying the code and creating the account is one transaction
  // and the details never have to be sent twice.
  signupCodes: defineTable({
    /** The hashed password. The password itself is never stored. */
    passwordHash: v.string(),
    /** The hashed code. The code itself is never stored. */
    codeHash: v.string(),
    /**
     * The code in the clear, for the sandbox mailbox only.
     *
     * It is written only when the deployment has explicitly turned the
     * sandbox on, so a live deployment never holds a readable code.
     */
    sandboxCode: v.optional(v.string()),
    /** How many wrong guesses the code has had. */
    attempts: v.number(),
    codeCreatedAt: v.number(),
    email: v.string(),
    expiresAt: v.number(),
    licenseNumber: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    role: v.union(v.literal("commuter"), v.literal("operator")),
    /** The salt the code was hashed with. */
    salt: v.string(),
    usedAt: v.optional(v.number()),
    vehicleInfo: v.optional(
      v.object({
        plateNumber: v.string(),
        model: v.string(),
        color: v.string(),
      })
    ),
  }).index("by_email", ["email"]),

  feedback: defineTable({
    rideId: v.id("rides"),
    commuterId: v.id("commuters"),
    operatorId: v.id("operators"),
    rating: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_rideId", ["rideId"])
    .index("by_operatorId", ["operatorId"]),

  payments: defineTable({
    rideId: v.id("rides"),
    commuterId: v.id("commuters"),
    amount: v.number(),
    currency: v.literal("PHP"),
    // Where the money actually moved. This is the settlement, not the rider's
    // intent: the intent is on the ride, in `rides.paymentMethod`.
    provider: v.union(v.literal("gcash"), v.literal("maya"), v.literal("cash")),
    providerRef: v.string(),
    referenceNumber: v.string(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("AUTHORIZED"),
      v.literal("SETTLED"),
      v.literal("FAILED"),
      v.literal("EXPIRED"),
      v.literal("REFUNDED")
    ),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_rideId", ["rideId"])
    .index("by_commuterId", ["commuterId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    isRevoked: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // Whether a user's app is open right now (fixoct51). Each signed-in app
  // writes a heartbeat here; a row seen within `ONLINE_WINDOW_MS` is online.
  // Kept apart from `users` so the heartbeat does not invalidate every query
  // that reads the user document.
  presence: defineTable({
    userId: v.id("users"),
    role: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
    lastSeenAt: v.number(),
  }).index("by_userId", ["userId"]),

  loginAttempts: defineTable({
    email: v.string(),
    count: v.number(),
    lastAttemptAt: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_email", ["email"]),

  messages: defineTable({
    rideId: v.id("rides"),
    senderId: v.id("users"),
    senderRole: v.union(
      v.literal("commuter"),
      v.literal("operator"),
      v.literal("admin")
    ),
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_rideId", ["rideId"])
    .index("by_createdAt", ["createdAt"]),
});
