import Image from "next/image";

/**
 * The HATUD logo: the rider, the wordmark and "A Kinaray-a Ride-Booking Hub".
 *
 * The artwork is `HATUD-LOGO/`'s trace, cropped to the logo and lightly
 * optimised into `public/hatud-logo.svg` (transparent background; its white
 * sticker outline keeps it legible on light and dark themes alike). It is
 * drawn through `<img>`, so the browser rasterises it once and caches it.
 */
const LOGO_WIDTH = 1167;
const LOGO_HEIGHT = 1141;

export function HatudLogo({
  className = "",
  decorative = false,
  priority = false,
}: {
  className?: string;
  /** The name is already said next to it, so screen readers skip the image. */
  decorative?: boolean;
  /** Above the fold on the first screen: load it straight away. */
  priority?: boolean;
}) {
  return (
    <Image
      alt={decorative ? "" : "HATUD — A Kinaray-a Ride-Booking Hub"}
      className={`hatud-logo h-auto select-none ${className}`}
      draggable={false}
      height={LOGO_HEIGHT}
      priority={priority}
      src="/hatud-logo.svg"
      width={LOGO_WIDTH}
    />
  );
}
