/**
 * Marker elements for the map. Shared by the operator and commuter maps so
 * both render the same pins.
 */
export function createMarkerElement(color: string, glyph: string): HTMLElement {
  const element = document.createElement("div");
  element.style.width = "30px";
  element.style.height = "30px";
  element.style.backgroundColor = color;
  element.style.borderRadius = "50%";
  element.style.border = "3px solid white";
  element.style.boxShadow = `0 0 8px ${color}80`;
  element.style.cursor = "pointer";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "16px";
  element.textContent = glyph;
  return element;
}
