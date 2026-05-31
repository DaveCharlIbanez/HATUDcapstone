"use client";

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaClock, FaMapMarkerAlt, FaSignOutAlt, FaStar, FaUser } from "react-icons/fa";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "@/lib/authContext";

interface Vehicle {
  capacity: number;
  eta: string;
  icon: string;
  name: string;
  price: number;
  type: string;
}

interface MatchedDriver {
  id: number;
  name: string;
  photo: string;
  plate: string;
  rating: number;
  vehicle: string;
}

const CommutersPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { logout } = useAuth();

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
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
  const [matchedDriver, setMatchedDriver] = useState<MatchedDriver | null>(
    null
  );

  const [commuterProfile] = useState({
    name: "Maria Santos",
    totalRides: 24,
    rating: 4.8,
  });

  const vehicles: Vehicle[] = [
    {
      type: "economy",
      name: "Hatud Economy",
      icon: "🚗",
      eta: "2 min",
      capacity: 4,
      price: 50,
    },
    {
      type: "comfort",
      name: "Hatud Comfort",
      icon: "🚙",
      eta: "3 min",
      capacity: 4,
      price: 75,
    },
    {
      type: "xl",
      name: "Hatud XL",
      icon: "🚐",
      eta: "5 min",
      capacity: 6,
      price: 120,
    },
  ];

  const mockDrivers: MatchedDriver[] = [
    {
      id: 1,
      name: "Juan Cruz",
      rating: 4.9,
      photo: "👨‍🔧",
      vehicle: "Toyota Vios 2023",
      plate: "ABC-1234",
    },
    {
      id: 2,
      name: "Pedro Reyes",
      rating: 4.8,
      photo: "👨‍💼",
      vehicle: "Honda City 2022",
      plate: "XYZ-5678",
    },
    {
      id: 3,
      name: "Carlos Mendez",
      rating: 4.7,
      photo: "👨‍🎓",
      vehicle: "Mitsubishi Mirage 2023",
      plate: "DEF-9012",
    },
  ];

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

      new maplibregl.Marker({ element: el })
        .setLngLat([122.0175, 10.7883])
        .addTo(map.current);
    }
  }, []);

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
    }
  };

  const handleSelect = (place: any) => {
    setDropoff(place.display_name);
    setSuggestions([]);
  };

  const handleBookRide = () => {
    if (selectedVehicle && pickup && dropoff) {
      setStep("booking");

      setTimeout(() => {
        const randomDriver =
          mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
        setMatchedDriver(randomDriver ?? null);
        setRideStatus("matched");
      }, 3000);
    }
  };

  const handleConfirmBooking = () => {
    setStep("tracking");
    setRideStatus("arriving");

    // Simulate ride progression
    setTimeout(() => setRideStatus("arrived"), 5000);
    setTimeout(() => setRideStatus("in-progress"), 10_000);
    setTimeout(() => setRideStatus("completed"), 15_000);
  };

  const resetBooking = () => {
    setStep("location");
    setPickup("");
    setDropoff("");
    setSelectedVehicle(null);
    setRideStatus("searching");
    setMatchedDriver(null);
  };

  return (
    <div className="relative h-screen w-full bg-slate-950 text-slate-100">
      {/* HEADER */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-700 text-lg text-sky-300">
            <FaUser />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white">
              {commuterProfile.name}
            </p>
            <p className="text-slate-400 text-xs">
              {commuterProfile.totalRides} rides • {commuterProfile.rating} ★
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-2 font-medium text-sm text-white shadow transition-colors hover:bg-sky-400"
            href="/Commuters/profile"
          >
            <FaUser className="text-xs" />
            Profile
          </Link>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-2 font-medium text-sm text-rose-400 transition-colors hover:bg-rose-500/30"
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
        <div className="pointer-events-auto w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          {/* HANDLE */}
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>

          {/* CONTENT */}
          <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
            {/* LOCATION STEP */}
            {step === "location" && (
              <>
                <div className="mb-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    <input
                      className="flex-1 border-slate-300 border-b bg-transparent pb-2 text-slate-100 outline-none placeholder:text-slate-500"
                      onChange={(e) => setPickup(e.target.value)}
                      placeholder="Pickup location"
                      value={pickup}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-rose-400" />
                    <input
                      className="flex-1 border-slate-300 border-b bg-transparent pb-2 text-slate-100 outline-none placeholder:text-slate-500"
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Where to?"
                      value={dropoff}
                    />
                  </div>
                </div>

                {/* SUGGESTIONS */}
                {suggestions.map((place, i) => (
                  <button
                    className="mb-2 block w-full rounded-3xl border border-slate-800 bg-slate-900/90 p-3 text-left text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
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
                          ? "border-sky-400 bg-slate-900 shadow-lg shadow-sky-400/20"
                          : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
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
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                              <FaClock className="text-xs" /> {vehicle.eta} •{" "}
                              {vehicle.capacity} seats
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
                  className="mt-2 w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                  disabled={!selectedVehicle}
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
                    <p className="text-slate-400">
                      Please wait while we match you with the best driver
                    </p>
                  </div>
                )}

                {rideStatus === "matched" && matchedDriver && (
                  <div className="space-y-4">
                    <h3 className="mb-6 text-center font-semibold text-white text-xl">
                      Driver Assigned!
                    </h3>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                      <div className="mb-4 flex items-center gap-4">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-3xl">
                          {matchedDriver.photo}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-base text-white">
                            {matchedDriver.name}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-slate-400">
                            <FaStar className="text-xs text-yellow-400" />
                            <span className="font-medium text-sm">
                              {matchedDriver.rating}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 border-slate-700 border-t pt-4 text-slate-400 text-sm">
                        <div className="flex justify-between">
                          <span>Vehicle:</span>
                          <span className="font-medium text-white">
                            {matchedDriver.vehicle}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Plate:</span>
                          <span className="font-medium text-white">
                            {matchedDriver.plate}
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
              </>
            )}

            {/* TRACKING STEP */}
            {step === "tracking" && (
              <div className="py-8 text-center">
                <h3 className="mb-4 font-semibold text-lg text-white">
                  {rideStatus === "arriving" && "Driver is arriving"}
                  {rideStatus === "arrived" && "Driver has arrived"}
                  {rideStatus === "in-progress" && "Ride in progress"}
                  {rideStatus === "completed" && "Ride completed"}
                </h3>

                {matchedDriver && (
                  <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{matchedDriver.photo}</div>
                      <div className="text-left">
                        <div className="font-medium text-white">
                          {matchedDriver.name}
                        </div>
                        <div className="text-slate-400 text-sm">
                          {matchedDriver.vehicle}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {rideStatus === "completed" && (
                  <div className="space-y-3">
                    <button className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white transition hover:bg-sky-400">
                      Rate Driver
                    </button>
                    <button
                      className="w-full rounded-3xl bg-slate-800 py-3 font-semibold text-slate-100 text-sm transition hover:bg-slate-700"
                      onClick={resetBooking}
                    >
                      Book Another Ride
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommutersPage;
