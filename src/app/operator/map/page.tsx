"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaPhone,
} from "react-icons/fa";
import { ChatBubble } from "@/components/ChatBubble";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { getRoute } from "@/lib/mapClient";
import { createMarkerElement } from "@/lib/mapMarkers";
import { useTheme } from "@/lib/themeContext";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CurrentRidePanel } from "./CurrentRidePanel";

export default function OperatorMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const { sessionToken, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const _router = useRouter();

  const operatorProfile = useQuery(
    api.operators.getSelf,
    sessionToken ? { sessionToken } : "skip"
  );
  const pendingRides = useQuery(
    api.rides.listPendingWithCommuter,
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
  const updateRideStatusMutation = useMutation(api.rides.updateStatus);
  const completeRideMutation = useMutation(api.rides.complete);
  const updateOperatorLocationMutation = useMutation(
    api.rides.updateOperatorLocation
  );

  const partnerLocation = useQuery(
    api.rides.getPartnerLocation,
    sessionToken && activeRide
      ? { sessionToken, rideId: activeRide._id }
      : "skip"
  );
  const commuterLocation =
    partnerLocation && "commuterLocation" in partnerLocation
      ? partnerLocation.commuterLocation
      : null;

  const commuterMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeLayerId = "route-line";
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(
    null
  );
  const [_currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  type PendingRide = NonNullable<typeof pendingRides>[number];
  const [selectedRide, setSelectedRide] = useState<PendingRide | null>(null);
  const [_driverLocation, setDriverLocation] = useState<
    [number, number] | null
  >(null);
  const [showChat, setShowChat] = useState(false);

  // Show chat when ride is accepted or in progress
  useEffect(() => {
    console.log("[Operator] Chat visibility conditions:", {
      authLoading,
      activeRide: !!activeRide,
      status: activeRide?.status,
      hasSessionToken: !!sessionToken,
    });

    if (
      !authLoading &&
      activeRide &&
      (activeRide.status === "accepted" ||
        activeRide.status === "inProgress") &&
      sessionToken
    ) {
      console.log("[Operator] Enabling chat bubble");
      const timer = setTimeout(() => setShowChat(true), 100);
      return () => clearTimeout(timer);
    }
    setShowChat(false);
  }, [authLoading, activeRide, activeRide?.status, sessionToken]);

  // Map init
  useEffect(() => {
    if (map.current || !mapContainer.current) {
      return;
    }

    const mapStyle =
      theme === "dark"
        ? "https://tiles.openfreemap.org/styles/dark"
        : "https://tiles.openfreemap.org/styles/bright";
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [122.0175, 10.7883],
      zoom: 13,
    });

    const driverEl = document.createElement("div");
    driverEl.style.width = "20px";
    driverEl.style.height = "20px";
    driverEl.style.backgroundColor = "#3B82F6";
    driverEl.style.borderRadius = "50%";
    driverEl.style.border = "3px solid white";
    driverEl.style.boxShadow = "0 0 8px rgba(59, 130, 246, 0.5)";

    userMarkerRef.current = new maplibregl.Marker({ element: driverEl })
      .setLngLat([122.0175, 10.7883])
      .addTo(map.current);

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          const newLocation = { latitude, longitude };
          locationRef.current = newLocation;
          setDriverLocation([longitude, latitude]);
          setCurrentLocation(newLocation);
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat([longitude, latitude]);
          }
          if (map.current) {
            map.current.flyTo({ center: [longitude, latitude], zoom: 13 });
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      );
    }
  }, [theme]);

  // Send operator location to Convex every 5 seconds when ride is accepted/inProgress
  useEffect(() => {
    if (
      !activeRide ||
      (activeRide.status !== "accepted" &&
        activeRide.status !== "inProgress") ||
      !sessionToken
    ) {
      return;
    }

    const sendLocation = async () => {
      const loc = locationRef.current;
      if (!loc) {
        return;
      }

      try {
        await updateOperatorLocationMutation({
          sessionToken,
          rideId: activeRide._id,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      } catch (error) {
        console.error("Failed to update operator location:", error);
      }
    };

    sendLocation();
    const interval = setInterval(sendLocation, 5000);

    return () => clearInterval(interval);
  }, [activeRide, sessionToken, updateOperatorLocationMutation]);

  // Display commuter marker and route when location is available
  useEffect(() => {
    const loc = locationRef.current;
    if (!(map.current && commuterLocation && loc)) {
      return;
    }

    // Remove existing route if any
    if (map.current.getLayer(routeLayerId)) {
      map.current.removeLayer(routeLayerId);
    }
    if (map.current.getSource("route")) {
      map.current.removeSource("route");
    }

    // Add or update commuter marker
    if (commuterMarkerRef.current) {
      commuterMarkerRef.current.setLngLat([
        commuterLocation.longitude,
        commuterLocation.latitude,
      ]);
    } else {
      const commuterEl = document.createElement("div");
      commuterEl.style.width = "24px";
      commuterEl.style.height = "24px";
      commuterEl.style.backgroundColor = "#3B82F6";
      commuterEl.style.borderRadius = "50%";
      commuterEl.style.border = "3px solid white";
      commuterEl.style.boxShadow = "0 0 8px rgba(59, 130, 246, 0.5)";
      commuterEl.style.display = "flex";
      commuterEl.style.alignItems = "center";
      commuterEl.style.justifyContent = "center";
      commuterEl.style.fontSize = "14px";
      commuterEl.innerHTML = "👤";

      commuterMarkerRef.current = new maplibregl.Marker({ element: commuterEl })
        .setLngLat([commuterLocation.longitude, commuterLocation.latitude])
        .addTo(map.current);
    }

    // Check if location is stale (30 seconds)
    const isStale = Date.now() - commuterLocation.updatedAt > 30_000;
    if (isStale && commuterMarkerRef.current.getElement()) {
      commuterMarkerRef.current.getElement().style.backgroundColor = "#94a3b8";
      commuterMarkerRef.current.getElement().style.boxShadow =
        "0 0 8px rgba(148, 163, 184, 0.5)";
    }

    // Draw route from operator to commuter
    const drawRoute = async () => {
      const route = await getRoute(
        [loc.longitude, loc.latitude],
        [commuterLocation.longitude, commuterLocation.latitude]
      );

      if (route && map.current) {
        map.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: route,
          },
        });

        map.current.addLayer({
          id: routeLayerId,
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3b82f6",
            "line-width": 4,
            "line-opacity": 0.7,
          },
        });
      }
    };

    drawRoute();
  }, [commuterLocation]);

  // Clear markers when ride ends
  useEffect(() => {
    if (
      !activeRide ||
      (activeRide.status !== "accepted" && activeRide.status !== "inProgress")
    ) {
      if (commuterMarkerRef.current) {
        commuterMarkerRef.current.remove();
        commuterMarkerRef.current = null;
      }
      if (map.current?.getLayer(routeLayerId)) {
        map.current.removeLayer(routeLayerId);
      }
      if (map.current?.getSource("route")) {
        map.current.removeSource("route");
      }
    }
  }, [activeRide]);

  const addCommuterMarkers = useCallback(
    (rides: NonNullable<typeof pendingRides>) => {
      const mapInstance = map.current;
      if (!mapInstance) {
        return;
      }

      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();

      for (const ride of rides) {
        const pickupEl = createMarkerElement("#10B981", "📍");
        const pickupMarker = new maplibregl.Marker({ element: pickupEl })
          .setLngLat([ride.pickup.longitude, ride.pickup.latitude])
          .addTo(mapInstance);
        pickupEl.addEventListener("click", () => setSelectedRide(ride));
        markersRef.current.set(`pickup-${ride._id}`, pickupMarker);

        const dropoffEl = createMarkerElement("#EF4444", "📌");
        const dropoffMarker = new maplibregl.Marker({ element: dropoffEl })
          .setLngLat([ride.dropoff.longitude, ride.dropoff.latitude])
          .addTo(mapInstance);
        dropoffEl.addEventListener("click", () => setSelectedRide(ride));
        markersRef.current.set(`dropoff-${ride._id}`, dropoffMarker);
      }
    },
    []
  );

  // Update markers when pending rides change
  useEffect(() => {
    if (map.current && pendingRides) {
      addCommuterMarkers(pendingRides);
    }
  }, [pendingRides, addCommuterMarkers]);

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
    } catch {
      showToast("This ride was already accepted by another driver.", "error");
    }
  };

  const handlePickedUp = async () => {
    if (!(activeRide && sessionToken)) {
      return;
    }
    await updateRideStatusMutation({
      sessionToken,
      id: activeRide._id,
      status: "inProgress",
    });
  };

  const handleCompleteRide = async () => {
    if (!(activeRide && operatorProfile && sessionToken)) {
      return;
    }
    await completeRideMutation({
      sessionToken,
      id: activeRide._id,
      operatorId: operatorProfile._id,
    });
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleNavigate = (lat: number, lng: number) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank"
    );
  };

  return (
    <div className="relative h-screen w-full bg-slate-950">
      {/* Map */}
      <div className="relative h-full w-full" ref={mapContainer} />

      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-2 md:p-4">
        <Link
          className="inline-flex items-center gap-1.5 text-white text-xs transition hover:text-sky-400 md:text-sm"
          href="/operator"
        >
          <FaArrowLeft className="text-xs md:text-sm" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <button
          className="rounded-lg bg-sky-600 px-2 py-1 text-[10px] text-white md:px-3 md:py-1 md:text-xs"
          onClick={() => setShowChat((prev) => !prev)}
          type="button"
        >
          Chat {showChat ? "ON" : "OFF"}
        </button>
      </div>

      {/* Ride List Panel — bottom sheet on mobile, sidebar on desktop */}
      {!activeRide && (
        <div className="absolute right-0 bottom-16 left-0 z-20 touch-pan-y overflow-y-auto overscroll-contain border-[var(--border)] border-t bg-[var(--surface)] md:top-16 md:right-auto md:bottom-0 md:left-0 md:w-80 md:rounded-none md:border-t-0 md:border-r lg:top-20">
          {/* Mobile drag handle */}
          <div className="flex justify-center py-2 md:hidden">
            <div className="h-1.5 w-12 rounded-full bg-[var(--surface-muted)]" />
          </div>

          <div className="border-[var(--border)] border-b p-3 md:p-4 md:p-6">
            <h2 className="font-bold text-[var(--foreground)] text-lg md:text-xl lg:text-2xl">
              Available
            </h2>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs md:mt-1 md:text-sm">
              {pendingRides === undefined
                ? "Loading..."
                : `${pendingRides.length} waiting`}
            </p>
          </div>

          <div className="space-y-2 p-2 md:space-y-3 md:p-3 md:p-4">
            {pendingRides?.length === 0 && (
              <p className="py-4 text-center text-[var(--text-muted)] text-xs md:py-8 md:text-sm">
                No rides available
              </p>
            )}
            {pendingRides?.map((ride) => (
              <button
                className={`w-full rounded-xl border p-3 text-left transition md:rounded-2xl md:p-4 ${
                  selectedRide?._id === ride._id
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-[var(--border)] bg-[var(--surface-strong)]/50 hover:bg-[var(--surface-strong)]"
                }`}
                key={ride._id}
                onClick={() => setSelectedRide(ride)}
                type="button"
              >
                <div className="mb-1 flex items-start justify-between md:mb-2">
                  <div>
                    <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                      {ride.commuter?.name ?? "Unknown"}
                    </p>
                    <span className="mt-0.5 inline-block rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] capitalize md:mt-1 md:px-2 md:text-xs">
                      {ride.vehicleType ?? "standard"}
                    </span>
                  </div>
                  <span className="font-bold text-base text-sky-400 md:text-lg">
                    ₱{ride.fare}
                  </span>
                </div>

                <div className="space-y-1 text-[var(--foreground)] text-xs md:space-y-1.5 md:text-sm">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-green-500 text-sm md:text-base">
                      📍
                    </span>
                    <span className="truncate">{ride.pickup.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-red-500 text-sm md:text-base">
                      📌
                    </span>
                    <span className="truncate">{ride.dropoff.address}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ride Detail Panel — bottom sheet on mobile, right sidebar on md+ */}
      {selectedRide && !activeRide && (
        <div className="absolute right-0 bottom-0 left-0 z-30 max-h-[70dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:max-h-none md:rounded-none md:border-t-0 md:border-l lg:top-0 lg:right-0 lg:bottom-auto lg:left-auto lg:w-96">
          {/* Drag handle — mobile only */}
          <div className="flex justify-center py-2 md:hidden">
            <div className="h-1.5 w-12 rounded-full bg-[var(--surface-muted)]" />
          </div>

          <div className="border-[var(--border)] border-b p-3 md:p-4 md:p-6">
            <h3 className="font-bold text-[var(--foreground)] text-lg md:text-xl">
              Ride Details
            </h3>
          </div>

          <div className="space-y-3 p-3 md:space-y-4 md:p-4 md:p-6">
            {/* Passenger */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
              <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
                Passenger
              </p>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                  {selectedRide.commuter?.name ?? "Unknown"}
                </p>
                {selectedRide.commuter?.phone && (
                  <button
                    className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1.5 text-white text-xs transition hover:bg-sky-500 md:gap-2 md:px-3 md:py-2 md:text-sm"
                    onClick={() =>
                      selectedRide.commuter?.phone &&
                      handleCall(selectedRide.commuter.phone)
                    }
                    type="button"
                  >
                    <FaPhone className="text-[10px] md:text-sm" />
                    <span className="hidden md:inline">Call</span>
                  </button>
                )}
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-2 md:space-y-3">
              <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-green-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
                <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-1 md:text-xs">
                  Pickup
                </p>
                <p className="line-clamp-2 font-semibold text-[var(--foreground)] text-xs md:text-sm">
                  {selectedRide.pickup.address}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)] md:mt-1 md:text-xs">
                  {selectedRide.pickup.latitude.toFixed(4)},{" "}
                  {selectedRide.pickup.longitude.toFixed(4)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-red-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
                <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-1 md:text-xs">
                  Dropoff
                </p>
                <p className="line-clamp-2 font-semibold text-[var(--foreground)] text-xs md:text-sm">
                  {selectedRide.dropoff.address}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)] md:mt-1 md:text-xs">
                  {selectedRide.dropoff.latitude.toFixed(4)},{" "}
                  {selectedRide.dropoff.longitude.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Vehicle & Fare */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-2.5 text-center md:rounded-2xl md:p-3">
                <p className="mb-0.5 text-[10px] text-[var(--text-muted)] md:mb-1 md:text-xs">
                  Vehicle
                </p>
                <p className="font-semibold text-[var(--foreground)] text-xs capitalize md:text-sm">
                  {selectedRide.vehicleType ?? "standard"}
                </p>
              </div>
              <div className="rounded-xl border border-sky-500 bg-sky-500/10 p-2.5 text-center md:rounded-2xl md:p-3">
                <p className="mb-0.5 text-[10px] text-[var(--text-muted)] md:mb-1 md:text-xs">
                  Fare
                </p>
                <p className="font-bold text-base text-sky-400 md:text-xl">
                  ₱{selectedRide.fare}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 md:space-y-3">
              <button
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2.5 font-semibold text-sm text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] md:gap-2 md:rounded-2xl md:px-4 md:py-3 md:text-base"
                disabled={!operatorProfile}
                onClick={() => handleAcceptRide(selectedRide._id)}
                type="button"
              >
                <FaCheckCircle className="text-sm md:text-base" />
                Accept
              </button>
              <button
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 font-semibold text-[var(--foreground)] text-xs transition hover:bg-[var(--surface-muted)] md:rounded-2xl md:px-4 md:py-2.5 md:text-sm"
                onClick={() =>
                  handleNavigate(
                    selectedRide.pickup.latitude,
                    selectedRide.pickup.longitude
                  )
                }
                type="button"
              >
                <FaMapMarkerAlt className="mr-1.5 inline text-xs md:mr-2 md:text-sm" />
                Navigate
              </button>
              <button
                className="w-full rounded-xl border border-[var(--border)] py-1.5 text-[var(--text-muted)] text-xs transition hover:text-[var(--foreground)] md:rounded-2xl md:py-2 md:text-sm"
                onClick={() => setSelectedRide(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Active Ride Panel — bottom bar */}
      {activeRide && (
        <CurrentRidePanel
          onCall={handleCall}
          onComplete={handleCompleteRide}
          onPickedUp={handlePickedUp}
          partner={activeRideCommuter}
          ride={activeRide}
        />
      )}

      {showChat && activeRide && sessionToken && (
        <ChatBubble
          partnerName={activeRideCommuter?.name ?? "Passenger"}
          partnerRole="commuter"
          positionOverride="bottom-40 right-4 md:bottom-32"
          rideId={activeRide._id}
          sessionToken={sessionToken}
        />
      )}
    </div>
  );
}
