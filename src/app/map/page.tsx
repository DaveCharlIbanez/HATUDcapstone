"use client";

import type maplibregl from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { LocationStep } from "./LocationStep";
import { MapOverlays } from "./MapOverlays";
import { RideProgressPanel } from "./RideProgressPanel";
import { useMapInstance } from "./useMapInstance";
import { useRideStage } from "./useRideStage";
import { type VehicleOption, VehiclePicker } from "./VehiclePicker";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/lib/authContext";
import { locateUser } from "@/lib/geolocation";
import {
  getLandmarksByMunicipality,
  type Landmark,
  type Municipality,
} from "@/lib/landmarks";
import { type PlaceSuggestion, searchPlace } from "@/lib/mapClient";
import { useTheme } from "@/lib/themeContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MapPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { user, logout, sessionToken, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState({ lat: 0, lng: 0 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 0, lng: 0 });
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>(
    []
  );
  const [step, setStep] = useState<
    "location" | "vehicle" | "booking" | "tracking"
  >("location");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<
    | "searching"
    | "matched"
    | "arriving"
    | "arrived"
    | "in-progress"
    | "completed"
  >("searching");
  const [activeRideId, setActiveRideId] = useState<Id<"rides"> | null>(null);
  const [confirmedRide, setConfirmedRide] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState<
    Municipality | "all"
  >("all");
  const [showLandmarkDropdown, setShowLandmarkDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
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
  const activeRide = activeTrip?.ride ?? null;

  const matchedOperator =
    activeTrip?.partner?.kind === "operator" ? activeTrip.partner : null;

  const createRide = useMutation(api.rides.create);
  const cancelRide = useMutation(api.rides.cancel);

  const vehicles: VehicleOption[] = [
    {
      type: "standard",
      name: "Standard",
      icon: "🏍️",
      eta: "2 min",
      capacity: 1,
      basePrice: 30,
    },
    {
      type: "priority",
      name: "Priority",
      icon: "🛵",
      eta: "3 min",
      capacity: 2,
      basePrice: 50,
    },
  ];

  // The fare is priced on the server. Coordinates are only known once both
  // addresses have been resolved, and the default of 0,0 is not a real point.
  const hasRoute =
    pickupCoords.lat !== 0 &&
    dropoffCoords.lat !== 0 &&
    dropoffCoords.lng !== 0;

  const fareQuote = useQuery(
    api.rides.getFareQuote,
    sessionToken && hasRoute
      ? {
          sessionToken,
          pickup: {
            latitude: pickupCoords.lat,
            longitude: pickupCoords.lng,
          },
          dropoff: {
            latitude: dropoffCoords.lat,
            longitude: dropoffCoords.lng,
          },
        }
      : "skip"
  );

  useMapInstance({
    containerRef: mapContainer,
    landmarkMarkersRef,
    mapRef: map,
    theme,
  });

  useEffect(() => {
    if (!(authLoading || user)) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "commuter") {
      router.push(user.role === "admin" ? "/admin" : "/operator/map");
    }
  }, [user, authLoading, router]);

  const resetBooking = useCallback(() => {
    setStep("location");
    setPickup("");
    setDropoff("");
    setPickupCoords({ lat: 0, lng: 0 });
    setDropoffCoords({ lat: 0, lng: 0 });
    setPickupSuggestions([]);
    setSelectedVehicle(null);
    setRideStatus("searching");
    setActiveRideId(null);
    setConfirmedRide(false);
  }, []);

  useRideStage({
    activeRide,
    confirmedRide,
    resetBooking,
    setRideStatus,
    setStep,
  });

  useEffect(() => {
    if (
      !authLoading &&
      activeRide &&
      (activeRide.status === "accepted" ||
        activeRide.status === "inProgress") &&
      sessionToken
    ) {
      const timer = setTimeout(() => setShowChat(true), 100);
      return () => clearTimeout(timer);
    }
    setShowChat(false);
  }, [authLoading, activeRide, activeRide?.status, sessionToken]);

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

  const handleBookRide = async () => {
    if (!(selectedVehicle && pickup && dropoff && commuter && sessionToken)) {
      return;
    }

    const vehicle = vehicles.find((v) => v.type === selectedVehicle);
    if (!vehicle) {
      return;
    }

    setStep("booking");
    setRideStatus("searching");

    try {
      const rideId = await createRide({
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
        vehicleType: vehicle.type,
      });
      setActiveRideId(rideId);
    } catch (err) {
      console.error("Booking failed:", err);
      setStep("vehicle");
    }
  };

  const handleConfirmBooking = () => {
    setConfirmedRide(true);
    setStep("tracking");
    setRideStatus("arriving");
  };

  const handleCancelRide = async () => {
    if (activeRideId && sessionToken) {
      await cancelRide({ sessionToken, id: activeRideId });
    }
    resetBooking();
  };

  const displayName = commuter?.name ?? user?.name ?? "Loading...";

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <MapOverlays displayName={displayName} onLogout={logout} theme={theme} />

      {/* `relative z-0` makes this a stacking context, so the map's markers
          stay inside the map instead of painting over the overlays. */}
      <div className="relative z-0 h-full w-full" ref={mapContainer} />

      <div className="pointer-events-none absolute bottom-0 flex w-full justify-center md:pb-0">
        <div className="pointer-events-auto w-full max-w-md rounded-t-3xl border-2 border-[var(--border)] bg-[var(--background)]/95 shadow-2xl backdrop-blur-xl md:mb-0">
          <div className="flex justify-center py-3">
            <div className="h-2 w-16 rounded-full bg-gray-400" />
          </div>

          <div className="max-h-[calc(100dvh-12rem)] touch-pan-y overflow-y-auto overscroll-contain px-5 pb-24 md:max-h-[calc(100dvh-7rem)] md:pb-4">
            {step === "location" && (
              <LocationStep
                dropoff={dropoff}
                filteredLandmarks={filteredLandmarks}
                isLocating={isLocating}
                locationError={locationError}
                onChooseRide={() => setStep("vehicle")}
                onPickupSearch={handlePickupSearch}
                onPickupSelect={handlePickupSelect}
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

            {step === "vehicle" && (
              <VehiclePicker
                canBook={Boolean(
                  selectedVehicle && commuter && sessionToken && fareQuote
                )}
                fareQuote={fareQuote}
                onBook={handleBookRide}
                onSelect={(vehicleType) => setSelectedVehicle(vehicleType)}
                selectedVehicle={selectedVehicle}
                vehicles={vehicles}
              />
            )}

            {step === "booking" && (
              <RideProgressPanel
                matchedOperator={matchedOperator}
                onBookAnother={resetBooking}
                onCancel={handleCancelRide}
                onConfirm={handleConfirmBooking}
                onPay={() => router.push("/payment")}
                rideStatus={rideStatus}
              />
            )}

            {step === "tracking" && (
              <RideProgressPanel
                matchedOperator={matchedOperator}
                onBookAnother={resetBooking}
                onCancel={handleCancelRide}
                onConfirm={handleConfirmBooking}
                onPay={() => router.push("/payment")}
                rideStatus={rideStatus}
              />
            )}
          </div>

          {showChat && activeRide && sessionToken && (
            <ChatBubble
              partnerName={matchedOperator?.name ?? "Driver"}
              partnerRole="operator"
              rideId={activeRide._id}
              sessionToken={sessionToken}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPage;
