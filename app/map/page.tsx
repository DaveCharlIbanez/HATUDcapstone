"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // UI STATE
  const [open, setOpen] = useState(false);
  const [pickup, setPickup] = useState("My current location");
  const [dropoff, setDropoff] = useState("");

  useEffect(() => {
    if (map.current) return;

    if (mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/bright",
        center: [122.0175, 10.7883],
        zoom: 15,
      });

      // Marker
      const el = document.createElement("div");
      el.style.width = "15px";
      el.style.height = "15px";
      el.style.backgroundColor = "#4285F4";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";

      const userMarker = new maplibregl.Marker({ element: el })
        .setLngLat([0, 0])
        .addTo(map.current);

      // Geolocation
      if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            userMarker.setLngLat([longitude, latitude]);
            map.current?.flyTo({ center: [longitude, latitude], zoom: 15 });
          },
          (error) => console.error(error),
          { enableHighAccuracy: true }
        );
      }
    }
  }, []);

  return (
    <div className="relative w-full h-screen">
      
      {/* MAP */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* UI PANEL */}
      <div className="absolute bottom-0 w-full flex justify-center pointer-events-none">
        <div
          className={`w-full max-w-md bg-white rounded-t-3xl shadow-xl transition-all duration-300 pointer-events-auto
          ${open ? "h-[70%]" : "h-[140px]"}`}
        >

          {/* HANDLE */}
          <div
            className="flex justify-center py-2 cursor-pointer"
            onClick={() => setOpen(!open)}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          {/* CONTENT */}
          <div className="px-4 pb-4 overflow-y-auto h-full">

            {/* PICKUP */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-3 h-3 mt-2 bg-green-500 rounded-full"></div>
              <div className="w-full">
                <p className="text-xs text-gray-400">PICKUP</p>
                <input
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full text-sm outline-none border-b border-gray-200 focus:border-black"
                />
              </div>
            </div>

            {/* DROP OFF */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-3 h-3 mt-2 bg-red-500 rounded-full"></div>
              <div className="w-full">
                <p className="text-xs text-gray-400">DROP-OFF</p>
                <input
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Where to?"
                  className="w-full text-sm outline-none border-b border-gray-200 focus:border-black"
                />
              </div>
            </div>

            {/* EXTRA WHEN OPEN */}
            {open && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-gray-400">POPULAR LOCATIONS</p>

                <button className="w-full text-left p-2 hover:bg-gray-100 rounded-lg">
                 
                </button>
                <button className="w-full text-left p-2 hover:bg-gray-100 rounded-lg">
                 
                </button>
                <button className="w-full text-left p-2 hover:bg-gray-100 rounded-lg">
             
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

    </div>
  );
}