"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // UI STATE
  const [open, setOpen] = useState(false);
  const [pickup, setPickup] = useState("My current location");
  const [dropoff, setDropoff] = useState("");

  useEffect(() => {
    if (map.current) {
      return;
    }

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
    <div className="relative h-screen w-full">
      {/* MAP */}
      <div className="h-full w-full" ref={mapContainer} />

      {/* UI PANEL */}
      <div className="pointer-events-none absolute bottom-0 flex w-full justify-center">
        <div
          className={`pointer-events-auto w-full max-w-md rounded-t-3xl bg-white shadow-xl transition-all duration-300 ${open ? "h-[70%]" : "h-[140px]"}`}
        >
          {/* HANDLE */}
          <div
            className="flex cursor-pointer justify-center py-2"
            onClick={() => setOpen(!open)}
          >
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>

          {/* CONTENT */}
          <div className="h-full touch-pan-y overflow-y-auto overscroll-contain px-4 pb-4">
            {/* PICKUP */}
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-2 h-3 w-3 rounded-full bg-green-500" />
              <div className="w-full">
                <p className="text-gray-400 text-xs">PICKUP</p>
                <input
                  className="w-full border-gray-200 border-b text-sm outline-none focus:border-black"
                  onChange={(e) => setPickup(e.target.value)}
                  value={pickup}
                />
              </div>
            </div>

            {/* DROP OFF */}
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-2 h-3 w-3 rounded-full bg-red-500" />
              <div className="w-full">
                <p className="text-gray-400 text-xs">DROP-OFF</p>
                <input
                  className="w-full border-gray-200 border-b text-sm outline-none focus:border-black"
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Where to?"
                  value={dropoff}
                />
              </div>
            </div>

            {/* EXTRA WHEN OPEN */}
            {open && (
              <div className="mt-4 text-sm">
                <p className="mb-3 text-gray-400">POPULAR LOCATIONS</p>
                <div className="flex flex-wrap gap-2">

                {["San Jose de Buenavista", "Hamtic", "Sibalom"].map((loc) => (
                  <button
                    className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-gray-700 text-sm transition hover:bg-gray-200 active:bg-gray-300"
                    key={loc}
                    onClick={() => { setDropoff(loc); setOpen(true); }}
                  >
                    {loc}
                  </button>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
