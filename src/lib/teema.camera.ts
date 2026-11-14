export type StarCamera = { x: number; y: number; zoom: number };
export const STAR_OVERVIEW: StarCamera = { x: 0, y: 0, zoom: 1 };
export function zoomStarCamera(camera: StarCamera, requested: number, anchor: { x: number; y: number }): StarCamera {
  const zoom = Math.min(5, Math.max(0.65, requested));
  const ratio = zoom / camera.zoom;
  return { zoom, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}
export type Orbit = { yaw: number; pitch: number };
export type V3 = { x: number; y: number; z: number };
export const ORBIT_FOCAL = 2000;

/** Even (Fibonacci) spread of n theme stars on a sphere around the central star. */
export function spherePositions(n: number, radius: number): V3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * golden;
    return { x: Math.cos(a) * r * radius, y: y * radius * 0.8, z: Math.sin(a) * r * radius };
  });
}

/** Rotate by yaw (around Y) then pitch (around X); negative z faces the viewer. */
export function rotate(p: V3, o: Orbit): V3 {
  const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
  return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

export function perspective(z: number) { return ORBIT_FOCAL / (ORBIT_FOCAL + z); }

/** Orbit that brings point p straight in front of the viewer. */
export function facingOrbit(p: V3): Orbit {
  const yaw = Math.atan2(p.x, -p.z);
  const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  return { yaw, pitch: Math.atan2(-p.y, -z1) };
}
