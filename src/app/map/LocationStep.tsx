"use client";

import { FaMapMarkerAlt } from "react-icons/fa";
import {
  CATEGORY_INFO,
  type Landmark,
  MUNICIPALITY_LABELS,
  type Municipality,
} from "@/lib/landmarks";
import type { PlaceSuggestion } from "@/lib/mapClient";
import { DemoModeToggle } from "./DemoModeToggle";

interface LocationStepProps {
  /** The trip will be simulated instead of following GPS. */
  demoMode: boolean;
  dropoff: string;
  filteredLandmarks: Landmark[];
  isLocating: boolean;
  locationError: string | null;
  /** A standing notice that the driver will not be able to see the rider. */
  locationNotice: string | null;
  /** On to the payment step. */
  onContinue: () => void;
  onDemoModeChange: (enabled: boolean) => void;
  onPickupSearch: (value: string) => void;
  onPickupSelect: (place: PlaceSuggestion) => void;
  onRequestLocation: () => void;
  onSelectLandmark: (landmark: Landmark) => void;
  onSelectMunicipality: (municipality: Municipality | "all") => void;
  onToggleLandmarkDropdown: () => void;
  onUseMyLocation: () => void;
  pickup: string;
  pickupSuggestions: PlaceSuggestion[];
  selectedMunicipality: Municipality | "all";
  showLandmarkDropdown: boolean;
  theme: string;
}

export function LocationStep({
  demoMode,
  onDemoModeChange,
  pickup,
  dropoff,
  pickupSuggestions,
  filteredLandmarks,
  locationError,
  locationNotice,
  isLocating,
  theme,
  showLandmarkDropdown,
  selectedMunicipality,
  onPickupSearch,
  onPickupSelect,
  onRequestLocation,
  onUseMyLocation,
  onToggleLandmarkDropdown,
  onSelectMunicipality,
  onSelectLandmark,
  onContinue,
}: LocationStepProps) {
  return (
    <>
      <div className="mb-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 shrink-0 rounded-full bg-emerald-400" />
          <input
            className="flex-1 border-[var(--border)] border-b bg-transparent pb-2 text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
            onChange={(event) => onPickupSearch(event.target.value)}
            placeholder="Pickup location"
            value={pickup}
          />
          <button
            aria-label="Use my location"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-opacity ${
              theme === "light"
                ? "border-slate-400 bg-white text-sky-600 hover:bg-sky-100"
                : "border-slate-500 bg-slate-700 text-sky-400 hover:bg-slate-600"
            }`}
            disabled={isLocating}
            onClick={onUseMyLocation}
            title="Use my location"
            type="button"
          >
            {isLocating ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <title>Locate me</title>
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
              </svg>
            )}
          </button>
        </div>

        {locationError && (
          <div className="mb-2 rounded-lg border border-red-500/50 bg-red-500/20 px-3 py-2 text-red-400 text-sm">
            {locationError}
          </div>
        )}

        {locationNotice ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-amber-600 text-sm dark:text-amber-400">
            <span>{locationNotice}</span>
            <button
              className="shrink-0 rounded-lg bg-amber-400 px-2.5 py-1 font-semibold text-amber-950 text-xs transition hover:bg-amber-300"
              onClick={onRequestLocation}
              type="button"
            >
              Turn on
            </button>
          </div>
        ) : null}

        {pickupSuggestions.map((place) => (
          <button
            className="block w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 text-left text-[var(--foreground)] transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
            key={place.place_id}
            onClick={() => onPickupSelect(place)}
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
            onClick={onToggleLandmarkDropdown}
            type="button"
          >
            {dropoff || "Select destination"}
          </button>
        </div>

        {/* Always rendered, always the same size: switching it only changes
            what the row says, so the fields around it never move. */}
        <DemoModeToggle enabled={demoMode} onChange={onDemoModeChange} />
      </div>

      {showLandmarkDropdown && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            {(["all", "sanJose", "sibalom"] as const).map((municipality) => (
              <button
                className={`flex-1 rounded-full px-3 py-2 font-medium text-sm transition ${
                  selectedMunicipality === municipality
                    ? "bg-sky-500 text-white"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                }`}
                key={municipality}
                onClick={() => onSelectMunicipality(municipality)}
                type="button"
              >
                {municipality === "all"
                  ? "All"
                  : MUNICIPALITY_LABELS[municipality]}
              </button>
            ))}
          </div>

          <div className="max-h-60 space-y-2 overflow-y-auto">
            {filteredLandmarks.map((landmark) => (
              <button
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 text-left text-[var(--foreground)] transition hover:bg-[var(--surface)] hover:bg-sky-500"
                key={landmark.id}
                onClick={() => onSelectLandmark(landmark)}
                type="button"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{
                    backgroundColor: CATEGORY_INFO[landmark.category].color,
                  }}
                >
                  {CATEGORY_INFO[landmark.category].icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--foreground)] text-sm">
                    {landmark.name}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">
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
          onClick={onContinue}
          type="button"
        >
          Continue
        </button>
      )}
    </>
  );
}
