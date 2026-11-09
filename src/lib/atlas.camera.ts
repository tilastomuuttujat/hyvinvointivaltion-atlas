export type Camera = { zoom: number; x: number; y: number };
export function zoomCamera(camera: Camera, nextZoom: number, anchor: { x: number; y: number }): Camera {
  const zoom = Math.max(0.6, Math.min(3, nextZoom));
  const k = zoom / camera.zoom;
  return { zoom, x: anchor.x - (anchor.x - camera.x) * k, y: anchor.y - (anchor.y - camera.y) * k };
}
export function wheelZoom(zoom: number, delta: number, mode: number): number {
  return zoom * Math.exp(-delta * (mode === 1 ? 16 : mode === 2 ? 100 : 1) * 0.0015);
}
