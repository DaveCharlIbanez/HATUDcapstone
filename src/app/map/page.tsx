"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaClock, FaMapMarkerAlt, FaSignOutAlt, FaUser, FaLocationArrow } from "react-icons/fa";
import { ChatBubble } from "@/components/ChatBubble";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/lib/authContext";
import { useTheme } from "@/lib/themeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  landmarks,
  CATEGORY_INFO,
  MUNICIPALITY_LABELS,
  getLandmarksByMunicipality,
  type Landmark,
  type LandmarkCategory,
  type Municipality,
} from "@/lib/landmarks";

interface Vehicle {
  capacity: number;
  eta: string;
  icon: string;
  name: string;
  price: number;
  type: string;
}

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
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | "all">("all");
  const [showLandmarkDropdown, setShowLandmarkDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const commuter = useQuery(
    api.commuters.getByUserId,
    user ? { userId: user.userId as Id<"users"> } : "skip"
  );

  const activeRide = useQuery(
    api.rides.getActiveByCommuter,
    commuter ? { commuterId: commuter._id } : "skip"
  );

  const matchedOperator = useQuery(
    api.operators.getById,
    activeRide?.operatorId ? { id: activeRide.operatorId } : "skip"
  );

  const createRide = useMutation(api.rides.create);
  const cancelRide = useMutation(api.rides.cancel);

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

  useEffect(() => {
    if (map.current) {
      return;
    }

    if (!mapContainer.current) {
      return;
    }

    const mapStyle = theme === "dark"
      ? "https://tiles.openfreemap.org/styles/dark"
      : "https://tiles.openfreemap.org/styles/bright";

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [122.0175, 10.7883],
      zoom: 13,
    });

    map.current.on("load", () => {
      if (!map.current) return;

      landmarks.forEach((landmark) => {
        const categoryInfo = CATEGORY_INFO[landmark.category];
        const markerEl = document.createElement("div");
        markerEl.style.width = "28px";
        markerEl.style.height = "28px";
        markerEl.style.backgroundColor = categoryInfo.color;
        markerEl.style.borderRadius = "50%";
        markerEl.style.border = "3px solid white";
        markerEl.style.display = "flex";
        markerEl.style.alignItems = "center";
        markerEl.style.justifyContent = "center";
        markerEl.style.fontSize = "14px";
        markerEl.style.cursor = "pointer";
        markerEl.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
        markerEl.style.zIndex = "10";
        markerEl.textContent = categoryInfo.icon;

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false })
          .setHTML(
            `<div style="font-family:system-ui;padding:4px;">
              <strong style="font-size:13px;">${landmark.name}</strong><br/>
              <span style="color:#666;font-size:11px;">${MUNICIPALITY_LABELS[landmark.municipality]}</span>
            </div>`
          );

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([landmark.coordinates.lng, landmark.coordinates.lat])
          .setPopup(popup)
          .addTo(map.current!);

        landmarkMarkersRef.current.push(marker);
      });
    });
  }, [theme]);

  useEffect(() => {
    if (!(authLoading || user)) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "commuter") {
      router.push(user.role === "admin" ? "/admin" : "/operator");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.status, confirmedRide]);

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

  const handleUseMyLocation = () => {
    console.log("Location button clicked");
    
    if (!navigator.geolocation) {
      console.error("Geolocation not supported");
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    console.log("Starting geolocation...");
    setIsLocating(true);
    setLocationError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location obtained:", position.coords);
        const { longitude, latitude } = position.coords;
        setPickupCoords({ lat: latitude, lng: longitude });
        setPickup(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        
        if (map.current) {
          map.current.flyTo({ center: [longitude, latitude], zoom: 14 });
          
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat([longitude, latitude]);
          } else {
            const el = document.createElement("div");
            el.style.width = "20px";
            el.style.height = "20px";
            el.style.backgroundColor = "#0ea5e9";
            el.style.borderRadius = "50%";
            el.style.border = "3px solid white";
            el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
            userMarkerRef.current = new maplibregl.Marker({ element: el })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }
        }
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error.code, error.message);
        setIsLocating(false);
        
        let errorMessage = "Unable to get location";
        if (error.code === 1) {
          errorMessage = "Location permission denied. Please allow location access in your browser settings.";
        } else if (error.code === 2) {
          errorMessage = "Location unavailable. Please try again.";
        } else if (error.code === 3) {
          errorMessage = "Location request timed out. Please try again.";
        }
        setLocationError(errorMessage);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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

  const handleLandmarkSelect = (landmark: Landmark) => {
    setDropoff(landmark.name);
    setDropoffCoords({
      lat: landmark.coordinates.lat,
      lng: landmark.coordinates.lng,
    });
    setShowLandmarkDropdown(false);
    if (map.current) {
      map.current.flyTo({
        center: [landmark.coordinates.lng, landmark.coordinates.lat],
        zoom: 15,
      });
    }
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
      {/* Mobile: Bottom navigation bar - Larger for touch */}
      <div className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-between border-[var(--border)] border-t bg-[var(--surface)]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link
          href="/Commuters/profile"
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
            theme === "light"
              ? "border-sky-600 bg-white text-slate-800"
              : "border-sky-400 bg-sky-700 text-white"
          }`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-base ${
            theme === "light" ? "bg-sky-100 text-sky-700" : "bg-sky-600 text-white"
          }`}>
            <FaUser />
          </div>
          <p className={`font-semibold text-base ${
            theme === "light" ? "text-slate-900" : "text-white"
          }`}>{displayName}</p>
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
            className={`inline-flex h-11 items-center justify-center rounded-xl border-2 px-4 font-semibold text-sm ${
              theme === "light"
                ? "border-rose-500 bg-white text-rose-600"
                : "border-rose-400 bg-rose-600 text-white"
            }`}
            onClick={logout}
            type="button"
          >
            <FaSignOutAlt className="mr-1.5 text-base" />
            Logout
          </button>
        </div>
      </div>

      {/* Desktop: Top-left header */}
      <div className="absolute top-4 left-4 z-20 hidden md:block">
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
            type="button"
          >
            <FaSignOutAlt className="text-xs" />
            Logout
          </button>
        </div>
      </div>

      <div className="h-full w-full" ref={mapContainer} />

      <div className="pointer-events-none absolute bottom-0 flex w-full justify-center md:pb-0">
        <div className="pointer-events-auto w-full max-w-md rounded-t-3xl border-2 border-[var(--border)] bg-[var(--background)]/95 shadow-2xl backdrop-blur-xl md:mb-0">
          <div className="flex justify-center py-3">
            <div className="h-2 w-16 rounded-full bg-gray-400" />
          </div>

          <div className="max-h-[calc(100dvh-12rem)] touch-pan-y overflow-y-auto overscroll-contain px-5 pb-24 md:max-h-[calc(100dvh-7rem)] md:pb-4">
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
                    <button
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-opacity ${
                        theme === "light"
                          ? "border-slate-400 bg-white text-sky-600 hover:bg-sky-100"
                          : "border-slate-500 bg-slate-700 text-sky-400 hover:bg-slate-600"
                      }`}
                      onClick={handleUseMyLocation}
                      disabled={isLocating}
                      type="button"
                      title="Use my location"
                      aria-label="Use my location"
                    >
                      {isLocating ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                      ) : (
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  {locationError && (
                    <div className="mb-2 rounded-lg bg-red-500/20 border border-red-500/50 px-3 py-2 text-sm text-red-400">
                      {locationError}
                    </div>
                  )}

                  {pickupSuggestions.map((place, i) => (
                    <button
                      className="block w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 text-left text-[var(--foreground)] transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                      key={i}
                      onClick={() => handlePickupSelect(place)}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <FaMapMarkerAlt className="shrink-0 text-emerald-400" />
                        <span className="text-sm">{place.display_name}</span>
                      </div>
                    </button>
                  ))}

                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 shrink-0 rounded-full bg-rose-400" />
                    <button
                      className="flex-1 border-[var(--border)] border-b bg-transparent pb-2 text-left text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
                      onClick={() => setShowLandmarkDropdown(!showLandmarkDropdown)}
                      type="button"
                    >
                      {dropoff || "Select destination"}
                    </button>
                  </div>
                </div>

                {showLandmarkDropdown && (
                  <div className="mb-4 space-y-3">
                    <div className="flex gap-2">
                      {(["all", "sanJose", "sibalom"] as const).map((mun) => (
                        <button
                          key={mun}
                          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                            selectedMunicipality === mun
                              ? "bg-sky-500 text-white"
                              : "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                          }`}
                          onClick={() => setSelectedMunicipality(mun)}
                          type="button"
                        >
                          {mun === "all" ? "All" : MUNICIPALITY_LABELS[mun]}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {filteredLandmarks.map((landmark) => (
                        <button
                          key={landmark.id}
                          className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 text-left text-[var(--foreground)] transition hover:border-sky-500 hover:bg-[var(--surface)]"
                          onClick={() => handleLandmarkSelect(landmark)}
                          type="button"
                        >
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                            style={{ backgroundColor: CATEGORY_INFO[landmark.category].color }}
                          >
                            {CATEGORY_INFO[landmark.category].icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-white">
                              {landmark.name}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {MUNICIPALITY_LABELS[landmark.municipality]}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {dropoff && pickup && (
                  <button
                    className="mt-4 w-full rounded-2xl border-2 border-sky-500/50 bg-sky-600 py-4 font-bold text-base text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500"
                    onClick={() => setStep("vehicle")}
                    type="button"
                  >
                    Choose a ride
                  </button>
                )}
              </>
            )}

            {step === "vehicle" && (
              <>
                <h3 className="mb-4 font-semibold text-lg">Choose a ride</h3>

                <div className="mb-4 space-y-3">
                  {vehicles.map((vehicle) => (
                    <button
                      className={`w-full rounded-2xl border-2 p-5 transition-all ${
                        selectedVehicle === vehicle.type
                          ? "border-sky-400 bg-[var(--surface)] shadow-lg shadow-sky-400/20"
                          : "border-slate-700 bg-[var(--surface)]/50 hover:border-sky-500/50"
                      }`}
                      key={vehicle.type}
                      onClick={() => setSelectedVehicle(vehicle.type)}
                      type="button"
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

                <button
                  className="mt-3 w-full rounded-2xl border-2 border-sky-500/50 bg-sky-600 py-4 font-bold text-base text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
                  disabled={!(selectedVehicle && commuter && sessionToken)}
                  onClick={handleBookRide}
                  type="button"
                >
                  Book{" "}
                  {selectedVehicle
                    ? vehicles.find((v) => v.type === selectedVehicle)?.name
                    : ""}
                </button>
              </>
            )}

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
                      type="button"
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
                      type="button"
                    >
                      Confirm & Start Ride
                    </button>
                  </div>
                )}

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
                      type="button"
                    >
                      Pay &amp; Rate Driver
                    </button>
                    <button
                      className="w-full rounded-3xl bg-[var(--surface-strong)] py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
                      onClick={resetBooking}
                      type="button"
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

export default MapPage;
