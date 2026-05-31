"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  FaCheckCircle,
  FaClock,
  FaPhone,
  FaSignOutAlt,
  FaStar,
  FaToggleOff,
  FaToggleOn,
  FaUserTie,
} from "react-icons/fa";
import { operatorProfile } from "@/lib/operatorProfile";
import { useAuth } from "@/lib/authContext";

interface CommutRide {
  distance: string;
  dropoff: string;
  dropoffCoords: [number, number];
  duration: string;
  fare: number;
  id: string;
  passenger: {
    name: string;
    rating: number;
    phone: string;
  };
  pickup: string;
  pickupCoords: [number, number];
  status: "available" | "accepted" | "picked_up" | "completed";
}

export default function DriverPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const { logout } = useAuth();
  const [selectedRide, setSelectedRide] = useState<CommutRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(
    null
  );
  const [online, setOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState<CommutRide | null>(null);
  const [earnings, setEarnings] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);

  // Mock commuter ride requests
  const commuterRides: CommutRide[] = [
    {
      id: "1",
      passenger: {
        name: "Maria Santos",
        rating: 4.9,
        phone: "+63 912 345 6789",
      },
      pickup: "San Jose de Buenavista",
      dropoff: "Hamtic",
      pickupCoords: [122.0175, 10.7883],
      dropoffCoords: [122.045, 10.805],
      fare: 75,
      distance: "5.2 km",
      duration: "12 min",
      status: "available",
    },
    {
      id: "2",
      passenger: {
        name: "Juan Dela Cruz",
        rating: 4.7,
        phone: "+63 921 456 7890",
      },
      pickup: "Sibalom Terminal",
      dropoff: "Patnongon",
      pickupCoords: [121.98, 10.82],
      dropoffCoords: [121.95, 10.84],
      fare: 95,
      distance: "8.5 km",
      duration: "18 min",
      status: "available",
    },
    {
      id: "3",
      passenger: { name: "Ana Reyes", rating: 4.8, phone: "+63 905 678 9012" },
      pickup: "Pandan Public Market",
      dropoff: "Libertad",
      pickupCoords: [122.06, 10.765],
      dropoffCoords: [122.08, 10.75],
      fare: 65,
      distance: "4.8 km",
      duration: "11 min",
      status: "available",
    },
  ];

  // Initialize map
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/bright",
        center: [122.0175, 10.7883],
        zoom: 13,
      });

      // Driver marker (blue)
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

      // Get driver's current location
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

    if (map.current && online) {
      addCommuterMarkers();
    }
  }, [online]);

  const addCommuterMarkers = () => {
    if (!map.current) {
      return;
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    commuterRides.forEach((ride) => {
      // Pickup marker (green)
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
        .setLngLat(ride.pickupCoords)
        .addTo(map.current!);

      pickupEl.addEventListener("click", () => setSelectedRide(ride));
      markersRef.current.set(`pickup-${ride.id}`, pickupMarker);

      // Dropoff marker (red)
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
        .setLngLat(ride.dropoffCoords)
        .addTo(map.current!);

      dropoffEl.addEventListener("click", () => setSelectedRide(ride));
      markersRef.current.set(`dropoff-${ride.id}`, dropoffMarker);
    });
  };

  const handleAcceptRide = (ride: CommutRide) => {
    setCurrentRide(ride);
    setSelectedRide(null);
    setEarnings((prev) => prev + ride.fare);
    setRidesToday((prev) => prev + 1);
    alert(
      `You accepted ride from ${ride.passenger.name}! Pick up at ${ride.pickup}`
    );
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const updateRideStatus = () => {
    if (!currentRide) {
      return;
    }

    if (currentRide.status === "accepted") {
      setCurrentRide({ ...currentRide, status: "picked_up" });
    } else if (currentRide.status === "picked_up") {
      setCurrentRide({ ...currentRide, status: "completed" });
      setTimeout(() => {
        setCurrentRide(null);
      }, 2000);
    }
  };

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
                {operatorProfile.name}
              </h1>
              <p className="text-slate-400 text-sm">
                {operatorProfile.vehicle} • {operatorProfile.plate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              className="btn btn-secondary rounded-full px-4 py-2 text-sm"
              href="/operator/profile"
            >
              <FaUserTie />
              Profile
            </Link>
            <button
              className="btn btn-secondary rounded-full px-4 py-2 text-sm text-rose-400 hover:text-rose-300"
              onClick={logout}
            >
              <FaSignOutAlt />
              Logout
            </button>
            <button
              className={`btn rounded-full px-4 py-2 text-sm ${online ? "btn-success" : "btn-secondary"}`}
              onClick={() => setOnline(!online)}
            >
              {online ? <FaToggleOn /> : <FaToggleOff />}
              {online ? "Online" : "Offline"}
            </button>
          </div>
        </div>
      </div>

      {/* Status Overlay */}
      {online && !currentRide && (
        <div className="absolute top-20 left-4 rounded-full bg-emerald-500 px-3 py-1 font-semibold text-slate-950 text-sm">
          Looking for rides...
        </div>
      )}

      {/* Earnings & Stats */}
      <div className="absolute top-20 right-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="text-center">
          <p className="mb-1 text-slate-400 text-xs">Today's Earnings</p>
          <p className="font-bold text-sky-400 text-xl">₱{earnings}</p>
          <p className="mt-1 text-slate-400 text-xs">{ridesToday} rides</p>
        </div>
      </div>

      {/* Ride List Panel - Only show when online */}
      {online && !currentRide && (
        <div className="absolute top-32 bottom-0 left-0 z-20 w-80 overflow-y-auto border-slate-800 border-r bg-slate-900">
          <div className="border-slate-800 border-b p-6">
            <h2 className="font-bold text-2xl text-slate-100">
              Available Rides
            </h2>
            <p className="mt-1 text-slate-400 text-sm">
              {commuterRides.length} commuters waiting
            </p>
          </div>

          <div className="space-y-3 p-4">
            {commuterRides.map((ride) => (
              <button
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedRide?.id === ride.id
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                }`}
                key={ride.id}
                onClick={() => setSelectedRide(ride)}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {ride.passenger.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-slate-400 text-xs">
                      <FaStar className="text-yellow-500" />
                      {ride.passenger.rating}
                    </div>
                  </div>
                  <span className="font-bold text-lg text-sky-400">
                    ₱{ride.fare}
                  </span>
                </div>

                <div className="space-y-2 text-slate-300 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-lg">📍</span>
                    <span className="truncate">{ride.pickup}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-red-500">📌</span>
                    <span className="truncate">{ride.dropoff}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-slate-400 text-xs">
                  <span className="flex items-center gap-1">
                    <FaClock className="text-xs" />
                    {ride.duration}
                  </span>
                  <span>{ride.distance}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ride Details Panel */}
      {selectedRide && (
        <div className="absolute top-0 right-0 bottom-0 z-20 w-96 overflow-y-auto border-slate-800 border-l bg-slate-900 shadow-2xl">
          <div className="border-slate-800 border-b p-6">
            <h3 className="font-bold text-slate-100 text-xl">Ride Details</h3>
          </div>

          <div className="space-y-6 p-6">
            {/* Passenger Info */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">
                Passenger
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    {selectedRide.passenger.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <FaStar className="text-yellow-500" />
                    <span className="text-slate-400">
                      {selectedRide.passenger.rating}
                    </span>
                  </div>
                </div>
                <button
                  className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-white transition hover:bg-sky-500"
                  onClick={() => handleCall(selectedRide.passenger.phone)}
                >
                  <FaPhone className="text-sm" />
                  Call
                </button>
              </div>
            </div>

            {/* Location Info */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-700 border-l-4 border-l-green-500 bg-slate-800/50 p-4">
                <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">
                  Pickup Location
                </p>
                <p className="font-semibold text-slate-100">
                  {selectedRide.pickup}
                </p>
                <p className="mt-1 text-slate-400 text-xs">
                  {selectedRide.pickupCoords.join(", ")}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 border-l-4 border-l-red-500 bg-slate-800/50 p-4">
                <p className="mb-2 text-slate-500 text-xs uppercase tracking-widest">
                  Dropoff Location
                </p>
                <p className="font-semibold text-slate-100">
                  {selectedRide.dropoff}
                </p>
                <p className="mt-1 text-slate-400 text-xs">
                  {selectedRide.dropoffCoords.join(", ")}
                </p>
              </div>
            </div>

            {/* Trip Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3 text-center">
                <p className="mb-1 text-slate-500 text-xs">Distance</p>
                <p className="font-semibold text-slate-100">
                  {selectedRide.distance}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3 text-center">
                <p className="mb-1 text-slate-500 text-xs">Duration</p>
                <p className="font-semibold text-slate-100">
                  {selectedRide.duration}
                </p>
              </div>
            </div>

            {/* Fare */}
            <div className="rounded-2xl border border-sky-500 bg-sky-500/10 p-4">
              <p className="mb-2 text-slate-400 text-xs uppercase tracking-widest">
                Estimated Fare
              </p>
              <p className="font-bold text-3xl text-sky-400">
                ₱{selectedRide.fare}
              </p>
            </div>

            {/* Action Button */}
            {selectedRide.status === "available" && (
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-500"
                onClick={() => handleAcceptRide(selectedRide)}
              >
                <FaCheckCircle />
                Accept Ride
              </button>
            )}
          </div>
        </div>
      )}

      {/* Current Ride Panel */}
      {currentRide && (
        <div className="absolute right-0 bottom-0 left-0 border-slate-800 border-t bg-slate-900 p-6">
          <div className="mx-auto max-w-md">
            <h3 className="mb-4 font-semibold text-lg text-slate-100">
              Current Ride
            </h3>

            <div className="mb-4 rounded-2xl bg-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    {currentRide.passenger.name}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {currentRide.pickup} → {currentRide.dropoff}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-semibold text-xs ${
                    currentRide.status === "accepted"
                      ? "bg-blue-500/20 text-blue-400"
                      : currentRide.status === "picked_up"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {currentRide.status.replace("_", " ").toUpperCase()}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-white transition hover:bg-sky-500"
                  onClick={() => handleCall(currentRide.passenger.phone)}
                >
                  <FaPhone className="text-sm" />
                  Call
                </button>
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white transition hover:bg-green-500"
                  onClick={updateRideStatus}
                >
                  {currentRide.status === "accepted"
                    ? "Picked Up"
                    : "Complete Ride"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE STATE */}
      {!(online || currentRide) && (
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
