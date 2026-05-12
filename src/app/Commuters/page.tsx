"use client";

import { FaUser, FaMapMarkerAlt, FaClock, FaStar } from "react-icons/fa";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Vehicle {
  type: string;
  name: string;
  icon: string;
  eta: string;
  capacity: number;
  price: number;
}

interface MatchedDriver {
  id: number;
  name: string;
  rating: number;
  photo: string;
  vehicle: string;
  plate: string;
}

const CommutersPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [step, setStep] = useState<"location" | "vehicle" | "booking" | "tracking">("location");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<
    "searching" | "matched" | "arriving" | "arrived" | "in-progress" | "completed"
  >("searching");
  const [matchedDriver, setMatchedDriver] = useState<MatchedDriver | null>(null);

  const [commuterProfile] = useState({
    name: "Maria Santos",
    totalRides: 24,
    rating: 4.8,
  });

  const vehicles: Vehicle[] = [
    { type: "economy", name: "Hatud Economy", icon: "🚗", eta: "2 min", capacity: 4, price: 50 },
    { type: "comfort", name: "Hatud Comfort", icon: "🚙", eta: "3 min", capacity: 4, price: 75 },
    { type: "xl", name: "Hatud XL", icon: "🚐", eta: "5 min", capacity: 6, price: 120 },
  ];

  const mockDrivers: MatchedDriver[] = [
    { id: 1, name: "Juan Cruz", rating: 4.9, photo: "👨‍🔧", vehicle: "Toyota Vios 2023", plate: "ABC-1234" },
    { id: 2, name: "Pedro Reyes", rating: 4.8, photo: "👨‍💼", vehicle: "Honda City 2022", plate: "XYZ-5678" },
    { id: 3, name: "Carlos Mendez", rating: 4.7, photo: "👨‍🎓", vehicle: "Mitsubishi Mirage 2023", plate: "DEF-9012" },
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

      // Simulate driver matching
      setTimeout(() => {
        const randomDriver = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
        setMatchedDriver(randomDriver);
        setRideStatus("matched");
      }, 3000);
    }
  };

  const handleConfirmBooking = () => {
    setStep("tracking");
    setRideStatus("arriving");

    // Simulate ride progression
    setTimeout(() => setRideStatus("arrived"), 5000);
    setTimeout(() => setRideStatus("in-progress"), 10000);
    setTimeout(() => setRideStatus("completed"), 15000);
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
    <div className="relative w-full h-screen bg-slate-950 text-slate-100">
      {/* HEADER */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="w-11 h-11 rounded-full bg-slate-700 text-sky-300 flex items-center justify-center text-lg">
            <FaUser />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{commuterProfile.name}</p>
            <p className="text-xs text-slate-400">{commuterProfile.totalRides} rides • {commuterProfile.rating} ★</p>
          </div>
          <Link
            href="/Commuters/profile"
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow hover:bg-sky-400 transition-colors"
          >
            <FaUser className="text-xs" />
            Profile
          </Link>
        </div>
      </div>

      {/* MAP */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* BOTTOM PANEL */}
      <div className="absolute bottom-0 w-full flex justify-center pointer-events-none">
        <div className="w-full max-w-md bg-slate-950/95 rounded-t-3xl border border-slate-800 shadow-2xl backdrop-blur-xl pointer-events-auto">
          {/* HANDLE */}
          <div className="flex justify-center py-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          {/* CONTENT */}
          <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto">
            {/* LOCATION STEP */}
            {step === "location" && (
              <>
                <div className="space-y-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                    <input
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      placeholder="Pickup location"
                      className="flex-1 border-b border-slate-300 bg-transparent pb-2 text-slate-100 outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-rose-400 rounded-full"></div>
                    <input
                      value={dropoff}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Where to?"
                      className="flex-1 border-b border-slate-300 bg-transparent pb-2 text-slate-100 outline-none placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {/* SUGGESTIONS */}
                {suggestions.map((place, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(place)}
                    className="block w-full rounded-3xl border border-slate-800 bg-slate-900/90 p-3 text-left text-slate-100 transition hover:border-slate-700 hover:bg-slate-900 mb-2"
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
                    onClick={() => setStep("vehicle")}
                    className="w-full rounded-3xl bg-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 mt-4"
                  >
                    Choose a ride
                  </button>
                )}
              </>
            )}

            {/* VEHICLE SELECTION STEP */}
            {step === "vehicle" && (
              <>
                <h3 className="text-lg font-semibold mb-4">Choose a ride</h3>

                <div className="space-y-3 mb-4">
                  {vehicles.map((vehicle) => (
                    <button
                      key={vehicle.type}
                      onClick={() => setSelectedVehicle(vehicle.type)}
                      className={`w-full p-4 rounded-3xl border-2 transition-all ${
                        selectedVehicle === vehicle.type
                          ? "border-sky-400 bg-slate-900 shadow-lg shadow-sky-400/20"
                          : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl text-sky-400">{vehicle.icon}</div>
                          <div className="text-left">
                            <div className="font-semibold text-white">{vehicle.name}</div>
                            <div className="text-sm text-slate-400 flex items-center gap-2">
                              <FaClock className="text-xs" /> {vehicle.eta} • {vehicle.capacity} seats
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">₱{vehicle.price}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* BOOK BUTTON */}
                <button
                  onClick={handleBookRide}
                  disabled={!selectedVehicle}
                  className="w-full rounded-3xl bg-sky-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 mt-2"
                >
                  Book {selectedVehicle ? vehicles.find(v => v.type === selectedVehicle)?.name : ""}
                </button>
              </>
            )}

            {/* BOOKING STEP */}
            {step === "booking" && (
              <>
                {rideStatus === "searching" && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-white mb-2">Finding your driver</h3>
                    <p className="text-slate-400">Please wait while we match you with the best driver</p>
                  </div>
                )}

                {rideStatus === "matched" && matchedDriver && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white text-center mb-6">Driver Assigned!</h3>

                    <div className="rounded-3xl bg-slate-900 p-5 border border-slate-800">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-3xl flex-shrink-0">
                          {matchedDriver.photo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-base">{matchedDriver.name}</div>
                          <div className="flex items-center gap-1 text-slate-400 mt-1">
                            <FaStar className="text-yellow-400 text-xs" />
                            <span className="text-sm font-medium">{matchedDriver.rating}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-400 border-t border-slate-700 pt-4">
                        <div className="flex justify-between">
                          <span>Vehicle:</span>
                          <span className="text-white font-medium">{matchedDriver.vehicle}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Plate:</span>
                          <span className="text-white font-medium">{matchedDriver.plate}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleConfirmBooking}
                      className="w-full rounded-3xl bg-sky-500 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 shadow-lg shadow-sky-500/20"
                    >
                      Confirm & Start Ride
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TRACKING STEP */}
            {step === "tracking" && (
              <div className="text-center py-8">
                <h3 className="text-lg font-semibold mb-4 text-white">
                  {rideStatus === "arriving" && "Driver is arriving"}
                  {rideStatus === "arrived" && "Driver has arrived"}
                  {rideStatus === "in-progress" && "Ride in progress"}
                  {rideStatus === "completed" && "Ride completed"}
                </h3>

                {matchedDriver && (
                  <div className="bg-slate-900 rounded-lg p-4 mb-4 border border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{matchedDriver.photo}</div>
                      <div className="text-left">
                        <div className="font-medium text-white">{matchedDriver.name}</div>
                        <div className="text-sm text-slate-400">{matchedDriver.vehicle}</div>
                      </div>
                    </div>
                  </div>
                )}

                {rideStatus === "completed" && (
                  <div className="space-y-3">
                    <button className="w-full rounded-3xl bg-sky-500 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
                      Rate Driver
                    </button>
                    <button onClick={resetBooking} className="w-full rounded-3xl bg-slate-800 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
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