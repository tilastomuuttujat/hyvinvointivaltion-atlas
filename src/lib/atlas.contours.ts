/** Topographic height field on the sphere (lat × angle grid) built from conclusion evidence. */
export type Peak = { lat: number; ang: number; w: number };
export type Field = { lats: number[]; angs: number[]; h: number[][]; max: number };
export type Seg = [[number, number], [number, number]]; // [lat, ang] pairs

const TAU = Math.PI * 2;

export function heightField(peaks: Peak[], nLat = 40, nAng = 80, sigma = 0.22): Field {
  const lats = Array.from({ length: nLat }, (_, i) => -1.45 + (i / (nLat - 1)) * 2.9);
  const angs = Array.from({ length: nAng + 1 }, (_, j) => (j / nAng) * TAU); // last column wraps to first
  const k = 1 / (2 * sigma * sigma);
  let max = 0;
  const h = lats.map((la) => angs.map((an) => {
    let v = 0;
    for (const p of peaks) {
      let da = Math.abs(an - p.ang) % TAU; if (da > Math.PI) da = TAU - da;
      const dx = da * Math.cos((la + p.lat) / 2), dy = la - p.lat;
      v += p.w * Math.exp(-(dx * dx + dy * dy) * k);
    }
    if (v > max) max = v;
    return v;
  }));
  return { lats, angs, h, max };
}

/** Marching squares: line segments where the field crosses `level`. */
export function contourSegments(f: Field, level: number): Seg[] {
  const out: Seg[] = [];
  const { lats, angs, h } = f;
  const lerp = (a: number, b: number, va: number, vb: number) => a + ((level - va) / (vb - va || 1e-9)) * (b - a);
  for (let i = 0; i < lats.length - 1; i++) for (let j = 0; j < angs.length - 1; j++) {
    const v0 = h[i]![j]!, v1 = h[i]![j + 1]!, v2 = h[i + 1]![j + 1]!, v3 = h[i + 1]![j]!;
    const la0 = lats[i]!, la1 = lats[i + 1]!, an0 = angs[j]!, an1 = angs[j + 1]!;
    const e: [number, number][] = [];
    if ((v0 >= level) !== (v1 >= level)) e.push([la0, lerp(an0, an1, v0, v1)]);
    if ((v1 >= level) !== (v2 >= level)) e.push([lerp(la0, la1, v1, v2), an1]);
    if ((v3 >= level) !== (v2 >= level)) e.push([la1, lerp(an0, an1, v3, v2)]);
    if ((v0 >= level) !== (v3 >= level)) e.push([lerp(la0, la1, v0, v3), an0]);
    if (e.length >= 2) out.push([e[0]!, e[1]!]);
    if (e.length === 4) out.push([e[2]!, e[3]!]);
  }
  return out;
}

/** Filled region where the field is ≥ `level`, clipped per cell along the same interpolated edges as contourSegments. */
export function contourFill(f: Field, level: number): [number, number][][] {
  const out: [number, number][][] = [];
  const { lats, angs, h } = f;
  const t = (va: number, vb: number) => (level - va) / (vb - va || 1e-9);
  for (let i = 0; i < lats.length - 1; i++) for (let j = 0; j < angs.length - 1; j++) {
    const la0 = lats[i]!, la1 = lats[i + 1]!, an0 = angs[j]!, an1 = angs[j + 1]!;
    const cs: [number, number, number][] = [
      [la0, an0, h[i]![j]!], [la0, an1, h[i]![j + 1]!], [la1, an1, h[i + 1]![j + 1]!], [la1, an0, h[i + 1]![j]!],
    ];
    if (cs.every((c) => c[2] < level)) continue;
    const poly: [number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const a = cs[k]!, b = cs[(k + 1) % 4]!;
      if (a[2] >= level) poly.push([a[0], a[1]]);
      if ((a[2] >= level) !== (b[2] >= level)) {
        const s = t(a[2], b[2]);
        poly.push([a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])]);
      }
    }
    if (poly.length >= 3) out.push(poly);
  }
  return out;
}
