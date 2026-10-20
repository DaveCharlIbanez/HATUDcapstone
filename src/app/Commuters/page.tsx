"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaClock, FaMapMarkerAlt, FaSignOutAlt, FaUser } from "react-icons/fa";
import { ChatBubble } from "@/components/ChatBubble";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/lib/authContext";
import { getRoute } from "@/lib/mapClient";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Vehicle {
  capacity: number;
  eta: string;
  icon: string;
  name: string;
  price: number;
  type: string;
}

const CommutersPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { user, logout, sessionToken, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState({ lat: 0, lng: 0 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 0, lng: 0 });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
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

  // Resolve commuter profile from userId
  const commuter = useQuery(
    api.commuters.getByUserId,
    user ? { userId: user.userId as Id<"users"> } : "skip"
  );

  // Real-time subscription to the commuter's current active ride
  const activeRide = useQuery(
    api.rides.getActiveByCommuter,
    commuter ? { commuterId: commuter._id } : "skip"
  );

  // Fetch operator info once a ride is accepted
  const matchedOperator = useQuery(
    api.operators.getById,
    activeRide?.operatorId ? { id: activeRide.operatorId } : "skip"
  );

  const createRide = useMutation(api.rides.create);
  const cancelRide = useMutation(api.rides.cancel);
  const updateCommuterLocationMutation = useMutation(api.rides.updateCommuterLocation);

  const operatorLocation = useQuery(
    api.rides.getOperatorLocation,
    activeRide ? { rideId: activeRide._id } : "skip"
  );

  const operatorMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeLayerId = "route-line";
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const vehicles: Vehicle[] = [
    {
      type: "standard",
      name: "Standard",
      icon: "🏍️",
      eta: "2 min",
      capacity: 1,
      price: 30,
    },
    {
      type: "priority",
      name: "Priority",
      icon: "🛵",
      eta: "3 min",
      capacity: 2,
      price: 50,
    },
  ];

  // Map init
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: [122.0175, 10.7883],
        zoom: 13,
      });

      const el = document.createElement("div");
      el.style.width = "15px";
      el.style.height = "15px";
      el.style.backgroundColor = "#0ea5e9";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([122.0175, 10.7883])
        .addTo(map.current);

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            const newLocation = { latitude, longitude };
            locationRef.current = newLocation;
            setPickupCoords({ lat: latitude, lng: longitude });
            setPickup(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            setCurrentLocation(newLocation);
            if (map.current) {
              map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
              el.style.display = "block";
            }
          },
          (error) => console.error("Geolocation error:", error)
        );

        // Watch position for real-time updates
        navigator.geolocation.watchPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            const newLocation = { latitude, longitude };
            locationRef.current = newLocation;
            setCurrentLocation(newLocation);
            if (userMarkerRef.current) {
              userMarkerRef.current.setLngLat([longitude, latitude]);
            }
          },
          (error) => console.error("Geolocation watch error:", error),
          { enableHighAccuracy: true }
        );
      }
    }
  }, []);

  // Role guard — redirect non-commuters and commuters to map
  useEffect(() => {
    if (!(authLoading || user)) {
      router.push("/login");
      return;
    }
    if (!authLoading && user) {
      if (user.role === "commuter") {
        router.replace("/map");
      } else {
        router.push(user.role === "admin" ? "/admin" : "/operator");
      }
    }
  }, [user, authLoading, router]);

  const resetBooking = () => {
    setStep("location");
    setPickup("");
    setDropoff("");
    setPickupCoords({ lat: 0, lng: 0 });
    setDropoffCoords({ lat: 0, lng: 0 });
    setPickupSuggestions([]);
    setSuggestions([]);
    setSelectedVehicle(null);
    setRideStatus("searching");
    setActiveRideId(null);
    setConfirmedRide(false);
  };

  // React to Convex ride status changes — drives all UI transitions
  useEffect(() => {
    if (!activeRide) {
      return;
    }

    if (activeRide.status === "pending") {
      setStep("booking");
      setRideStatus("searching");
    } else if (activeRide.status === "accepted") {
      if (confirmedRide) {
        setStep("tracking");
        setRideStatus("arriving");
      } else {
        setStep("booking");
        setRideStatus("matched");
      }
    } else if (activeRide.status === "inProgress") {
      setStep("tracking");
      setRideStatus("in-progress");
    } else if (activeRide.status === "completed") {
      setStep("tracking");
      setRideStatus("completed");
    } else if (activeRide.status === "cancelled") {
      resetBooking();
    }
  }, [activeRide?.status, confirmedRide, resetBooking, activeRide]);

  // Show chat when ride is accepted or in progress
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

  // Send commuter location to Convex every 5 seconds when ride is accepted/inProgress
  useEffect(() => {
    if (
      !activeRide ||
      (activeRide.status !== "accepted" && activeRide.status !== "inProgress") ||
      !sessionToken
    ) {
      return;
    }

    const sendLocation = async () => {
      const loc = locationRef.current;
      if (!loc) return;

      try {
        await updateCommuterLocationMutation({
          sessionToken,
          rideId: activeRide._id,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      } catch (error) {
        console.error("Failed to update commuter location:", error);
      }
    };

    sendLocation();
    const interval = setInterval(sendLocation, 5000);

    return () => clearInterval(interval);
  }, [activeRide, sessionToken, updateCommuterLocationMutation]);

  // Display operator marker and route when location is available
  useEffect(() => {
    const loc = locationRef.current;
    if (!map.current || !operatorLocation || !loc) {
      return;
    }

    // Remove existing route if any
    if (map.current.getLayer(routeLayerId)) {
      map.current.removeLayer(routeLayerId);
    }
    if (map.current.getSource("route")) {
      map.current.removeSource("route");
    }

    // Add or update operator marker
    if (!operatorMarkerRef.current) {
      const operatorEl = document.createElement("div");
      operatorEl.style.width = "24px";
      operatorEl.style.height = "24px";
      operatorEl.style.backgroundColor = "#3B82F6";
      operatorEl.style.borderRadius = "50%";
      operatorEl.style.border = "3px solid white";
      operatorEl.style.boxShadow = "0 0 8px rgba(59, 130, 246, 0.5)";
      operatorEl.style.display = "flex";
      operatorEl.style.alignItems = "center";
      operatorEl.style.justifyContent = "center";
      operatorEl.style.fontSize = "14px";
      operatorEl.innerHTML = "🏍️";

      operatorMarkerRef.current = new maplibregl.Marker({ element: operatorEl })
        .setLngLat([operatorLocation.longitude, operatorLocation.latitude])
        .addTo(map.current);
    } else {
      operatorMarkerRef.current.setLngLat([operatorLocation.longitude, operatorLocation.latitude]);
    }

    // Check if location is stale (30 seconds)
    const isStale = Date.now() - operatorLocation.updatedAt > 30000;
    if (isStale && operatorMarkerRef.current.getElement()) {
      operatorMarkerRef.current.getElement().style.backgroundColor = "#94a3b8";
      operatorMarkerRef.current.getElement().style.boxShadow = "0 0 8px rgba(148, 163, 184, 0.5)";
    }

    // Draw route from commuter to operator
    const drawRoute = async () => {
      const route = await getRoute(
        [loc.longitude, loc.latitude],
        [operatorLocation.longitude, operatorLocation.latitude]
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
  }, [operatorLocation]);

  // Clear markers when ride ends
  useEffect(() => {
    if (!activeRide || (activeRide.status !== "accepted" && activeRide.status !== "inProgress")) {
      if (operatorMarkerRef.current) {
        operatorMarkerRef.current.remove();
        operatorMarkerRef.current = null;
      }
      if (map.current?.getLayer(routeLayerId)) {
        map.current.removeLayer(routeLayerId);
      }
      if (map.current?.getSource("route")) {
        map.current.removeSource("route");
      }
    }
  }, [activeRide]);

  const handlePickupSearch = async (query: string) => {
    setPickup(query);
    if (query.length > 2) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${query}, Antique, Philippines`
        );
        const data = await response.json();
        setPickupSuggestions(data.slice(0, 4));
      } catch (error) {
        console.error("Pickup search error:", error);
      }
    } else {
      setPickupSuggestions([]);
    }
  };

  const handlePickupSelect = (place: any) => {
    setPickup(place.display_name);
    setPickupCoords({
      lat: Number.parseFloat(place.lat),
      lng: Number.parseFloat(place.lon),
    });
    setPickupSuggestions([]);
  };

  const handleSearch = async (query: string) => {
    setDropoff(query);
    if (query.length > 2) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${query}, Antique, Philippines`
        );
        const data = await response.json();
        setSuggestions(data.slice(0, 5));
      } catch (error) {
        console.error("Search error:", error);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (place: any) => {
    setDropoff(place.display_name);
    setDropoffCoords({
      lat: Number.parseFloat(place.lat),
      lng: Number.parseFloat(place.lon),
    });
    setSuggestions([]);
  };

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
        vehicleType: selectedVehicle as "standard" | "priority",
        fare: vehicle.price,
        distance: 0,
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

  if (authLoading || !user || user.role !== "commuter") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      {/* HEADER */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-lg text-sky-300">
            <FaUser />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white">{displayName}</p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-2 font-medium text-sm text-white shadow transition-colors hover:bg-sky-400"
            href="/Commuters/profile"
          >
            <FaUser className="text-xs" />
            Profile
          </Link>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-2 font-medium text-rose-400 text-sm transition-colors hover:bg-rose-500/30"
            onClick={logout}
          >
            <FaSignOutAlt className="text-xs" />
            Logout
          </button>
        </div>
      </div>

      {/* MAP */}
      <div className="h-full w-full" ref={mapContainer} />

      {/* BOTTOM PANEL */}
      <div className="pointer-events-none absolute bottom-0 flex w-full justify-center">
        <div className="pointer-events-auto w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--background)]/95 shadow-2xl backdrop-blur-xl">
          {/* HANDLE */}
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>

          {/* CONTENT */}
          <div className="max-h-[calc(100dvh-7rem)] touch-pan-y overflow-y-auto overscroll-contain px-4 pb-4">
            {/* LOCATION STEP */}
            {step === "location" && (
              <>
                <div className="mb-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 shrink-0 rounded-full bg-emerald-400" />
                    <input
                      className="flex-1 border-[var(--border)] border-b bg-transparent pb-2 text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
                      onChange={(e) => handlePickupSearch(e.target.value)}
                      placeholder="Pickup location"
                      value={pickup}
                    />
                  </div>

                  {/* PICKUP SUGGESTIONS */}
                  {pickupSuggestions.map((place, i) => (
                    <button
                      className="block w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 text-left text-[var(--foreground)] transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                      key={i}
                      onClick={() => handlePickupSelect(place)}
                    >
                      <div className="flex items-center gap-3">
                        <FaMapMarkerAlt className="shrink-0 text-emerald-400" />
                        <span className="text-sm">{place.display_name}</span>
                      </div>
                    </button>
                  ))}

                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 shrink-0 rounded-full bg-rose-400" />
                    <input
                      className="flex-1 border-[var(--border)] border-b bg-transparent pb-2 text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Where to?"
                      value={dropoff}
                    />
                  </div>
                </div>

                {/* DROPOFF SUGGESTIONS */}
                {suggestions.map((place, i) => (
                  <button
                    className="mb-2 block w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 text-left text-[var(--foreground)] transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                    key={i}
                    onClick={() => handleSelect(place)}
                  >
                    <div className="flex items-center gap-3">
                      <FaMapMarkerAlt className="text-sky-400" />
                      <span className="text-sm">{place.display_name}</span>
                    </div>
                  </button>
                ))}

                {/* CONTINUE BUTTON */}
                {dropoff && pickup && (
                  <button
                    className="mt-4 w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                    onClick={() => setStep("vehicle")}
                  >
                    Choose a ride
                  </button>
                )}
              </>
            )}

            {/* VEHICLE SELECTION STEP */}
            {step === "vehicle" && (
              <>
                <h3 className="mb-4 font-semibold text-lg">Choose a ride</h3>

                <div className="mb-4 space-y-3">
                  {vehicles.map((vehicle) => (
                    <button
                      className={`w-full rounded-3xl border-2 p-4 transition-all ${
                        selectedVehicle === vehicle.type
                          ? "border-sky-400 bg-[var(--surface)] shadow-lg shadow-sky-400/20"
                          : "border-slate-700 bg-[var(--surface)]/50 hover:border-slate-600"
                      }`}
                      key={vehicle.type}
                      onClick={() => setSelectedVehicle(vehicle.type)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl text-sky-400">
                            {vehicle.icon}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-white">
                              {vehicle.name}
                            </div>
                            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                              <FaClock className="text-xs" /> {vehicle.eta} •{" "}
                              {vehicle.capacity} passenger(s)
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-white">
                            ₱{vehicle.price}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* BOOK BUTTON */}
                <button
                  className="mt-2 w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
                  disabled={!(selectedVehicle && commuter && sessionToken)}
                  onClick={handleBookRide}
                >
                  Book{" "}
                  {selectedVehicle
                    ? vehicles.find((v) => v.type === selectedVehicle)?.name
                    : ""}
                </button>
              </>
            )}

            {/* BOOKING STEP */}
            {step === "booking" && (
              <>
                {rideStatus === "searching" && (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
                    <h3 className="mb-2 font-semibold text-lg text-white">
                      Finding your driver
                    </h3>
                    <p className="mb-6 text-[var(--text-muted)]">
                      Please wait while we match you with the best driver
                    </p>
                    <button
                      className="w-full rounded-3xl bg-[var(--surface-strong)] py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                      onClick={handleCancelRide}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {rideStatus === "matched" && matchedOperator && (
                  <div className="space-y-4">
                    <h3 className="mb-6 text-center font-semibold text-white text-xl">
                      Driver Assigned!
                    </h3>

                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                      <div className="mb-4 flex items-center gap-4">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-3xl">
                          🏍️
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-base text-white">
                            {matchedOperator.name}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 border-[var(--border)] border-t pt-4 text-[var(--text-muted)] text-sm">
                        <div className="flex justify-between">
                          <span>Vehicle:</span>
                          <span className="font-medium text-white">
                            {matchedOperator.vehicleInfo.model}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Plate:</span>
                          <span className="font-medium text-white">
                            {matchedOperator.vehicleInfo.plateNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Color:</span>
                          <span className="font-medium text-white">
                            {matchedOperator.vehicleInfo.color}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                      onClick={handleConfirmBooking}
                    >
                      Confirm & Start Ride
                    </button>
                  </div>
                )}

                {/* Waiting for operator to accept — matched is loading */}
                {rideStatus === "matched" && !matchedOperator && (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
                    <h3 className="mb-2 font-semibold text-lg text-white">
                      Driver found!
                    </h3>
                    <p className="text-[var(--text-muted)]">
                      Loading driver details...
                    </p>
                  </div>
                )}
              </>
            )}

            {/* TRACKING STEP */}
            {step === "tracking" && (
              <div className="py-8 text-center">
                <h3 className="mb-4 font-semibold text-lg text-white">
                  {rideStatus === "arriving" && "Driver is on the way"}
                  {rideStatus === "arrived" && "Driver has arrived"}
                  {rideStatus === "in-progress" && "Ride in progress"}
                  {rideStatus === "completed" && "Ride completed"}
                </h3>

                {matchedOperator && (
                  <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">🏍️</div>
                      <div className="text-left">
                        <div className="font-medium text-white">
                          {matchedOperator.name}
                        </div>
                        <div className="text-[var(--text-muted)] text-sm">
                          {matchedOperator.vehicleInfo.model} •{" "}
                          {matchedOperator.vehicleInfo.plateNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {rideStatus === "completed" && (
                  <div className="space-y-3">
                    <button
                      className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                      onClick={() => router.push("/payment")}
                    >
                      Pay &amp; Rate Driver
                    </button>
                    <button
                      className="w-full rounded-3xl bg-[var(--surface-strong)] py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                      onClick={resetBooking}
                    >
                      Book Another Ride
                    </button>
                  </div>
                )}
              </div>
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

export default CommutersPage;
