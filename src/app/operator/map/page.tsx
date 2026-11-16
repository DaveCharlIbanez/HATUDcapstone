"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AppMenuButton } from "@/components/AppShell";
import { RecenterButton } from "@/components/RecenterButton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { errorMessage } from "@/lib/errors";
import {
  createPartnerMarkerElement,
  DRIVER_PIN_COLOR,
  DRIVER_PIN_GLYPH,
  MOVING_MARKER_OPTIONS,
} from "@/lib/mapMarkers";
import { routeLegForRide } from "@/lib/mapRoute";
import { useTheme } from "@/lib/themeContext";
import { tripModeFor } from "@/lib/tripMode";
import { useMapInstance } from "@/lib/useMapInstance";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useRouteLine } from "@/lib/useRouteLine";
import {
  type SimulatedVehicle,
  useSimulatedVehicle,
} from "@/lib/useSimulatedVehicle";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { OperatorHeader } from "../OperatorHeader";
import type { TripProgress } from "./CurrentRidePanel";
import { FinishedRideOverlays } from "./FinishedRideOverlays";
import { OperatorPanels } from "./OperatorPanels";
import { rideDetailPanel } from "./RideDetailSheet";
import { rideListPanel } from "./RideQueueSheet";
import { useDriverPosition, useSendDriverLocation } from "./useDriverPosition";
import { useFinishedRide } from "./useFinishedRide";
import { usePassengerMarker } from "./usePassengerMarker";
import { useQueueEtas } from "./useQueueEtas";
import { useQueueMarkers } from "./useQueueMarkers";

/** The pin for the driver's own position. */

/**
 * A ride is live while it has a driver and the trip has not ended.
 */
function rideIsLive(ride: { status: string } | null): boolean {
  return Boolean(
    ride && (ride.status === "accepted" || ride.status === "inProgress")
  );
}

/**
 * The driver is off shift with requests waiting.
 *
 * An approved driver is off shift until they say otherwise, and the server
 * refuses to let them take a ride while they are. Without this the only sign
 * of it was a failed *Accept* with a message that named a collision that had
 * not happened.
 */
function isWaitingForShift(
  online: boolean,
  hasActiveRide: boolean,
  waitingCount: number
): boolean {
  return !(online || hasActiveRide) && waitingCount > 0;
}

/**
 * Where the road is going.
 *
 * While a ride is under way it is the ride's own leg: to the pickup while
 * collecting, to the destination once the passenger is on board. With no ride
 * yet it is the road to the request the driver is looking at — which used to
 * be a button that sent them out to Google Maps.
 */
function routeTargetFor(
  rideLegTarget: { latitude: number; longitude: number } | null,
  selectedPickup: { latitude: number; longitude: number } | null
): { latitude: number; longitude: number } | null {
  if (rideLegTarget) {
    return rideLegTarget;
  }
  return selectedPickup;
}

/**
 * What the ride panel says about the road ahead.
 *
 * Before the trip it is the router's time to the pickup. During the trip it
 * is the simulated vehicle's time and distance to the destination, and
 * whether it has got there — which is what lets the driver end the ride.
 */
function tripPanelView(
  isTripUnderWay: boolean,
  trip: SimulatedVehicle,
  routeEtaSeconds: number | null
): { etaSeconds: number | null; progress: TripProgress | null } {
  if (!isTripUnderWay) {
    return { etaSeconds: routeEtaSeconds, progress: null };
  }
  return {
    etaSeconds: trip.etaSeconds,
    progress: {
      hasArrived: trip.hasArrived,
      remainingMeters: trip.remainingMeters,
    },
  };
}

