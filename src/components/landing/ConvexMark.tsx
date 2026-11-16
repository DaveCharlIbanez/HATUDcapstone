/**
 * A small mark for Convex, which `react-icons` does not carry.
 *
 * It is a simple three-arc mark in Convex's brand colours, drawn here rather
 * than fetched, so the landing page works offline inside the Android build.
 * Swap in the official SVG from Convex's brand kit if one is wanted.
 */
export function ConvexMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.5 15.5C3.2 11.3 5.6 6.6 9.8 5.1"
        stroke="#F3B01C"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <path
        d="M14.2 4.9c4.3.9 7.1 5.1 6.2 9.4"
        stroke="#EE342F"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <path
        d="M18.1 18.3c-3.2 2.9-8.2 2.8-11.3-.2"
        stroke="#8D2676"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}
