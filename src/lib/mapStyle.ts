import type maplibregl from "maplibre-gl";

const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/bright";

/** How long the map may stay faded before it is shown anyway. */
const RESTYLE_TIMEOUT_MS = 1500;

export function styleForTheme(theme: string): string {
  return theme === "dark" ? DARK_STYLE : LIGHT_STYLE;
}

/**
 * Swaps the style of a live map.
 *
 * The canvas is faded out while the new style loads, so the swap reads as a
 * change of light rather than a flash of empty map. The map instance is kept:
 * rebuilding it would throw away the WebGL context and every marker drawn on
 * it.
 */
export function applyMapStyle(
  mapInstance: maplibregl.Map,
  theme: string
): void {
  const container = mapInstance.getContainer();
  container.style.opacity = "0.4";

  let timer = 0;
  const restore = () => {
    window.clearTimeout(timer);
    container.style.opacity = "1";
  };

  timer = window.setTimeout(restore, RESTYLE_TIMEOUT_MS);
  mapInstance.once("idle", restore);
  mapInstance.setStyle(styleForTheme(theme));
}
