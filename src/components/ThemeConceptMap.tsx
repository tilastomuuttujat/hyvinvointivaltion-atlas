import { catalogueFor } from "@/lib/teema.system";
import { ThemeSelectionDetails } from "./ThemeSelectionDetails";
import { useMemo, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import {
  buildThemeMap,
  themeDetail,
  type ThemeConcept,
} from "@/lib/atlas.themes";

export function ThemeConceptMap({ data }: { data: AtlasData }) {
  const catalog = catalogueFor(data);
  const model = useMemo(() => buildThemeMap(data), [data]);
  const [cam, setCam] = useState({ x: 0, y: 0, z: 1 });
  const [sel, setSel] = useState<ThemeConcept | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const detail = themeDetail(cam.z);
  const periods = new Map(data.periods.map((p) => [p.id, p.label]));
  const titles = new Map(data.conclusions.map((c) => [c.id, c.title]));

  const zoomAt = (f: number, cx = model.width / 2, cy = model.height / 2) =>
    setCam((c) => {
      const z = Math.min(8, Math.max(1, c.z * f));
      const k = z / c.z;
      return z === 1
        ? { x: 0, y: 0, z }
        : { z, x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k };
    });
  const toWorld = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: ((cx - r.left) / r.width) * model.width,
      y: ((cy - r.top) / r.height) * model.height,
    };
  };
  const fs = (px: number) => px / cam.z;
  const linked = sel ? new Set(sel.conclusions) : null;

  return (
    <section className="theme-map">
      <header className="theme-map-head">
        <div>
          <h2>Käsitekartta · koko atlas</h2>
          <p>
            {model.themes.length} teema-aluetta · {model.conclusions.length}{" "}
            päätelmää · {model.concepts.length} kirjattua käsitettä. Zoomaa
            lähemmäs: teemat → päätelmät → kaikki käsitteet.
          </p>
        </div>
        <div className="theme-map-zoom">
          <button onClick={() => zoomAt(1.4)} aria-label="Lähennä">
            +
          </button>
          <button onClick={() => zoomAt(1 / 1.4)} aria-label="Loitonna">
            −
          </button>
          <button onClick={() => setCam({ x: 0, y: 0, z: 1 })}>
            Koko kartta
          </button>
          <span>{["Teemat", "Päätelmät", "Käsitteet"][detail]}</span>
        </div>
      </header>
      <div className="theme-map-body">
        <svg
          ref={svg}
          viewBox={`0 0 ${model.width} ${model.height}`}
          className="theme-map-svg"
          style={{ touchAction: "none" }}
          onWheel={(e) => {
            const w = toWorld(e.clientX, e.clientY);
            zoomAt(Math.exp(-e.deltaY * 0.0015), w.x, w.y);
          }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!pts.current.has(e.pointerId)) return;
            pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pts.current.size === 2) {
              const [a, b] = [...pts.current.values()];
              const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
              if (pinch.current) {
                const m = toWorld((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
                zoomAt(d / pinch.current, m.x, m.y);
              }
              pinch.current = d;
              return;
            }
            if (!drag.current) return;
            const r = svg.current!.getBoundingClientRect();
            const dx = ((e.clientX - drag.current.x) / r.width) * model.width,
              dy = ((e.clientY - drag.current.y) / r.height) * model.height;
            drag.current = { x: e.clientX, y: e.clientY };
            if (cam.z > 1) setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
          }}
          onPointerUp={(e) => {
            pts.current.delete(e.pointerId);
            if (pts.current.size < 2) pinch.current = null;
            if (!pts.current.size) drag.current = null;
          }}
          onPointerCancel={(e) => {
            pts.current.delete(e.pointerId);
            pinch.current = null;
            drag.current = null;
          }}
        >
          <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.z})`}>
            {model.themes.map((t) => (
              <g key={t.id}>
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={t.r}
                  fill={t.color}
                  fillOpacity={0.07}
                  stroke={t.color}
                  strokeOpacity={0.45}
                  strokeWidth={fs(1.5)}
                />
                <text
                  x={t.x}
                  y={t.y - t.r - fs(10)}
                  textAnchor="middle"
                  className="theme-map-theme"
                  fontSize={fs(24)}
                  fill={t.color}
                >
                  {t.label}
                </text>
              </g>
            ))}
            {sel &&
              sel.conclusions.map((id) => {
                const n = model.conclusions.find((c) => c.id === id);
                return n ? (
                  <line
                    key={id}
                    x1={sel.x}
                    y1={sel.y}
                    x2={n.x}
                    y2={n.y}
                    stroke="var(--primary)"
                    strokeWidth={fs(1.5)}
                    strokeOpacity={0.8}
                  />
                ) : null;
              })}
            {model.conclusions.map((n) => (
              <g key={n.id} opacity={linked && !linked.has(n.id) ? 0.35 : 1}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={fs(detail ? 6 : 4)}
                  fill="var(--foreground)"
                  fillOpacity={0.8}
                />
                {detail >= 1 && (
                  <text
                    x={n.x}
                    y={n.y + fs(18)}
                    textAnchor="middle"
                    fontSize={fs(12)}
                    className="theme-map-conclusion"
                  >
                    {n.id}.{" "}
                    {n.title.length > 42 ? n.title.slice(0, 40) + "…" : n.title}
                  </text>
                )}
              </g>
            ))}
            {model.concepts
              .filter((c) => detail === 2 || c.anchor)
              .map((c) => (
                <g
                  key={c.key}
                  className="theme-map-concept"
                  onClick={() => setSel(c)}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ cursor: "pointer" }}
                >
                  <text
                    x={c.x}
                    y={c.y}
                    textAnchor="middle"
                    fontSize={fs(c.anchor ? (detail === 0 ? 15 : 11) : 9)}
                    fill={
                      sel?.key === c.key
                        ? "var(--primary)"
                        : c.anchor
                          ? "var(--accent-foreground)"
                          : "var(--muted-foreground)"
                    }
                    fontWeight={c.anchor ? 600 : 400}
                  >
                    ◇{" "}
                    {c.label.length > 28 ? c.label.slice(0, 26) + "…" : c.label}
                  </text>
                </g>
              ))}
          </g>
        </svg>
        {sel && (
          <aside className="theme-map-card">
            <button
              className="theme-map-close"
              onClick={() => setSel(null)}
              aria-label="Sulje"
            >
              ×
            </button>
            {catalog.themes.find((t) =>
              t.concepts.some((c) => c.id === sel.key),
            ) && (
              <ThemeSelectionDetails
                data={data}
                theme={catalog.themes.find((t) =>
                  t.concepts.some((c) => c.id === sel.key),
                )!}
                kind="concept"
                label={sel.key}
              />
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
