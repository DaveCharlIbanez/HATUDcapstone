/**
 * Marks a demo trip — one the server drives along the road instead of GPS —
 * so the passenger and the driver both know the movement is simulated.
 */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      // fixoct48: a solid fill. The old translucent amber on amber text blended
      // into the panel, especially in light mode.
      className={`inline-flex items-center rounded-full border border-amber-600 bg-amber-400 px-2 py-0.5 font-extrabold text-[0.7rem] text-amber-950 uppercase tracking-[0.16em] shadow-sm ${className}`}
      title="Demo trip: the movement is simulated"
    >
      Demo
    </span>
  );
}
