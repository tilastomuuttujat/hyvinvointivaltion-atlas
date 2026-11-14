export type StarCamera = { x: number; y: number; zoom: number };
export const STAR_OVERVIEW: StarCamera = { x: 0, y: 0, zoom: 1 };
export function zoomStarCamera(camera: StarCamera, requested: number, anchor: { x: number; y: number }): StarCamera {
  const zoom = Math.min(5, Math.max(0.65, requested));
  const ratio = zoom / camera.zoom;
  return { zoom, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}