"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { createMarkerElement } from "@/lib/mapMarkers";
import { useTheme } from "@/lib/themeContext";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CurrentRidePanel } from "./CurrentRidePanel";
import { OperatorHeader } from "./OperatorHeader";
import { RideDetailsPanel } from "./RideDetailsPanel";
import { RideQueue } from "./RideQueue";

function onlineToggleClass(theme: string): string {
  return theme === "light"
    ? "border-emerald-500 bg-emerald-500 text-white"
    : "border-emerald-400 bg-emerald-600 text-white";
}

function offlineToggleClass(theme: string): string {
  return theme === "light"
    ? "border-slate-400 bg-slate-200 text-slate-700"
    : "border-slate-400 bg-slate-700 text-slate-200";
}

function rideStatusBadgeClass(status: string): string {
  if (status === "accepted") {
    return "bg-blue-500/20 text-blue-400";
  }
  if (status === "inProgress") {
    return "bg-yellow-500/20 text-yellow-400";
  }
  return "bg-green-500/20 text-green-400";
}

export default function DriverPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const { logout, sessionToken } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();

  const [selectedRide, setSelectedRide] = useState<
    NonNullable<typeof pendingRides>[number] | null
  >(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(
    null
  );
  const [online, setOnline] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);

  // The signed-in driver's own profile
  const operatorProfile = useQuery(
    api.operators.getSelf,
    sessionToken ? { sessionToken } : "skip"
  );

  // Real-time list of pending rides with commuter info
  const pendingRides = useQuery(
    api.rides.listPendingWithCommuter,
    sessionToken ? { sessionToken } : "skip"
  );

  // The driver's current active ride plus a projected view of the passenger
  const activeTrip = useQuery(
    api.rides.getActiveForMe,
    sessionToken ? { sessionToken } : "skip"
  );
  const activeRide = activeTrip?.ride ?? null;
  const activeRideCommuter =
    activeTrip?.partner?.kind === "commuter" ? activeTrip.partner : null;

  const acceptRideMutation = useMutation(api.rides.accept);
  const setAvailabilityMutation = useMutation(api.operators.setAvailability);
  const updateRideStatusMutation = useMutation(api.rides.updateStatus);
  const completeRideMutation = useMutation(api.rides.complete);

  // Seed online state from Convex on load
  useEffect(() => {
    if (operatorProfile) {
      setOnline(operatorProfile.isAvailable);
    }
  }, [operatorProfile?._id, operatorProfile]);

  // Map init
  useEffect(() => {
    if (!map.current && mapContainer.current) {
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

      let watchId: number | null = null;
      let hasCentred = false;

      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            setDriverLocation([longitude, latitude]);
            if (userMarkerRef.current) {
              userMarkerRef.current.setLngLat([longitude, latitude]);
            }
            // Centre the map on the first fix only, otherwise the camera is
            // dragged around by every GPS sample.
            if (!hasCentred) {
              hasCentred = true;
              map.current?.flyTo({ center: [longitude, latitude], zoom: 13 });
            }
          },
          (error) => console.error(error),
          { enableHighAccuracy: true }
        );
      }

      return () => {
        // Leaving the watcher running keeps the GPS radio on and keeps
        // writing to a component that is no longer mounted.
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        map.current?.remove();
        map.current = null;
      };
    }
  }, [theme]);

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

  // Update map markers when pending rides change
  useEffect(() => {
    if (map.current && online && pendingRides) {
      addCommuterMarkers(pendingRides);
    }
  }, [online, pendingRides, addCommuterMarkers]);

  const handleToggleOnline = async () => {
    if (!(operatorProfile && sessionToken)) {
      return;
    }
    if (activeRide && online) {
      showToast("Complete your current ride before going offline.", "error");
      return;
    }
    const newOnline = !online;
    setOnline(newOnline);
    await setAvailabilityMutation({
      sessionToken,
      id: operatorProfile._id,
      isAvailable: newOnline,
      currentLocation: driverLocation
        ? { latitude: driverLocation[1], longitude: driverLocation[0] }
        : undefined,
    });
  };

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

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
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
    setEarnings((prev) => prev + (activeRide.fare ?? 0));
    setRidesToday((prev) => prev + 1);
  };

  const activeRideStatusLabel: Record<string, string> = {
    accepted: "ACCEPTED",
    inProgress: "IN PROGRESS",
    completed: "COMPLETED",
  };

  return (
    <div className="relative h-screen w-full bg-slate-950">
      {/* Map */}
      <div className="h-full w-full" ref={mapContainer} />

      {/* Header - Desktop only */}
      <OperatorHeader
        offlineClassName={offlineToggleClass(theme)}
        onLogout={logout}
        online={online}
        onlineClassName={onlineToggleClass(theme)}
        onToggleOnline={handleToggleOnline}
        profile={operatorProfile}
        theme={theme}
      />

      {/* Status Overlay - More visible */}
      {online && !activeRide && (
        <div className="absolute top-20 left-4 z-10 rounded-full border-2 border-emerald-400 bg-emerald-500 px-4 py-2 font-bold text-slate-950 text-sm">
          🔍 Looking for rides...
        </div>
      )}

      {/* Earnings & Stats - Desktop only */}
      <div className="absolute top-20 right-4 z-10 hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 sm:block sm:p-4">
        <div className="text-center">
          <p className="mb-1 text-[var(--text-muted)] text-xs">
            Today's Earnings
          </p>
          <p className="font-bold text-sky-400 text-xl">₱{earnings}</p>
          <p className="mt-1 text-[var(--text-muted)] text-xs">
            {ridesToday} rides
          </p>
        </div>
      </div>

      {/* Ride List Panel — larger bottom sheet on mobile, sidebar on desktop */}
      {online && !activeRide && (
        <RideQueue
          onSelect={(ride) => setSelectedRide(ride)}
          rides={pendingRides}
        />
      )}

      {/* Ride Details Panel — bottom sheet on mobile, sidebar on desktop */}
      {selectedRide && (
        <RideDetailsPanel
          canAccept={Boolean(operatorProfile)}
          onAccept={handleAcceptRide}
          onCall={handleCall}
          onClose={() => setSelectedRide(null)}
          ride={selectedRide}
        />
      )}

      {activeRide && (
        <CurrentRidePanel
          activeRide={activeRide}
          onCall={handleCall}
          onComplete={handleCompleteRide}
          onPickedUp={handlePickedUp}
          partner={activeRideCommuter}
          statusClassName={rideStatusBadgeClass}
          statusLabels={activeRideStatusLabel}
        />
      )}

      {/* OFFLINE STATE - Larger panel */}
      {!(online || activeRide) && (
        <div className="absolute bottom-20 flex w-full justify-center md:bottom-0">
          <div className="w-full max-w-md rounded-t-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-xl md:rounded-t-3xl md:p-4">
            <p className="mb-2 font-semibold text-[var(--text-muted)] text-base md:mb-2 md:text-sm">
              You're currently offline
            </p>
            <p className="text-[var(--text-muted)] text-sm">
              Go online to start receiving rides
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
