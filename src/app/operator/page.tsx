"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  FaCheckCircle,
  FaPhone,
  FaSignOutAlt,
  FaToggleOff,
  FaToggleOn,
  FaUserTie,
} from "react-icons/fa";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";

export default function DriverPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const { user, logout, sessionToken, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [selectedRide, setSelectedRide] = useState<
    NonNullable<typeof pendingRides>[number] | null
  >(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [online, setOnline] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);

  // Resolve operator profile from userId
  const operatorProfile = useQuery(
    api.operators.getByUserId,
    user ? { userId: user.userId as Id<"users"> } : "skip"
  );

  // Real-time list of pending rides with commuter info
  const pendingRides = useQuery(api.rides.listPendingWithCommuter);

  // Operator's current active ride (restores state on page reload)
  const activeRide = useQuery(
    api.rides.getActiveByOperator,
    operatorProfile ? { operatorId: operatorProfile._id } : "skip"
  );

  // Commuter details for the active ride
  const activeRideCommuter = useQuery(
    api.commuters.getById,
    activeRide?.commuterId ? { id: activeRide.commuterId } : "skip"
  );

  const acceptRideMutation = useMutation(api.rides.accept);
  const setAvailabilityMutation = useMutation(api.operators.setAvailability);
  const updateRideStatusMutation = useMutation(api.rides.updateStatus);
  const completeRideMutation = useMutation(api.rides.complete);

  // Role guard — redirect non-operators
  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (!authLoading && user && user.role !== "operator") {
      router.push(user.role === "admin" ? "/admin" : "/Commuters");
    }
  }, [user, authLoading, router]);

  // Seed online state from Convex on load
  useEffect(() => {
    if (operatorProfile) {
      setOnline(operatorProfile.isAvailable);
    }
  }, [operatorProfile?._id]);

  // Map init
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/bright",
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

  // Update map markers when pending rides change
  useEffect(() => {
    if (map.current && online && pendingRides) {
      addCommuterMarkers(pendingRides);
    }
  }, [online, pendingRides]);

  const addCommuterMarkers = (rides: NonNullable<typeof pendingRides>) => {
    if (!map.current) return;

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

  const handleToggleOnline = async () => {
    if (!operatorProfile || !sessionToken) return;
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
    if (!operatorProfile || !sessionToken) return;
    try {
      await acceptRideMutation({ sessionToken, id: rideId, operatorId: operatorProfile._id });
      setSelectedRide(null);
    } catch {
      alert("This ride was already accepted by another driver.");
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handlePickedUp = async () => {
    if (!activeRide || !sessionToken) return;
    await updateRideStatusMutation({ sessionToken, id: activeRide._id, status: "inProgress" });
  };

  const handleCompleteRide = async () => {
    if (!activeRide || !operatorProfile || !sessionToken) return;
    await completeRideMutation({ sessionToken, id: activeRide._id, operatorId: operatorProfile._id });
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-slate-950">
      {/* Map */}
      <div className="h-full w-full" ref={mapContainer} />

      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-700 text-white">
              <FaUserTie className="text-lg" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-white">
                {operatorProfile?.name ?? "Loading..."}
              </h1>
              <p className="text-slate-400 text-sm">
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

      {/* Status Overlay */}
      {online && !activeRide && (
        <div className="absolute top-36 left-4 rounded-full bg-emerald-500 px-3 py-1 font-semibold text-slate-950 text-sm sm:top-20">
          Looking for rides...
        </div>
      )}

      {/* Earnings & Stats */}
      <div className="absolute top-36 right-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-3 sm:top-20 sm:p-4">
        <div className="text-center">
          <p className="mb-1 text-slate-400 text-xs">Today's Earnings</p>
          <p className="font-bold text-sky-400 text-xl">₱{earnings}</p>
          <p className="mt-1 text-slate-400 text-xs">{ridesToday} rides</p>
        </div>
      </div>

      {/* Ride List Panel — only when online and no active ride */}
      {online && !activeRide && (
        <div className="absolute top-32 bottom-0 left-0 z-20 w-80 touch-pan-y overflow-y-auto overscroll-contain border-slate-800 border-r bg-slate-900">
          <div className="border-slate-800 border-b p-6">
            <h2 className="font-bold text-2xl text-slate-100">Available Rides</h2>
            <p className="mt-1 text-slate-400 text-sm">
              {pendingRides === undefined
                ? "Loading..."
                : `${pendingRides.length} commuters waiting`}
            </p>
          </div>

          <div className="space-y-3 p-4">
            {pendingRides === undefined && (
              <div className="py-8 text-center text-slate-400 text-sm">Loading rides...</div>
            )}
            {pendingRides?.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-sm">
                No rides available right now
              </div>
            )}
            {pendingRides?.map((ride) => (
              <button
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedRide?._id === ride._id
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                }`}
                key={ride._id}
                onClick={() => setSelectedRide(ride)}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {ride.commuter?.name ?? "Unknown"}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-slate-400 text-xs">
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 capitalize">
                        {ride.vehicleType}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-lg text-sky-400">₱{ride.fare}</span>
                </div>

                <div className="space-y-2 text-slate-300 text-sm">
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

      {/* Ride Details Panel */}
      {selectedRide && (
        <div className="absolute top-0 right-0 bottom-0 z-20 w-96 touch-pan-y overflow-y-auto overscroll-contain border-slate-800 border-l bg-slate-900 shadow-2xl">
          <div className="border-slate-800 border-b p-6">
            <h3 className="font-bold text-slate-100 text-xl">Ride Details</h3>
          </div>

          <div className="space-y-6 p-6">
            {/* Passenger Info */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">Passenger</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    {selectedRide.commuter?.name ?? "Unknown"}
                  </p>
                </div>
                {selectedRide.commuter?.phone && (
                  <button
                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-white transition hover:bg-sky-500"
                    onClick={() => handleCall(selectedRide.commuter!.phone)}
                  >
                    <FaPhone className="text-sm" />
                    Call
                  </button>
                )}
              </div>
            </div>

            {/* Location Info */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-700 border-l-4 border-l-green-500 bg-slate-800/50 p-4">
                <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">
                  Pickup Location
                </p>
                <p className="font-semibold text-slate-100">{selectedRide.pickup.address}</p>
                <p className="mt-1 text-slate-400 text-xs">
                  {selectedRide.pickup.latitude.toFixed(5)},{" "}
                  {selectedRide.pickup.longitude.toFixed(5)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 border-l-4 border-l-red-500 bg-slate-800/50 p-4">
                <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">
                  Dropoff Location
                </p>
                <p className="font-semibold text-slate-100">{selectedRide.dropoff.address}</p>
                <p className="mt-1 text-slate-400 text-xs">
                  {selectedRide.dropoff.latitude.toFixed(5)},{" "}
                  {selectedRide.dropoff.longitude.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Vehicle & Fare */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3 text-center">
                <p className="mb-1 text-slate-500 text-xs">Vehicle Type</p>
                <p className="font-semibold capitalize text-slate-100">
                  {selectedRide.vehicleType}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-500 bg-sky-500/10 p-3 text-center">
                <p className="mb-1 text-slate-400 text-xs">Fare</p>
                <p className="font-bold text-sky-400 text-xl">₱{selectedRide.fare}</p>
              </div>
            </div>

            {/* Accept Button */}
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              disabled={!operatorProfile}
              onClick={() => handleAcceptRide(selectedRide._id)}
            >
              <FaCheckCircle />
              Accept Ride
            </button>

            <button
              className="w-full rounded-2xl border border-slate-700 py-2 text-slate-400 text-sm transition hover:text-slate-200"
              onClick={() => setSelectedRide(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Current Ride Panel */}
      {activeRide && (
        <div className="absolute right-0 bottom-0 left-0 border-slate-800 border-t bg-slate-900 p-6">
          <div className="mx-auto max-w-md">
            <h3 className="mb-4 font-semibold text-lg text-slate-100">Current Ride</h3>

            <div className="mb-4 rounded-2xl bg-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    {activeRideCommuter?.name ?? "Loading..."}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {activeRide.pickup.address} → {activeRide.dropoff.address}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-semibold text-xs ${
                    activeRide.status === "accepted"
                      ? "bg-blue-500/20 text-blue-400"
                      : activeRide.status === "inProgress"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {activeRideStatusLabel[activeRide.status] ?? activeRide.status.toUpperCase()}
                </span>
              </div>

              <div className="flex gap-2">
                {activeRideCommuter?.phone && (
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-white transition hover:bg-sky-500"
                    onClick={() => handleCall(activeRideCommuter.phone)}
                  >
                    <FaPhone className="text-sm" />
                    Call
                  </button>
                )}
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white transition hover:bg-green-500"
                  onClick={activeRide.status === "accepted" ? handlePickedUp : handleCompleteRide}
                >
                  {activeRide.status === "accepted" ? "Picked Up" : "Complete Ride"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE STATE */}
      {!(online || activeRide) && (
        <div className="absolute bottom-0 flex w-full justify-center">
          <div className="w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-900 p-4 text-center shadow-xl">
            <p className="mb-2 text-slate-400">You're currently offline</p>
            <p className="text-slate-500 text-sm">
              Go online to start receiving ride requests
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
