import { useEffect, useState } from "react";
import { getRoadmap } from "@/lib/atlas.static";
import type { Roadmap } from "@/lib/atlas.roadmap";

const card = "rounded-lg border border-border p-4";
const button =
  "rounded-md border border-border px-3 py-2 text-left hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary/10";
const labels: Record<string, string> = {
  claim: "Väite",
  mechanism: "Mekanismi",
  applicability: "Soveltuvuus",
  intervening_changes: "Välissä tapahtuneet muutokset",
  limitations: "Rajaukset",
  locator: "Kohta lähteessä",
  rationale: "Yhteys väitteeseen",
  finding: "Tutkimushavainto",
  year: "Vuosi",
  value: "Arvo",
  unit: "Yksikkö",
  baseline_or_path: "Lähtötilanne ja kehityspolku",
  drivers_and_assumptions: "Oletukset ja muutostekijät",
  situation: "Tilanne",
  available_capacity: "Toimintavara",
  constraints: "Rajoitteet",
  distribution: "Vaikutusten jakautuminen",
  uncertainty: "Epävarmuus",
  label: "Mittari",
  definition: "Määritelmä",
};
const detailLabels: Record<string, string> = {
  explanation: "Selitys",
  evidence: "Havainto tai lähde",
  scenario_context: "Skenaarion lähtötiedot",
  scenario_stage: "Skenaarion vaihe",
  metric_candidate: "Mittariehdokas",
};

function years(item: { start_year: number | null; end_year: number | null }) {
  if (item.start_year == null)
    return item.end_year == null ? "" : "Vuoteen " + item.end_year;
  if (item.end_year == null) return item.start_year + " alkaen";
  return item.start_year === item.end_year
    ? String(item.start_year)
    : item.start_year + "–" + item.end_year;
}

function sourceUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function AtlasRoadmap() {
  const [data, setData] = useState<Roadmap>();
  const [status, setStatus] = useState("Ladataan tiekarttaa…");
  useEffect(() => {
    let active = true;
    getRoadmap()
      .then((roadmap) => {
        if (!active) return;
        if (roadmap) setData(roadmap);
        else
          setStatus(
            "Tiekartta tulee näkyviin seuraavan Neon-aineistopäivityksen yhteydessä.",
          );
      })
      .catch(() => {
        if (active)
          setStatus(
            "Tiekartan aineistoa ei saatu ladattua. Kokeile päivittää sivu.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section
      className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8"
      aria-label="Suomen rakennemuutosten tiekartta"
    >
      <h2 className="font-display text-3xl">
        Suomen rakennemuutosten tiekartta
      </h2>
      {data ? <RoadmapContent data={data} /> : <p role="status">{status}</p>}
    </section>
  );
}

function RoadmapContent({ data }: { data: Roadmap }) {
  const [routeId, setRouteId] = useState(data.routes[0]?.phenomenon_id);
  const [stateId, setStateId] = useState("");
  const [trail, setTrail] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const stages = data.stages.filter((s) => s.phenomenon_id === routeId);
  const stage = stages.find((s) => s.state_id === stateId) ?? stages[0];
  const chainId = trail.at(-1);
  const chain = data.chains.find((c) => c.chain_id === chainId);
  const childIds = new Set(
    data.links
      .filter((l) =>
        chainId
          ? l.parent_phenomenon_id === chainId && !trail.includes(l.chain_id)
          : l.parent_phenomenon_id === routeId &&
            l.parent_state_id === stage?.state_id,
      )
      .map((l) => l.chain_id),
  );
  const children = data.chains.filter((c) => childIds.has(c.chain_id));
  const details = data.details.filter((d) => d.chain_id === chainId);
  const intersections = data.intersections.filter((i) =>
    i.links.some((l) => l.route_id === routeId),
  );
  const boundaries = data.boundaries.filter(
    (b) => b.from_route_id === routeId || b.to_route_id === routeId,
  );

  function navigate(
    nextRoute: string,
    nextState = "",
    nextTrail: string[] = [],
  ) {
    setRouteId(nextRoute);
    setStateId(nextState);
    setTrail(nextTrail);
    setShowDetails(false);
  }

  return (
    <>
      <div className={card}>
        <h3 className="mb-3 text-lg font-semibold">I. Pääreitit</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.routes.map((r) => (
            <button
              type="button"
              key={r.phenomenon_id}
              className={button}
              aria-pressed={r.phenomenon_id === routeId}
              onClick={() => navigate(r.phenomenon_id)}
            >
              <span className="block text-sm font-semibold">{years(r)}</span>
              {r.title.replace(/^Pää(?:ketju|reitti) [IVX]+:\s*/i, "")}
            </button>
          ))}
        </div>
      </div>
      <div className={card}>
        <h3 className="mb-3 text-lg font-semibold">
          II. Vaiheet ja risteykset
        </h3>
        <div className="flex flex-wrap gap-2">
          {stages.map((s) => (
            <button
              type="button"
              key={s.state_id}
              className={button}
              aria-pressed={s.state_id === stage?.state_id}
              onClick={() => navigate(routeId, s.state_id)}
            >
              {s.title}
            </button>
          ))}
        </div>
        {stage?.situation && <p className="mt-3">{stage.situation}</p>}
        <ul className="mt-3 space-y-2">
          {boundaries.map((b) => (
            <li key={b.boundary_year}>
              <button
                type="button"
                className="text-left text-primary underline"
                onClick={() =>
                  navigate(
                    b.from_route_id === routeId
                      ? b.to_route_id
                      : b.from_route_id,
                    b.from_route_id === routeId
                      ? b.to_state_id
                      : b.from_state_id,
                  )
                }
              >
                {b.boundary_year} · {b.title}
              </button>
            </li>
          ))}
          {intersections.map((i) => (
            <li key={i.phenomenon_id}>
              <button
                type="button"
                className="text-left text-primary underline"
                onClick={() =>
                  navigate(
                    routeId,
                    i.links.find((l) => l.route_id === routeId)?.state_id,
                    [i.phenomenon_id],
                  )
                }
              >
                {i.title}
              </button>
              <span className="ml-2 text-sm text-muted-foreground">
                Reitit{" "}
                {i.route_orders
                  .map((n) => ["I", "II", "III", "IV", "V"][n - 1])
                  .join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={card}>
        <h3 className="mb-3 text-lg font-semibold">
          III. Alaketjut ja vaikutusverkostot
        </h3>
        {chain && (
          <>
            <button
              type="button"
              className={button}
              onClick={() =>
                navigate(routeId, stage?.state_id, trail.slice(0, -1))
              }
            >
              Takaisin
            </button>
            <h4 className="mt-3 text-xl font-semibold">{chain.title}</h4>
            <p className="text-sm text-muted-foreground">
              {[
                years(chain),
                chain.phenomenon_kind === "hypothetical" ? "Skenaario" : "",
                chain.review_status === "needs_review" ? "Tarkistettavana" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-2">{chain.reader_question}</p>
            <p className="mt-2">{chain.observed_change}</p>
          </>
        )}
        <ul className="mt-3 space-y-2">
          {children.map((c) => (
            <li key={c.chain_id}>
              <button
                type="button"
                className={button}
                onClick={() =>
                  navigate(routeId, stage?.state_id, [...trail, c.chain_id])
                }
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
        {!chain && children.length === 0 && (
          <p>Tähän vaiheeseen ei ole linkitetty alaketjuja.</p>
        )}
      </div>
      {chain && (
        <div className={card}>
          <h3 className="text-lg font-semibold">
            <button
              type="button"
              className={button}
              aria-expanded={showDetails}
              aria-controls="roadmap-details"
              onClick={() => setShowDetails(!showDetails)}
            >
              IV. Havainnot ja perustelut ({details.length})
            </button>
          </h3>
          <div
            id="roadmap-details"
            hidden={!showDetails}
            className="mt-3 space-y-3"
          >
            {details.length === 0 && (
              <p>Ketjulle ei ole julkaistuja havaintoja tai perusteluja.</p>
            )}
            {details.map(({ detail, ...d }) => {
              const url = sourceUrl(detail.source_url);
              const source =
                typeof detail.source_title === "string"
                  ? detail.source_title
                  : "Avaa lähde";
              return (
                <article
                  className={card}
                  key={d.detail_kind + ":" + d.detail_id}
                >
                  <h4 className="font-semibold">
                    {detailLabels[d.detail_kind] ?? "Perustelu"}
                  </h4>
                  {(d.stage_title || d.transition_title) && (
                    <p className="text-sm">
                      {[d.stage_title, d.transition_title]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <dl className="mt-2 space-y-2">
                    {Object.entries(labels).map(([key, label]) => {
                      const value = detail[key];
                      return (typeof value === "string" && value.trim()) ||
                        typeof value === "number" ? (
                        <div key={key}>
                          <dt className="text-sm font-medium">{label}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ) : null;
                    })}
                  </dl>
                  {url ? (
                    <a className="text-primary underline" href={url}>
                      {source}
                    </a>
                  ) : (
                    typeof detail.source_title === "string" && (
                      <p>{detail.source_title}</p>
                    )
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
