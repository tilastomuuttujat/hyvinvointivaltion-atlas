import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import { chainStory, recordedRouteFamilies, type RecordedRoute } from "@/lib/atlas.impact-story";
import type { useGraphExplore } from "./GraphExplore";

type Exploration = ReturnType<typeof useGraphExplore>;

export function ImpactInsight({ data, e }: { data: AtlasData; e: Exploration }) {
  const families = useMemo(() => recordedRouteFamilies(data), [data]);
  const story = useMemo(() => chainStory(data, e.steps), [data, e.steps]);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const play = (route: { id: string; via?: string }[]) => {
    if (timer.current) clearInterval(timer.current);
    let n = 1;
    e.load(route.slice(0, 1));
    if (route.length < 2) return;
    timer.current = setInterval(() => {
      n++;
      e.load(route.slice(0, n));
      if (n >= route.length && timer.current) clearInterval(timer.current);
    }, 900);
  };
  const key = (r: { id: string; via?: string }[]) => r.map((s) => `${s.via ?? ""}>${s.id}`).join("|");
  const active = families.flatMap((f) => f.routes.map((r) => ({ f, r }))).find(({ r }) => key(r.steps) === key(e.steps));
  const siblings = active ? active.f.routes.filter((r) => r.id !== active.r.id) : [];

  const routeCard = (r: RecordedRoute) => (
    <button key={r.id} type="button" className="impact-route-card" onClick={() => play(r.steps)}>
      <strong>{r.title}</strong>
      <span className="impact-route-end">päätyy: {r.endLabel} · {r.steps.length} askelta</span>
      <span className="impact-route-intro">{r.introduction}</span>
    </button>
  );

  if (!e.current)
    return (
      <section className="impact-insight" aria-label="Valmiit vaikutusreitit">
        <header>
          <p>Aloita valmiista reitistä</p>
          <h3>Sama lähtökohta voi kulkea eri suuntiin</h3>
          <span>Toimitetut reitit näytetään askel kerrallaan kartalla. Rinnakkaiset reitit lähtevät samasta kirjatusta käsitteestä.</span>
        </header>
        <div className="impact-families">
          {families.map((f) => (
            <div key={f.startId} className="impact-family">
              <h4>{f.startLabel}</h4>
              {f.routes.map(routeCard)}
            </div>
          ))}
        </div>
      </section>
    );

  const total = story.links.length;
  return (
    <section className="impact-insight" aria-label="Ketjun tulkinta" aria-live="polite">
      <header>
        <p>{active ? "Toimitettu reitti" : "Oma reittisi"}</p>
        <h3>{active ? active.r.title : `${story.labels[0]} → ${story.labels.at(-1)}`}</h3>
        {active && <span>{active.r.introduction}</span>}
      </header>

      <ol className="impact-story-strip">
        {story.labels.map((l, i) => (
          <li key={i}>
            {i > 0 && story.links[i - 1] && (
              <span className={`impact-story-link${story.links[i - 1]!.causal ? " causal" : ""}`}>
                {story.links[i - 1]!.mechanism.label}
              </span>
            )}
            <b><i>{i + 1}</i>{l}</b>
          </li>
        ))}
      </ol>

      {total === 0 ? (
        <p className="impact-story-hint">Valitse kartalta sykkivä jatkopiste, niin ketjun tulkinta rakentuu tähän.</p>
      ) : (
        <div className="impact-story-grid">
          <div>
            <h4>Miten vaikutus välittyy</h4>
            <ul className="impact-story-steps">
              {story.links.map((l, i) => (
                <li key={i}>
                  <em>{l.fromLabel} → {l.toLabel}</em>
                  <span>{l.mechanism.explanation}</span>
                  {l.mechanism.conditions && <small>Pätee, kun: {l.mechanism.conditions}</small>}
                  <button type="button" onClick={() => e.inspect("mechanism", l.mechanism.id)}>Perusteet ja lähteet</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Kuinka vahvalla pohjalla</h4>
            <div className="impact-meter" role="img" aria-label={`${story.causal} kausaaliseksi arvioitua, ${story.proposed} selitysehdotusta`}>
              <span className="causal" style={{ flex: story.causal || 0.0001 }} />
              <span className="proposed" style={{ flex: story.proposed || 0.0001 }} />
            </div>
            <p className="impact-meter-key">
              <b>{story.causal}</b> kausaaliseksi arvioitua · <b>{story.proposed}</b> selitysehdotusta · <b>{story.conditional}</b> ehdollista
            </p>
            <h4>Missä tilanteessa</h4>
            <p>
              {story.overlap
                ? `Kirjatut ajanjaksot kohtaavat vuosina ${story.overlap.start}–${story.overlap.end}: koko ketju on luettavissa tässä aikaikkunassa.`
                : story.disjoint
                  ? "Askelten kirjatut ajanjaksot eivät kohtaa – ketju yhdistää eri aikojen tilanteita."
                  : "Ajoitusta ei ole kirjattu."}
              {story.openTiming > 0 && ` ${story.openTiming} yhteydellä avoin ajoitus.`}
            </p>
            {active?.r.limitations && <p className="impact-story-limit">Rajaus: {active.r.limitations}</p>}
            <p className="impact-story-limit">Ketju näyttää kirjatut välitysmekanismit, ei koko vaikutuksen suuruutta.</p>
          </div>
        </div>
      )}

      <div className="impact-story-actions">
        {total > 0 && (
          <button type="button" onClick={() => play(e.steps)}>▶ Toista reitti</button>
        )}
        {total > 0 && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(story.text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? "✓ Kopioitu" : "Kopioi tiivistelmä"}
          </button>
        )}
        {siblings.map((r) => (
          <button key={r.id} type="button" className="alt" onClick={() => play(r.steps)}>
            ⇄ Vertaa toiseen kulkuun: {r.title}
          </button>
        ))}
        <button type="button" onClick={() => e.clear()}>Aloita alusta</button>
      </div>
    </section>
  );
}
