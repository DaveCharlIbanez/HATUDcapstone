"use client";

import { FaClock } from "react-icons/fa";

export interface VehicleOption {
  /** Fallback shown before the server quote arrives. */
  basePrice: number;
  capacity: number;
  eta: string;
  icon: string;
  name: string;
  type: "standard" | "priority";
}

export interface FareQuoteSummary {
  priority: { fare: number };
  standard: { fare: number };
}

interface VehiclePickerProps {
  canBook: boolean;
  fareQuote: FareQuoteSummary | undefined;
  onBook: () => void;
  onSelect: (vehicleType: VehicleOption["type"]) => void;
  selectedVehicle: string | null;
  vehicles: VehicleOption[];
}

export function VehiclePicker({
  vehicles,
  selectedVehicle,
  fareQuote,
  canBook,
  onSelect,
  onBook,
}: VehiclePickerProps) {
  const selectedName = vehicles.find(
    (vehicle) => vehicle.type === selectedVehicle
  )?.name;

  return (
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
            onClick={() => onSelect(vehicle.type)}
            type="button"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl text-sky-400">{vehicle.icon}</div>
                <div className="text-left">
                  <div className="font-semibold text-[var(--foreground)]">
                    {vehicle.name}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                    <FaClock className="text-xs" /> {vehicle.eta} •{" "}
                    {vehicle.capacity} passenger(s)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[var(--foreground)] text-lg">
                  ₱
                  {fareQuote ? fareQuote[vehicle.type].fare : vehicle.basePrice}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        className="mt-3 w-full rounded-2xl border-2 border-sky-500/50 bg-sky-600 py-4 font-bold text-base text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
        disabled={!canBook}
        onClick={onBook}
        type="button"
      >
        Book {selectedName ?? ""}
      </button>
    </>
  );
}
