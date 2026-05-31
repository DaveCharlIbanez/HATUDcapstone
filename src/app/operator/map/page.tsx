"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaMapMarkerAlt,
  FaPhone,
  FaStar,
} from "react-icons/fa";

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
  status: "available" | "accepted" | "picked_up";
}

export default function OperatorMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [selectedRide, setSelectedRide] = useState<CommutRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(
    null
  );

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
    if (map.current) {
      return;
    }

    if (mapContainer.current) {
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

      // Add commuter markers
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
    }
  }, []);

  const handleAcceptRide = (ride: CommutRide) => {
    alert(
      `You accepted ride from ${ride.passenger.name}! Pick up at ${ride.pickup}`
    );
    // Update ride status and navigate
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className="relative h-screen w-full bg-slate-950">
      {/* Map */}
      <div className="h-full w-full" ref={mapContainer} />

      {/* Header */}
      <div className="absolute top-0 right-0 left-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
        <Link
          className="inline-flex items-center gap-2 text-white transition hover:text-sky-400"
          href="/operator"
        >
          <FaArrowLeft /> Back to Dashboard
        </Link>
      </div>

      {/* Ride List Panel */}
      <div className="absolute top-20 bottom-0 left-0 z-20 w-80 overflow-y-auto border-slate-800 border-r bg-slate-900">
        <div className="border-slate-800 border-b p-6">
          <h2 className="font-bold text-2xl text-slate-100">Available Rides</h2>
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

            {selectedRide.status === "accepted" && (
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500">
                <FaMapMarkerAlt />
                Navigate to Pickup
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