export default function OperatorMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);

  const { sessionToken, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const rideList = rideListPanel(isDesktop);
  const rideDetail = rideDetailPanel(isDesktop);
  const router = useRouter();

  const operatorProfile = useQuery(
    api.operators.getSelf,
    sessionToken ? { sessionToken } : "skip"
  );
  const pendingRides = useQuery(
    api.rides.listPendingForMe,
    sessionToken ? { sessionToken } : "skip"
  );
  const activeTrip = useQuery(
    api.rides.getActiveForMe,
    sessionToken ? { sessionToken } : "skip"
  );
  const activeRide = activeTrip?.ride ?? null;
  const activeRideCommuter =
    activeTrip?.partner?.kind === "commuter" ? activeTrip.partner : null;

  const acceptRideMutation = useMutation(api.rides.accept);
  const completeRideMutation = useMutation(api.rides.complete);
  const updateRideStatusMutation = useMutation(api.rides.updateStatus);
  const setAvailabilityMutation = useMutation(api.operators.setAvailability);

  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [online, setOnline] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);

  // fixoct48: the ride the driver has just finished, and its payment.
  const finished = useFinishedRide(sessionToken);

  const partnerLocation = useQuery(
    api.rides.getPartnerLocation,
    sessionToken && activeRide
      ? { sessionToken, rideId: activeRide._id }
      : "skip"
  );
  const commuterLocation =
    partnerLocation && "commuterLocation" in partnerLocation
      ? (partnerLocation.commuterLocation ?? null)
      : null;

  // Once a demo trip starts, the vehicle is driven along the road by the
  // server and GPS no longer moves anything on this map. A live trip keeps
  // following GPS the whole way, and the driver's position is sent for it.
  const { isFollowingGps: isSendingGps, isSimulating: isTripUnderWay } =
    tripModeFor(activeRide);

  const { currentLocation, locationError, locationRef } = useDriverPosition({
    holdMarker: isTripUnderWay,
    mapRef: map,
    userMarkerRef,
  });

  const isRideLive = rideIsLive(activeRide);

  const passengerMarkerRef = usePassengerMarker({
    commuterLocation,
    isRideLive,
    isTripUnderWay,
    mapRef: map,
    rideEndpoints: activeRide
      ? { dropoff: activeRide.dropoff, pickup: activeRide.pickup }
      : null,
  });

  // The map is built first, because everything below draws on it. A hook that
  // drew onto a map that did not exist yet would find nothing there.
  //
  // The map is created once and never rebuilt: the theme swaps the style on
  // the live instance, which would otherwise throw away the WebGL context and
  // every marker drawn on it.
  useMapInstance({
    containerRef: mapContainer,
    landmarkMarkersRef,
    mapRef: map,
    onMapReady: (instance) => {
      setMapInstance(instance);
      if (!instance) {
        userMarkerRef.current = null;
        return;
      }
      const driverEl = createPartnerMarkerElement(
        DRIVER_PIN_GLYPH,
        DRIVER_PIN_COLOR
      );
      userMarkerRef.current = new maplibregl.Marker({
        ...MOVING_MARKER_OPTIONS,
        element: driverEl,
      })
        .setLngLat([122.0175, 10.7883])
        .addTo(instance);
    },
    theme,
  });

  type PendingRide = NonNullable<typeof pendingRides>[number];
  const [selectedRide, setSelectedRide] = useState<PendingRide | null>(null);
  // Kept separately so the queue can highlight the open request without
  // narrowing the whole selection to `null` inside the branch that renders it.
  const selectedRideId = selectedRide?._id ?? null;

  // The road the driver is taking: to the pickup while collecting, to the
  // destination once the passenger is on board.
  const routeLeg = useMemo(() => routeLegForRide(activeRide), [activeRide]);

  // With no ride yet, the road is the one to the request the driver is
  // looking at. It used to be a button that sent them out to Google Maps,
  // which took them off the app, away from the chat and the queue.
  const routeTarget = routeTargetFor(
    routeLeg.target,
    selectedRide
      ? {
          latitude: selectedRide.pickup.latitude,
          longitude: selectedRide.pickup.longitude,
        }
      : null
  );

  // During a demo trip the simulation draws the road, shrinking behind the
  // vehicle, so the router is not asked for it.
  const { route } = useRouteLine({
    map: mapInstance,
    origin: currentLocation,
    phase: routeLeg.phase,
    target: isTripUnderWay ? null : routeTarget,
  });

  // The driver and the passenger ride along in the simulated vehicle.
  const trip = useSimulatedVehicle({
    follow: true,
    getMarkers: () => [userMarkerRef.current, passengerMarkerRef.current],
    map: mapInstance,
    rideId: isTripUnderWay && activeRide ? activeRide._id : null,
    sessionToken,
  });

  // How long the road takes to each open request — one request for the whole
  // queue, and only when the driver has moved far enough for it to change.
  const queueEtas = useQueueEtas({
    origin: currentLocation,
    pickups: (pendingRides ?? []).map((ride) => ({
      id: ride._id,
      latitude: ride.pickup.latitude,
      longitude: ride.pickup.longitude,
    })),
  });
  // The chat appears on its own while a ride is live. It is deliberately not
  // a toggle: a driver must not be able to hide the chat from a passenger who
  // is trying to reach them.
  const [chatReady, setChatReady] = useState(false);

  useEffect(() => {
    if (
      !authLoading &&
      activeRide &&
      (activeRide.status === "accepted" ||
        activeRide.status === "inProgress") &&
      sessionToken
    ) {
      const timer = setTimeout(() => setChatReady(true), 100);
      return () => clearTimeout(timer);
    }
    setChatReady(false);
  }, [authLoading, activeRide, activeRide?.status, sessionToken]);

  const showChat = chatReady;

  // Seed the online flag from the server on load
  useEffect(() => {
    if (operatorProfile) {
      setOnline(operatorProfile.isAvailable);
    }
  }, [operatorProfile?._id, operatorProfile]);

  // A driver whose application has not been approved cannot use the map, so
  // they are sent to their application screen instead.
  useEffect(() => {
    if (!operatorProfile) {
      return;
    }
    if (operatorProfile.approvalStatus !== "approved") {
      router.replace("/operator/application");
    }
  }, [operatorProfile?.approvalStatus, operatorProfile, router]);

  const handleToggleOnline = async () => {
    if (!(operatorProfile && sessionToken)) {
      return;
    }
    // A driver on a trip is on shift. The shift cannot be changed while a
    // ride is live, because the server would then believe a driver who is
    // carrying a passenger is available for another one.
    if (activeRide) {
      showToast(
        "Finish your current ride before changing your shift.",
        "error"
      );
      return;
    }

    const nextOnline = !online;
    setOnline(nextOnline);
    try {
      await setAvailabilityMutation({
        sessionToken,
        id: operatorProfile._id,
        isAvailable: nextOnline,
        currentLocation: locationRef.current
          ? {
              latitude: locationRef.current.latitude,
              longitude: locationRef.current.longitude,
            }
          : undefined,
      });
    } catch (error) {
      // Put the toggle back the way it was, so the UI never claims the
      // driver is online when the server disagrees.
      setOnline(!nextOnline);
      showToast(
        errorMessage(error, "Could not change your availability."),
        "error"
      );
    }
  };

  // The driver's position is sent while they head to the pickup, and for the
  // whole of a live trip. Once a demo trip starts, the simulation drives the
  // vehicle and GPS is no longer sent.
  useSendDriverLocation({
    locationRef,
    ride: activeRide,
    send: isSendingGps,
    sessionToken,
  });

  // The pins for the requests waiting in the queue.
  useQueueMarkers({
    mapRef: map,
    onSelect: setSelectedRide,
    rides: pendingRides,
  });

  const handleAcceptRide = async (rideId: Id<"rides">) => {
    if (!(operatorProfile && sessionToken)) {
      return;
    }
    try {
      await acceptRideMutation({
        sessionToken,
        id: rideId,
        operatorId: operatorProfile._id,
      });
      setSelectedRide(null);
    } catch (error) {
      // The server says exactly why the ride could not be taken — the driver
      // is off shift, they are already on a trip, or somebody else got there
      // first. Reporting all of those as "already accepted by another driver"
      // sent the driver looking for a collision that did not exist.
      showToast(errorMessage(error, "Could not accept this ride."), "error");
    }
  };

  /**
   * Starts the trip — only once the passenger has confirmed the pickup.
   *
   * fixoct45: the button that calls this used to look disabled but was not,
   * so a driver could start a ride the passenger had never confirmed. The
   * guard here and the one in `rides.updateStatus` keep it that way even if
   * the button is somehow pressed. A passenger who never shows is handled by
   * cancelling the ride, not by starting it without them.
   */
  const handleStartTrip = async () => {
    if (!(activeRide && sessionToken)) {
      return;
    }
    if (activeRide.confirmedAt === undefined) {
      showToast("Waiting for the passenger to confirm the pickup.", "info");
      return;
    }
    try {
      await updateRideStatusMutation({
        sessionToken,
        id: activeRide._id,
        status: "inProgress",
      });
    } catch (error) {
      showToast(errorMessage(error, "Could not start the ride."), "error");
    }
  };

  const handleCompleteRide = async () => {
    if (!(activeRide && operatorProfile && sessionToken)) {
      return;
    }
    try {
      await completeRideMutation({
        sessionToken,
        id: activeRide._id,
        operatorId: operatorProfile._id,
        // A cash ride is settled by the driver confirming the handover, and
        // the server will not close it without that confirmation.
        ...(activeRide.paymentMethod === "cash" ? { cashCollected: true } : {}),
      });
    } catch (error) {
      showToast(errorMessage(error, "Could not complete the ride."), "error");
      return;
    }
    finished.track(activeRide._id);
    setEarnings((previous) => previous + (activeRide.fare ?? 0));
    setRidesToday((previous) => previous + 1);
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const tripView = tripPanelView(
    isTripUnderWay,
    trip,
    route?.durationSeconds ?? null
  );

  const waitingForShift = isWaitingForShift(
    online,
    Boolean(activeRide),
    pendingRides?.length ?? 0
  );

  return (
    <div className="relative h-screen w-full bg-slate-950">
      {/* Map */}
      {/* `relative z-0` makes it a stacking context, so the map's markers
          stay inside the map instead of painting over the overlays. */}
      <div className="relative z-0 h-full w-full" ref={mapContainer} />

      <RecenterButton
        className="absolute top-28 left-1/2 z-20 -translate-x-1/2"
        trip={trip}
      />

      {/* The menu button floats above the map, clear of the header. */}
      <AppMenuButton className="fixed top-3 left-3 z-[55]" />

      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10">
        <OperatorHeader
          locationError={locationError}
          online={online}
          onToggleOnline={handleToggleOnline}
          profile={operatorProfile}
          theme={theme}
          waitingCount={pendingRides?.length ?? 0}
          waitingForShift={waitingForShift}
        />
      </div>

      {/* Earnings & Stats — Desktop only */}
      <div className="absolute top-28 right-4 z-10 hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 sm:block sm:p-4">
        <div className="text-center">
          <p className="mb-1 text-[var(--text-muted)] text-xs">
            Today&apos;s Earnings
          </p>
          <p className="font-bold text-sky-400 text-xl">₱{earnings}</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {ridesToday} rides
          </p>
        </div>
      </div>

      <OperatorPanels
        activeEtaSeconds={tripView.etaSeconds}
        activeRide={activeRide}
        canAccept={Boolean(operatorProfile)}
        chatReady={showChat}
        detailClassName={rideDetail.className}
        detailRide={selectedRide}
        detailVariant={rideDetail.variant}
        etas={queueEtas}
        onAccept={handleAcceptRide}
        onCall={handleCall}
        onCloseDetail={() => setSelectedRide(null)}
        onComplete={handleCompleteRide}
        onSelectRequest={setSelectedRide}
        onStartTrip={handleStartTrip}
        partner={activeRideCommuter}
        pendingRides={pendingRides}
        queueClassName={rideList.className}
        queueHidden={finished.panelOpen}
        queueVariant={rideList.variant}
        selectedRideId={selectedRideId}
        sessionToken={sessionToken}
        tripProgress={tripView.progress}
      />

      {/* fixoct48: the finished ride and its payment, as the passenger sees
          theirs. A new ride takes the screen back. */}
      <FinishedRideOverlays
        finished={finished}
        hasActiveRide={Boolean(activeRide)}
      />
    </div>
  );
}
