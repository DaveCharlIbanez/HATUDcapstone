"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLoader } from "@/components/AppLoader";
import { AppMenuButton } from "@/components/AppShell";
import { ChatBubble } from "@/components/ChatBubble";
import { DragSheet, type SnapPoint } from "@/components/DragSheet";
import { RecenterButton } from "@/components/RecenterButton";
import { useToast } from "@/components/Toast";
import { useMapInstance } from "@/lib/useMapInstance";
import { BookingBack } from "./BookingBack";
import { LocationStep } from "./LocationStep";
import { MapOverlays } from "./MapOverlays";
import { PaymentMethodPicker } from "./PaymentMethodPicker";
import { type DriverArrival, RideProgressPanel } from "./RideProgressPanel";
import {
  BACK_LABELS,
  type BookingStep,
  backTargetFor,
  type RideStatus,
} from "./rideStage";
import { useFareQuote } from "./useFareQuote";
import { useRideLocation } from "./useRideLocation";
import { useRiderView } from "./useRiderView";
import { useRideStage } from "./useRideStage";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuth } from "@/lib/authContext";
import { errorMessage } from "@/lib/errors";
import { locateUser } from "@/lib/geolocation";
import {
  getLandmarksByMunicipality,
  type Landmark,
  type Municipality,
} from "@/lib/landmarks";
import { BOTTOM_NAV_HEIGHT } from "@/lib/layout";
import { type PlaceSuggestion, searchPlace } from "@/lib/mapClient";
import { useTheme } from "@/lib/themeContext";
import { useLocationPermission } from "@/lib/useLocationPermission";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { commuterCancelDeadline } from "../../../convex/lib/cancellation";
import type { PaymentMethod } from "../../../convex/lib/paymentMethods";

/**
 * Detents of the ride booking sheet, as a fraction of its own content.
 *
 * `full` is exactly the content height, which is where the sheet rests when
 * the booking screen opens. `expanded` lets the sheet grow past its content
 * so there is room for the layout to breathe.
 */
const BOOKING_SNAPS: SnapPoint[] = [
  { id: "peek", ratio: 0.35 },
  { id: "half", ratio: 0.7 },
  { id: "full", ratio: 1 },
  { id: "expanded", ratio: 1.6 },
];

/**
 * Where the driver has got to, as far as the rider can tell.
 *
 * The trip cannot start while the driver is demonstrably still on the way.
 * A driver whose position is missing or stale is not judged, because a
 * missing fix must never lock a passenger out of a trip.
 */
function arrivalFor(
  isDriverArrived: boolean,
  isDriverOnTheWay: boolean
): DriverArrival {
  if (isDriverArrived) {
    return "arrived";
  }
  if (isDriverOnTheWay) {
    return "onTheWay";
  }
  return "unknown";
}

/**
 * Where the passenger belongs, given who they are.
 *
 * The passenger's map is theirs alone: a driver belongs on the driver's map
 * and an administrator on theirs.
 */
function landingRouteFor(
  user: { role: string } | null | undefined,
  authLoading: boolean
): string | null {
  if (authLoading) {
    return null;
  }
  if (!user) {
    return "/login";
  }
  if (user.role !== "commuter") {
    return user.role === "admin" ? "/admin" : "/operator/map";
  }
  return null;
}

/**
 * Whether the rider's chat should be open.
 *
 * The chat appears on its own while a ride is live. It is deliberately not a
 * toggle: a rider must not be able to hide the chat from a driver who is
 * trying to reach them.
 */
function shouldOpenChat(
  ride: { status: string } | null | undefined,
  authLoading: boolean,
  sessionToken: string | null
): boolean {
  if (authLoading || !ride || !sessionToken) {
    return false;
  }
  return ride.status === "accepted" || ride.status === "inProgress";
}

const MapPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const { user, sessionToken, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const router = useRouter();

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState({ lat: 0, lng: 0 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 0, lng: 0 });
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>(
    []
  );
  const [step, setStep] = useState<BookingStep>("location");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null
  );
  // A demo trip is driven by the server instead of GPS. Off by default, and
  // never remembered between bookings, so live stays the normal trip.
  const [demoMode, setDemoMode] = useState(false);
  const [rideStatus, setRideStatus] = useState<RideStatus>("searching");
  const [activeRideId, setActiveRideId] = useState<Id<"rides"> | null>(null);
  const [confirmedRideId, setConfirmedRideId] = useState<Id<"rides"> | null>(
    null
  );
  const [isBooking, setIsBooking] = useState(false);
  const [dismissedCompletedId, setDismissedCompletedId] =
    useState<Id<"rides"> | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState<
    Municipality | "all"
  >("all");
  const [showLandmarkDropdown, setShowLandmarkDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationPermission = useLocationPermission();
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const commuter = useQuery(
    api.commuters.getSelf,
    sessionToken ? { sessionToken } : "skip"
  );

  const activeTrip = useQuery(
    api.rides.getActiveForMe,
    sessionToken ? { sessionToken } : "skip"
  );

  // The ride that is under way, and the ride that has just finished. The
  // finished one is what the passenger sees when they have nothing else going
  // on, so the trip that just ended can be paid for and rated.
  const { completedRide, liveRide, matchedOperator, viewedRide } = useRiderView(
    activeTrip,
    dismissedCompletedId
  );

  // The map is built first, because everything below draws on it. A hook that
  // drew onto a map that did not exist yet would find nothing there.
  useMapInstance({
    containerRef: mapContainer,
    landmarkMarkersRef,
    mapRef: map,
    onMapReady: setMapInstance,
    theme,
  });

  // Share the rider's position with the driver, and show the driver back.
  const {
    isDriverArrived,
    isDriverOnTheWay,
    route: driverRoute,
    trip,
  } = useRideLocation({
    activeRide: liveRide,
    mapInstance,
    sessionToken,
  });

  // Where the driver has got to, as far as the rider can tell. The trip
  // cannot start while the driver is demonstrably still on the way, and the
  // button that starts it is disabled for exactly that reason.
  const driverArrival = arrivalFor(isDriverArrived, isDriverOnTheWay);

  // Booking is an action, not a mutation: the fare is charged on the road
  // distance the router measured, and only an action can make that call.
  const createRide = useAction(api.rides.create);
  const cancelRide = useMutation(api.rides.cancel);
  const confirmRide = useMutation(api.rides.confirm);

  /**
   * The ride the rider is booking.
   *
   * There is one ride type. It is not a choice, so it is not a step: the
   * class and the fare are shown on the payment step, next to the choice
   * that is a choice.
   */
  const RIDE = {
    capacity: 1,
    name: "Standard",
  } as const;

  // The price comes from the server, measured on the same road the map draws.
  const fareQuote = useFareQuote({
    dropoff: dropoffCoords,
    pickup: pickupCoords,
    sessionToken,
  });

  // What this trip will cost, shown on the payment step so the choice is made
  // against a number rather than in the abstract.
  const selectedFare = fareQuote ? fareQuote.standard.fare : null;

  useEffect(() => {
    const landing = landingRouteFor(user, authLoading);
    if (landing) {
      router.push(landing);
    }
  }, [user, authLoading, router]);

  const resetBooking = useCallback(() => {
    setStep("location");
    setPickup("");
    setDropoff("");
    setPickupCoords({ lat: 0, lng: 0 });
    setDropoffCoords({ lat: 0, lng: 0 });
    setPickupSuggestions([]);
    setPaymentMethod(null);
    setDemoMode(false);
    setRideStatus("searching");
    setActiveRideId(null);
    setConfirmedRideId(null);
  }, []);

  /**
   * Dragging the sheet down must never wipe a ride that is still running.
   *
   * The sheet can be dismissed while a trip is under way, and the dismissal
   * used to clear the whole booking state — so the passenger was dropped back
   * onto the location screen while their driver was on the way.
   */
  const handleDismissSheet = useCallback(() => {
    if (liveRide) {
      return;
    }
    resetBooking();
  }, [liveRide, resetBooking]);

  /**
   * Start a new trip after the last one has been paid for and rated.
   *
   * The finished ride is put aside as well, so the screen does not fall back
   * to it the moment the booking state is cleared.
   */
  /**
   * What the finished trip still needs.
   *
   * A trip that has been paid for only needs rating, so the button says so
   * and goes straight to the rating page. Otherwise it goes to the payment
   * page, which knows which trip is due.
   */
  const handlePayOrRate = useCallback(() => {
    const trip = completedRide;
    if (trip?.paymentStatus === "paid") {
      router.push(`/feedback?ride=${trip._id}`);
      return;
    }
    // The payment page is told which trip, so it cannot drift onto another.
    router.push(trip ? `/payment?ride=${trip._id}` : "/payment");
  }, [completedRide, router]);

  const payActionLabel =
    completedRide?.paymentStatus === "paid"
      ? "Rate your driver"
      : "Pay & Rate Driver";

  const handleBookAnother = useCallback(() => {
    setDismissedCompletedId(completedRide?._id ?? null);
    resetBooking();
  }, [completedRide?._id, resetBooking]);

  useRideStage({
    activeRide: viewedRide,
    confirmedRideId,
    resetBooking,
    setRideStatus,
    setStep,
  });

  useEffect(() => {
    if (!shouldOpenChat(liveRide, authLoading, sessionToken)) {
      setShowChat(false);
      return;
    }
    const timer = setTimeout(() => setShowChat(true), 100);
    return () => clearTimeout(timer);
  }, [authLoading, liveRide, liveRide?.status, sessionToken]);

  const handlePickupSearch = async (query: string) => {
    setPickup(query);
    if (query.length > 2) {
      const results = await searchPlace(`${query}, Antique, Philippines`);
      setPickupSuggestions(results.slice(0, 4));
    } else {
      setPickupSuggestions([]);
    }
  };

  const handlePickupSelect = (place: PlaceSuggestion) => {
    setPickup(place.display_name);
    setPickupCoords({
      lat: Number.parseFloat(place.lat),
      lng: Number.parseFloat(place.lon),
    });
    setPickupSuggestions([]);
  };

  const handleUseMyLocation = () => {
    locateUser({
      map,
      userMarkerRef,
      onError: setLocationError,
      onLocated: (coords, label) => {
        setPickupCoords(coords);
        setPickup(label);
      },
      onLocatingChange: setIsLocating,
    });
  };

  const handleLandmarkSelect = (landmark: Landmark) => {
    setDropoff(landmark.name);
    setDropoffCoords({
      lat: landmark.coordinates.lat,
      lng: landmark.coordinates.lng,
    });
    setShowLandmarkDropdown(false);
    map.current?.flyTo({
      center: [landmark.coordinates.lng, landmark.coordinates.lat],
      zoom: 15,
    });
  };

  const filteredLandmarks = getLandmarksByMunicipality(selectedMunicipality);

  /**
   * Back to the previous step of the booking.
   *
   * Nothing is cleared: the pickup, the destination, the vehicle and the
   * payment method are all still there when the rider comes forward again.
   * The one thing that cannot happen is leaving a step while the ride is
   * being created — the request is already on its way.
   */
  const handleGoBack = useCallback(() => {
    if (isBooking) {
      return;
    }
    const target = backTargetFor(step);
    if (target) {
      setStep(target);
    }
  }, [isBooking, step]);

  const backTarget = backTargetFor(step);

  const handleBookRide = async () => {
    // One booking at a time. Without this the Book button stayed tappable
    // while the mutation was in flight, and a slow connection turned one tap
    // into two requests.
    if (isBooking) {
      return;
    }
    if (!(paymentMethod && pickup && dropoff && commuter && sessionToken)) {
      return;
    }

    setIsBooking(true);
    setStep("booking");
    setRideStatus("searching");

    try {
      const result = await createRide({
        sessionToken,
        commuterId: commuter._id,
        pickup: {
          address: pickup,
          latitude: pickupCoords.lat,
          longitude: pickupCoords.lng,
        },
        dropoff: {
          address: dropoff,
          latitude: dropoffCoords.lat,
          longitude: dropoffCoords.lng,
        },
        paymentMethod,
        demoMode,
      });
      setActiveRideId(result.rideId);
      // Likewise the mode: a reused ride keeps the one it was booked with.
      setDemoMode(result.demoMode);
      // A booking that reused a live ride keeps the method that ride already
      // had, so the choice on the screen is the one that is really in force.
      setPaymentMethod(result.paymentMethod);
    } catch (err) {
      console.error("Booking failed:", err);
      // Back to the payment step, so the choice they made is still there.
      setStep("payment");
      showToast(errorMessage(err, "Could not book the ride."), "error");
    } finally {
      setIsBooking(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!(liveRide && sessionToken)) {
      return;
    }
    // The confirmation reaches the server, so the driver can see that the
    // passenger is ready and the two screens cannot disagree about it.
    setConfirmedRideId(liveRide._id);
    try {
      await confirmRide({ sessionToken, id: liveRide._id });
    } catch (error) {
      setConfirmedRideId(null);
      showToast(errorMessage(error, "Could not confirm the ride."), "error");
    }
  };

  const handleCancelRide = async () => {
    // The live ride, not the id the booking form happened to remember: after
    // a reload that id is gone, and the cancellation used to be silently
    // skipped while the request stayed open.
    const rideId = liveRide?._id ?? activeRideId;
    if (rideId && sessionToken) {
      try {
        await cancelRide({ sessionToken, id: rideId });
      } catch (error) {
        showToast(errorMessage(error, "Could not cancel the ride."), "error");
        return;
      }
    }
    resetBooking();
  };

  const displayName = commuter?.name ?? user?.name ?? "Loading...";

  // A driver cannot see a rider whose position is not being shared, and the
  // rider has no way of knowing that. The permission was asked for at
  // sign-up; this says so if it was refused.
  const locationNotice =
    locationPermission.state === "denied"
      ? "Your driver will not be able to see where you are."
      : null;

  if (authLoading || !user) {
    return <AppLoader variant="full" />;
  }

  return (
    <div className="relative h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      {/* The menu button floats above the map. It sits below the drawer, so
          the backdrop catches the tap and closes the drawer again. */}
      <AppMenuButton className="fixed top-3 left-3 z-[55]" />

      <MapOverlays displayName={displayName} theme={theme} />

      {/* `relative z-0` makes this a stacking context, so the map's markers
          stay inside the map instead of painting over the overlays. */}
      <div className="relative z-0 h-full w-full" ref={mapContainer} />

      <RecenterButton
        className="fixed top-3 left-1/2 z-[55] -translate-x-1/2"
        trip={trip}
      />

      <div className="pointer-events-none absolute bottom-[var(--bottom-nav-height)] z-40 flex w-full justify-center md:bottom-0">
        {/* The wrapper is only a positioning context. The sheet itself owns
            its height, and the chat bubble sits outside it so the sheet's
            overflow cannot clip it. */}
        <div className="pointer-events-auto relative w-full max-w-md">
          <DragSheet
            bodyClassName="px-5 pb-4"
            bottomInset={BOTTOM_NAV_HEIGHT}
            className="w-full rounded-t-3xl bg-[var(--background)]/95"
            defaultSnapId="full"
            dismissLabel="Book a ride"
            handleLabel="Ride booking panel"
            onDismiss={handleDismissSheet}
            snaps={BOOKING_SNAPS}
          >
            {backTarget && (
              <BookingBack
                disabled={isBooking}
                label={BACK_LABELS[backTarget] ?? "Back"}
                onBack={handleGoBack}
              />
            )}

            {step === "location" && (
              <LocationStep
                demoMode={demoMode}
                dropoff={dropoff}
                filteredLandmarks={filteredLandmarks}
                isLocating={isLocating}
                locationError={locationError}
                locationNotice={locationNotice}
                onContinue={() => setStep("payment")}
                onDemoModeChange={setDemoMode}
                onPickupSearch={handlePickupSearch}
                onPickupSelect={handlePickupSelect}
                onRequestLocation={locationPermission.request}
                onSelectLandmark={handleLandmarkSelect}
                onSelectMunicipality={setSelectedMunicipality}
                onToggleLandmarkDropdown={() =>
                  setShowLandmarkDropdown(!showLandmarkDropdown)
                }
                onUseMyLocation={handleUseMyLocation}
                pickup={pickup}
                pickupSuggestions={pickupSuggestions}
                selectedMunicipality={selectedMunicipality}
                showLandmarkDropdown={showLandmarkDropdown}
                theme={theme}
              />
            )}

            {step === "payment" && (
              <PaymentMethodPicker
                capacity={RIDE.capacity}
                demoMode={demoMode}
                fare={selectedFare}
                isBooking={isBooking}
                onContinue={handleBookRide}
                onSelect={setPaymentMethod}
                rideName={RIDE.name}
                selected={paymentMethod}
              />
            )}

            {/* The booking and the tracking steps show the same panel; what
                it says is decided by the ride's status, not by the step. */}
            {(step === "booking" || step === "tracking") && (
              <RideProgressPanel
                cancelDeadline={
                  liveRide ? commuterCancelDeadline(liveRide) : null
                }
                driverArrival={driverArrival}
                etaSeconds={
                  trip.isSimulating
                    ? trip.etaSeconds
                    : (driverRoute?.durationSeconds ?? null)
                }
                isDemo={liveRide?.demoMode === true}
                matchedOperator={matchedOperator}
                onBookAnother={handleBookAnother}
                onCancel={handleCancelRide}
                onConfirm={handleConfirmBooking}
                onPay={handlePayOrRate}
                payActionLabel={payActionLabel}
                rideStatus={rideStatus}
                tripArrived={trip.hasArrived}
              />
            )}
          </DragSheet>

          {showChat && liveRide && sessionToken && (
            <ChatBubble
              partnerName={matchedOperator?.name ?? "Driver"}
              partnerRole="operator"
              rideId={liveRide._id}
              sessionToken={sessionToken}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPage;
