"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  FaCheckCircle,
  FaPhone,
  FaSignOutAlt,
  FaToggleOff,
  FaToggleOn,
  FaUserTie,
} from "react-icons/fa";
import { useAuth } from "@/lib/authContext";
import { useTheme } from "@/lib/themeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export default function DriverPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const { user, logout, sessionToken, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

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

  // Role guard — redirect non-operators
  useEffect(() => {
    if (!(authLoading || user)) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "operator") {
      router.push(user.role === "admin" ? "/admin" : "/Commuters");
    }
  }, [user, authLoading, router]);

  // Seed online state from Convex on load
  useEffect(() => {
    if (operatorProfile) {
      setOnline(operatorProfile.isAvailable);
    }
  }, [operatorProfile?._id, operatorProfile]);

  // Map init
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      const mapStyle = theme === "dark"
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
            setDriverLocation([longitude, latitude]);
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
    }
  }, []);

  const addCommuterMarkers = (rides: NonNullable<typeof pendingRides>) => {
    if (!map.current) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    rides.forEach((ride) => {
      const pickupEl = document.createElement("div");
      pickupEl.style.width = "30px";
      pickupEl.style.height = "30px";
      pickupEl.style.backgroundColor = "#10B981";
      pickupEl.style.borderRadius = "50%";
      pickupEl.style.border = "3px solid white";
      pickupEl.style.boxShadow = "0 0 8px rgba(16, 185, 129, 0.5)";
      pickupEl.style.cursor = "pointer";
      pickupEl.style.display = "flex";
      pickupEl.style.alignItems = "center";
      pickupEl.style.justifyContent = "center";
      pickupEl.style.fontSize = "16px";
      pickupEl.innerHTML = "📍";

      const pickupMarker = new maplibregl.Marker({ element: pickupEl })
        .setLngLat([ride.pickup.longitude, ride.pickup.latitude])
        .addTo(map.current!);

      pickupEl.addEventListener("click", () => setSelectedRide(ride));
      markersRef.current.set(`pickup-${ride._id}`, pickupMarker);

      const dropoffEl = document.createElement("div");
      dropoffEl.style.width = "30px";
      dropoffEl.style.height = "30px";
      dropoffEl.style.backgroundColor = "#EF4444";
      dropoffEl.style.borderRadius = "50%";
      dropoffEl.style.border = "3px solid white";
      dropoffEl.style.boxShadow = "0 0 8px rgba(239, 68, 68, 0.5)";
      dropoffEl.style.cursor = "pointer";
      dropoffEl.style.display = "flex";
      dropoffEl.style.alignItems = "center";
      dropoffEl.style.justifyContent = "center";
      dropoffEl.style.fontSize = "16px";
      dropoffEl.innerHTML = "📌";

      const dropoffMarker = new maplibregl.Marker({ element: dropoffEl })
        .setLngLat([ride.dropoff.longitude, ride.dropoff.latitude])
        .addTo(map.current!);

      dropoffEl.addEventListener("click", () => setSelectedRide(ride));
      markersRef.current.set(`dropoff-${ride._id}`, dropoffMarker);
    });
  };

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
      alert("Complete your current ride before going offline.");
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
      alert("This ride was already accepted by another driver.");
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

  if (authLoading || !user || user.role !== "operator") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-slate-950">
      {/* Map */}
      <div className="h-full w-full" ref={mapContainer} />

      {/* Header - Desktop only */}
      <div className="absolute top-0 right-0 left-0 z-10 hidden bg-gradient-to-b from-black/50 to-transparent p-4 md:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-white">
              <FaUserTie className="text-lg" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-white">
                {operatorProfile?.name ?? "Loading..."}
              </h1>
              <p className="text-[var(--text-muted)] text-sm">
                {operatorProfile?.vehicleInfo.model ?? ""} •{" "}
                {operatorProfile?.vehicleInfo.plateNumber ?? ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Link
              className="btn btn-secondary rounded-full px-3 py-2 text-sm sm:px-4"
              href="/operator/profile"
            >
              <FaUserTie />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <button
              className="btn btn-secondary rounded-full px-3 py-2 text-rose-400 text-sm hover:text-rose-300 sm:px-4"
              onClick={logout}
            >
              <FaSignOutAlt />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              className={`btn rounded-full px-3 py-2 text-sm sm:px-4 ${online ? "btn-success" : "btn-secondary"}`}
              onClick={handleToggleOnline}
            >
              {online ? <FaToggleOn /> : <FaToggleOff />}
              {online ? "Online" : "Offline"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: Bottom navigation bar - larger for touch accessibility */}
      <div className="fixed right-0 bottom-0 left-0 z-20 flex items-center justify-between border-[var(--border)] border-t bg-[var(--surface)]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link
          href="/operator/profile"
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
            theme === "light"
              ? "border-sky-600 bg-white text-slate-800"
              : "border-sky-500/50 bg-slate-800 text-white"
          }`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-base ${
            theme === "light" ? "bg-sky-100 text-sky-700" : "bg-slate-700 text-white"
          }`}>
            <FaUserTie />
          </div>
          <div className="min-w-0">
            <p className={`truncate font-semibold text-sm ${
              theme === "light" ? "text-slate-900" : "text-white"
            }`}>
              {operatorProfile?.name ?? "Loading..."}
            </p>
            <p className={`truncate text-xs ${
              theme === "light" ? "text-slate-500" : "text-slate-400"
            }`}>
              {operatorProfile?.vehicleInfo.plateNumber ?? ""}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <div className={`flex h-11 items-center justify-center rounded-xl border-2 px-2 ${
            theme === "light"
              ? "border-slate-300 bg-white"
              : "border-slate-500 bg-slate-700"
          }`}>
            <ThemeToggle />
          </div>
          <button
            className={`inline-flex h-11 items-center justify-center rounded-xl border-2 px-4 ${
              theme === "light"
                ? "border-rose-500 bg-white text-rose-600"
                : "border-rose-400 bg-rose-600 text-white"
            }`}
            onClick={logout}
          >
            <FaSignOutAlt className="text-sm" />
          </button>
          <button
            className={`inline-flex h-11 items-center justify-center gap-1 rounded-xl px-4 font-semibold text-sm ${
              online
                ? theme === "light"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-emerald-400 bg-emerald-600 text-white"
                : theme === "light"
                  ? "border-slate-400 bg-slate-200 text-slate-700"
                  : "border-slate-400 bg-slate-700 text-slate-200"
            }`}
            onClick={handleToggleOnline}
          >
            {online ? (
              <FaToggleOn className="text-base" />
            ) : (
              <FaToggleOff className="text-base" />
            )}
            <span>{online ? "Online" : "Offline"}</span>
          </button>
        </div>
      </div>

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
        <div className="absolute right-0 bottom-20 left-0 z-20 max-h-[55dvh] touch-pan-y overflow-y-auto overscroll-contain border-[var(--border)] border-t-2 bg-[var(--surface)] md:top-32 md:right-auto md:bottom-0 md:left-0 md:h-full md:max-h-none md:w-80 md:rounded-none md:border-t-0 md:border-r">
          {/* Mobile drag handle - larger */}
          <div className="flex justify-center py-3 md:hidden">
            <div className="h-2 w-16 rounded-full bg-[var(--surface-muted)]" />
          </div>

          <div className="border-[var(--border)] border-b p-4 md:p-6">
            <h2 className="font-bold text-[var(--foreground)] text-xl md:text-2xl">
              Available Rides
            </h2>
            <p className="mt-1 text-[var(--text-muted)] text-sm md:mt-1 md:text-sm">
              {pendingRides === undefined
                ? "Loading..."
                : `${pendingRides.length} waiting`}
            </p>
          </div>

          <div className="space-y-3 p-3 md:space-y-3 md:p-4">
            {pendingRides === undefined && (
              <div className="py-6 text-center text-[var(--text-muted)] text-sm md:py-8 md:text-sm">
                Loading rides...
              </div>
            )}
            {pendingRides?.length === 0 && (
              <div className="py-6 text-center text-[var(--text-muted)] text-sm md:py-8 md:text-sm">
                No rides available
              </div>
            )}
            {pendingRides?.map((ride) => (
              <button
                className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                  selectedRide?._id === ride._id
                    ? "border-sky-400 bg-sky-500/20 shadow-lg shadow-sky-500/20"
                    : "border-[var(--border)] bg-[var(--surface-strong)]/70 hover:border-sky-500/50 hover:bg-[var(--surface-strong)]"
                }`}
                key={ride._id}
                onClick={() => setSelectedRide(ride)}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-bold text-[var(--foreground)] text-base">
                      {ride.commuter?.name ?? "Unknown"}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[var(--text-muted)] text-xs">
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 capitalize">
                        {ride.vehicleType}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-sky-400 text-xl">
                    ₱{ride.fare}
                  </span>
                </div>

                <div className="space-y-2 text-[var(--foreground)] text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-lg">📍</span>
                    <span className="truncate">{ride.pickup.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-red-500">📌</span>
                    <span className="truncate">{ride.dropoff.address}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ride Details Panel — bottom sheet on mobile, sidebar on desktop */}
      {selectedRide && (
        <div className="absolute right-0 bottom-0 left-0 z-30 max-h-[70dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:absolute md:top-0 md:right-0 md:bottom-auto md:left-auto md:h-full md:max-h-none md:w-96 md:rounded-none md:border-t-0 md:border-l">
          {/* Drag handle — mobile only */}
          <div className="flex justify-center py-2 md:hidden">
            <div className="h-1.5 w-12 rounded-full bg-[var(--surface-muted)]" />
          </div>

          <div className="border-[var(--border)] border-b p-4 md:p-6">
            <h3 className="font-bold text-[var(--foreground)] text-xl">
              Ride Details
            </h3>
          </div>

          <div className="space-y-4 p-3 md:space-y-6 md:p-6">
            {/* Passenger Info */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
              <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
                Passenger
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                    {selectedRide.commuter?.name ?? "Unknown"}
                  </p>
                </div>
                {selectedRide.commuter?.phone && (
                  <button
                    className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1.5 text-white text-xs transition hover:bg-sky-500 md:gap-2 md:px-3 md:py-2 md:text-sm"
                    onClick={() =>
                      selectedRide.commuter?.phone &&
                      handleCall(selectedRide.commuter.phone)
                    }
                  >
                    <FaPhone className="text-[10px] md:text-sm" />
                    <span className="hidden md:inline">Call</span>
                  </button>
                )}
              </div>
            </div>

            {/* Location Info */}
            <div className="space-y-2 md:space-y-3">
              <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-green-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
                <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
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
                <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
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
                  {selectedRide.vehicleType}
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

            {/* Accept Button - Large and prominent */}
            <button
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-green-600 px-4 font-bold text-lg text-white transition hover:bg-green-500 hover:shadow-green-500/30 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
              disabled={!operatorProfile}
              onClick={() => handleAcceptRide(selectedRide._id)}
            >
              <FaCheckCircle className="text-xl" />
              Accept Ride
            </button>

            <button
              className="w-full rounded-xl border border-[var(--border)] py-2 text-[var(--text-muted)] text-xs transition hover:text-[var(--foreground)] md:rounded-2xl md:py-2 md:text-sm"
              onClick={() => setSelectedRide(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Current Ride Panel */}
      {activeRide && (
        <div className="absolute right-0 bottom-20 border-[var(--border)] border-t-2 bg-[var(--surface)] p-4 md:bottom-0 md:p-6">
          <div className="mx-auto max-w-md">
            <h3 className="mb-2 font-semibold text-[var(--foreground)] text-sm md:mb-4 md:text-lg">
              Current Ride
            </h3>

            <div className="rounded-xl bg-[var(--surface-strong)] p-3 md:mb-4 md:rounded-2xl md:p-4">
              <div className="mb-2 flex items-start justify-between gap-2 md:mb-3 md:flex-row">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                    {activeRideCommuter?.name ?? "Loading..."}
                  </p>
                  <p className="line-clamp-1 text-[10px] text-[var(--text-muted)] md:text-sm">
                    {activeRide.pickup.address} → {activeRide.dropoff.address}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-semibold text-[10px] md:px-3 md:py-1 md:text-xs ${
                    activeRide.status === "accepted"
                      ? "bg-blue-500/20 text-blue-400"
                      : activeRide.status === "inProgress"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {activeRideStatusLabel[activeRide.status] ??
                    activeRide.status.toUpperCase()}
                </span>
              </div>

              <div className="flex gap-3">
                {activeRideCommuter?.phone && (
                  <button
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-500/50 bg-sky-600 px-4 font-semibold text-white transition hover:bg-sky-500"
                    onClick={() => handleCall(activeRideCommuter.phone)}
                  >
                    <FaPhone className="text-base" />
                    Call
                  </button>
                )}
                <button
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-green-500/50 bg-green-600 px-4 font-semibold text-white transition hover:bg-green-500"
                  onClick={
                    activeRide.status === "accepted"
                      ? handlePickedUp
                      : handleCompleteRide
                  }
                >
                  {activeRide.status === "accepted" ? "Picked Up" : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
