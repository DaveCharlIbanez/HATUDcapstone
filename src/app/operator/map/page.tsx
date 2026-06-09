"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaPhone,
} from "react-icons/fa";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";


export default function OperatorMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const { user, sessionToken, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const operatorProfile = useQuery(
    api.operators.getByUserId,
    user ? { userId: user.userId as Id<"users"> } : "skip"
  );
  const pendingRides = useQuery(api.rides.listPendingWithCommuter);
  const activeRide = useQuery(
    api.rides.getActiveByOperator,
    operatorProfile ? { operatorId: operatorProfile._id } : "skip"
  );
  const activeRideCommuter = useQuery(
    api.commuters.getById,
    activeRide?.commuterId ? { id: activeRide.commuterId } : "skip"
  );

  const acceptRideMutation = useMutation(api.rides.accept);
  const updateRideStatusMutation = useMutation(api.rides.updateStatus);
  const completeRideMutation = useMutation(api.rides.complete);

  type PendingRide = NonNullable<typeof pendingRides>[number];
  const [selectedRide, setSelectedRide] = useState<PendingRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);

  // Role guard
  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (!authLoading && user && user.role !== "operator") {
      router.push(user.role === "admin" ? "/admin" : "/Commuters");
    }
  }, [user, authLoading, router]);

  // Map init
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

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
  }, []);

  // Update markers when pending rides change
  useEffect(() => {
    if (map.current && pendingRides) {
      addCommuterMarkers(pendingRides);
    }
  }, [pendingRides]);

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

  const handleAcceptRide = async (rideId: Id<"rides">) => {
    if (!operatorProfile || !sessionToken) return;
    try {
      await acceptRideMutation({ sessionToken, id: rideId, operatorId: operatorProfile._id });
      setSelectedRide(null);
    } catch {
      alert("This ride was already accepted by another driver.");
    }
  };

  const handlePickedUp = async () => {
    if (!activeRide || !sessionToken) return;
    await updateRideStatusMutation({ sessionToken, id: activeRide._id, status: "inProgress" });
  };

  const handleCompleteRide = async () => {
    if (!activeRide || !operatorProfile || !sessionToken) return;
    await completeRideMutation({ sessionToken, id: activeRide._id, operatorId: operatorProfile._id });
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
      <div className="h-full w-full" ref={mapContainer} />

      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
        <Link
          className="inline-flex items-center gap-2 text-white transition hover:text-sky-400"
          href="/operator"
        >
          <FaArrowLeft /> Back to Dashboard
        </Link>
      </div>

      {/* Ride List Panel — full width on mobile, fixed sidebar on md+ */}
      {!activeRide && (
        <div className="absolute top-16 bottom-0 left-0 z-20 w-full touch-pan-y overflow-y-auto overscroll-contain border-slate-800 border-r bg-slate-900 md:top-20 md:w-80">
          <div className="border-slate-800 border-b p-4 sm:p-6">
            <h2 className="font-bold text-xl text-slate-100 sm:text-2xl">Available Rides</h2>
            <p className="mt-1 text-slate-400 text-sm">
              {pendingRides === undefined
                ? "Loading..."
                : `${pendingRides.length} commuters waiting`}
            </p>
          </div>

          <div className="space-y-3 p-3 sm:p-4">
            {pendingRides?.length === 0 && (
              <p className="py-8 text-center text-slate-500 text-sm">No rides available right now</p>
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
                    <span className="mt-1 inline-block rounded-full bg-slate-700 px-2 py-0.5 text-slate-400 text-xs capitalize">
                      {ride.vehicleType ?? "economy"}
                    </span>
                  </div>
                  <span className="font-bold text-lg text-sky-400">₱{ride.fare}</span>
                </div>

                <div className="space-y-1.5 text-slate-300 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">📍</span>
                    <span className="truncate">{ride.pickup.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">📌</span>
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
        <div className="absolute bottom-0 left-0 right-0 z-30 max-h-[75dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-3xl border border-slate-800 bg-slate-900 shadow-2xl md:bottom-auto md:top-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none md:border-l md:border-t-0">
          {/* Drag handle — mobile only */}
          <div className="flex justify-center py-3 md:hidden">
            <div className="h-1.5 w-12 rounded-full bg-slate-700" />
          </div>

          <div className="border-slate-800 border-b p-4 sm:p-6">
            <h3 className="font-bold text-slate-100 text-lg sm:text-xl">Ride Details</h3>
          </div>

          <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            {/* Passenger */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">Passenger</p>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">
                  {selectedRide.commuter?.name ?? "Unknown"}
                </p>
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

            {/* Locations */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-700 border-l-4 border-l-green-500 bg-slate-800/50 p-4">
                <p className="mb-1 text-slate-500 text-xs uppercase tracking-widest">Pickup</p>
                <p className="font-semibold text-slate-100">{selectedRide.pickup.address}</p>
                <p className="mt-1 text-slate-400 text-xs">
                  {selectedRide.pickup.latitude.toFixed(5)}, {selectedRide.pickup.longitude.toFixed(5)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 border-l-4 border-l-red-500 bg-slate-800/50 p-4">
                <p className="mb-1 text-slate-500 text-xs uppercase tracking-widest">Dropoff</p>
                <p className="font-semibold text-slate-100">{selectedRide.dropoff.address}</p>
                <p className="mt-1 text-slate-400 text-xs">
                  {selectedRide.dropoff.latitude.toFixed(5)}, {selectedRide.dropoff.longitude.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Vehicle & Fare */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3 text-center">
                <p className="mb-1 text-slate-500 text-xs">Vehicle</p>
                <p className="font-semibold capitalize text-slate-100">
                  {selectedRide.vehicleType ?? "Economy"}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-500 bg-sky-500/10 p-3 text-center">
                <p className="mb-1 text-slate-400 text-xs">Fare</p>
                <p className="font-bold text-sky-400 text-xl">₱{selectedRide.fare}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                disabled={!operatorProfile}
                onClick={() => handleAcceptRide(selectedRide._id)}
              >
                <FaCheckCircle />
                Accept Ride
              </button>
              <button
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-semibold text-slate-300 text-sm transition hover:bg-slate-700"
                onClick={() =>
                  handleNavigate(selectedRide.pickup.latitude, selectedRide.pickup.longitude)
                }
              >
                <FaMapMarkerAlt className="mr-2 inline" />
                Navigate to Pickup
              </button>
              <button
                className="w-full rounded-xl border border-slate-700 py-2 text-slate-400 text-sm transition hover:text-slate-200"
                onClick={() => setSelectedRide(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Active Ride Panel — bottom bar */}
      {activeRide && (
        <div className="absolute right-0 bottom-0 left-0 z-30 border-slate-800 border-t bg-slate-900 p-4 sm:p-6">
          <div className="mx-auto max-w-lg">
            <h3 className="mb-3 font-semibold text-slate-100">Current Ride</h3>
            <div className="rounded-2xl bg-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100">
                    {activeRideCommuter?.name ?? "Loading..."}
                  </p>
                  <p className="truncate text-slate-400 text-sm">
                    {activeRide.pickup.address} → {activeRide.dropoff.address}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 font-semibold text-xs ${
                    activeRide.status === "accepted"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {activeRide.status === "accepted" ? "ACCEPTED" : "IN PROGRESS"}
                </span>
              </div>
              <div className="flex gap-2">
                {activeRideCommuter?.phone && (
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2.5 text-sm text-white transition hover:bg-sky-500"
                    onClick={() => handleCall(activeRideCommuter.phone)}
                  >
                    <FaPhone className="text-xs" />
                    Call
                  </button>
                )}
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-sm text-white transition hover:bg-green-500"
                  onClick={activeRide.status === "accepted" ? handlePickedUp : handleCompleteRide}
                >
                  {activeRide.status === "accepted" ? "Picked Up" : "Complete Ride"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
