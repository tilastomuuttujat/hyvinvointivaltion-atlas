import { useEffect, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { AtlasData } from "@/lib/atlas.functions";
import { getTreatments } from "@/lib/atlas.static";
import {
  COMPARISON_COLORS,
  COMPARISON_PHASES,
  type ComparisonReport,
} from "@/lib/atlas.comparison";
import {
  relationLabel,
  reviewLabel,
  sourceCheck,
} from "@/lib/atlas.navigation";
export function ConclusionPicker({
  data,
  ids,
  onChange,
  onStart,
  onClose,
}: {
  data: AtlasData;
  ids: number[];
  onChange: (ids: number[]) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = data.conclusions.filter((c) =>
    `${c.id} ${c.title} ${c.claim}`
      .toLocaleLowerCase("fi-FI")
      .includes(search.toLocaleLowerCase("fi-FI").trim()),
  );
  return (
    <section
      className="comparison-picker"
      aria-label="Valitse vertailtavat päätelmät"
    >
      <div className="comparison-picker-heading">
        <div>
          <h2>Mitkä päätelmät haluat ymmärtää yhdessä?</h2>
          <p>
            Valitse 2–3. Valinta tarkoittaa tarkasteluun ottamista, ei päätelmän
            hyväksymistä todeksi.
          </p>
        </div>
        <button type="button" onClick={onClose}>
          Sulje valinta
        </button>
      </div>
      <label className="comparison-search">
        Etsi päätelmää
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kirjoita aihe tai päätelmän numero"
        />
      </label>
      <div className="comparison-picked" aria-live="polite">
        {ids.length} / 3 valittu
        {ids.map((id, i) => (
          <button
            type="button"
            key={id}
            onClick={() => onChange(ids.filter((x) => x !== id))}
            aria-label={`Poista päätelmä ${id} vertailuvalinnasta`}
            style={{ borderColor: COMPARISON_COLORS[i] }}
          >
            {String.fromCharCode(65 + i)} ·{" "}
            {data.conclusions.find((c) => c.id === id)?.title} ×
          </button>
        ))}
      </div>
      <fieldset>
        <legend>Päätelmät ({filtered.length})</legend>
        <div className="comparison-catalog">
          {filtered.map((c) => (
            <label key={c.id} className={ids.includes(c.id) ? "is-picked" : ""}>
              <input
                type="checkbox"
                aria-label={`Päätelmä ${c.id}: ${c.title}`}
                checked={ids.includes(c.id)}
                disabled={!ids.includes(c.id) && ids.length === 3}
                onChange={() =>
                  onChange(
                    ids.includes(c.id)
                      ? ids.filter((id) => id !== c.id)
                      : [...ids, c.id],
                  )
                }
              />
              <span>
                <strong>
                  {c.id}. {c.title}
                </strong>
                <small>{c.kind}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {!filtered.length && (
        <p>
          Hakua vastaavaa päätelmää ei löytynyt. Valitut päätelmät säilyvät
          hakua muuttaessa.
        </p>
      )}
      <div className="comparison-picker-actions">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={!ids.length}
        >
          Tyhjennä valinnat
        </button>
        <button
          className="comparison-primary"
          type="button"
          disabled={ids.length < 2}
          onClick={onStart}
        >
          Näytä yhteydet ja erot
        </button>
      </div>
    </section>
  );
}
export function ComparisonNarrative({
  data,
  report,
  phase,
  onPhase,
  onInspect,
  onEdit,
  onExit,
  onPeriod,
  focus,
  editing,
}: {
  data: AtlasData;
  report: ComparisonReport;
  phase: number;
  onPhase: (phase: number) => void;
  onInspect: (id: number) => void;
  onEdit: () => void;
  onExit: () => void;
  onPeriod: (id: string | null) => void;
  focus: { c?: number; pair?: string; p: string } | null;
  editing: boolean;
}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView?.({block:"nearest",behavior:"auto"})},[]);
  const [basis, setBasis] = useState(false),
    [playing, setPlaying] = useState(false),
    [reduced, setReduced] = useState(false),
    [limit, setLimit] = useState(12);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    setPlaying(false);
    setLimit(12);
  }, [report]);
  useEffect(() => {
    if (!playing || reduced) return;
    if (phase === 2) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => onPhase(phase + 1), 7000);
    return () => clearTimeout(timer);
  }, [playing, reduced, phase, onPhase]);
  useEffect(()=>{if(editing||focus)setPlaying(false)},[editing,focus]);
  const treatments = useQueries({
    queries: report.ids.map((id) => ({
      queryKey: ["static-treatments", id],
      queryFn: () => getTreatments({ data: { conclusionId: id } }),
      enabled: basis,
    })),
  });
  const chapter = report.stories[phase];
  const periodName = (id: string) =>
    data.periods.find((p) => p.id === id)?.label ?? id;
  const profile = (id: number) =>
    report.profiles.find((p) => p.conclusion.id === id)!;
  const current = focus?.pair
    ? report.links.find((l) => l.key === focus.pair)
    : undefined;
  const basisRows = treatments.flatMap((query, index) =>
    (query.data ?? [])
      .filter(
        (t) =>
          t.reviewStatus !== "rejected" &&
          (!report.periodId || t.periodId === report.periodId),
      )
      .map((t) => ({ ...t, c: report.ids[index] })),
  );
  const choosePhase = (p: number) => {
    setPlaying(false);
    onPhase(p);
  };
  return (
    <section
      className="comparison-narrative"
      aria-label="Päätelmien vertaileva kertomus"
    >
      <p className="experience-eyebrow">
        {report.periodLabel} · Vertailu {phase + 1} / 3
      </p>
      <div className="comparison-legend">
        {report.profiles.map((p) => (
          <span key={p.conclusion.id} style={{ borderColor: p.color }}>
            <b style={{ color: p.color }}>{p.letter}</b> {p.conclusion.title}
          </span>
        ))}
      </div>
      <nav
        className="comparison-phases"
        aria-label="Vertailukertomuksen vaiheet"
      >
        {COMPARISON_PHASES.map((label, i) => (
          <button
            type="button"
            key={label}
            aria-current={phase === i ? "step" : undefined}
            onClick={() => choosePhase(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>
      <div key={phase} className="comparison-chapter" aria-live="polite">
        <h2 ref={heading} tabIndex={-1}>{chapter.title}</h2>
        <p className="comparison-main">{chapter.text}</p>
        <p className="experience-caution">{chapter.limitation}</p>
      </div>
      {phase === 0 && (
        <>
          {report.commonAll.length > 0 && (
            <p className="comparison-note">
              Yhteinen rakenne tarkoittaa samoja kirjattuja artikkeleita tai
              käsitesanoja samalla aikakaudella. Se ei vielä osoita yhteistä
              mekanismia.
            </p>
          )}
          <details className="experience-limits">
            <summary>Kirjatut yhteydet ({report.links.length})</summary>
            {report.links.map((link) => (
              <p key={link.key}>
                <strong>
                  {profile(link.left).letter}–{profile(link.right).letter} ·{" "}
                  {periodName(link.periodId)}
                </strong>
                <br />
                {link.articles.length > 0
                  ? `Yhteiset artikkelit: ${link.articles.join(", ")}. `
                  : ""}
                {link.concepts.length > 0
                  ? `Yhteiset käsitesanat: ${link.concepts.join("; ")}. `
                  : ""}
                {link.allAccepted
                  ? "Molempien päiden kirjaukset on tarkistettu."
                  : "Mukana on tarkistamattomia kirjauksia."}{" "}
                Asiayhteys, ei kausaalinen todiste.
              </p>
            ))}
          </details>
        </>
      )}
      {phase === 1 && (
        <>
          <div className="comparison-table-scroll">
            <table>
              <caption>Aineiston kattavuus valitussa aikarajauksessa</caption>
              <thead>
                <tr>
                  <th>Päätelmä</th>
                  <th>Jaksoja</th>
                  <th>Artikkeleita</th>
                  <th>Vastanäyttökytkentöjä</th>
                </tr>
              </thead>
              <tbody>
                {report.profiles.map((p) => (
                  <tr key={p.conclusion.id}>
                    <th style={{ color: p.color }}>{p.letter}</th>
                    <td>{p.periodIds.length}</td>
                    <td>{p.articles.length}</td>
                    <td>{p.counter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="comparison-matrix"
            aria-label="Päätelmien ajallinen käsittely"
          >
            {report.profiles.map((p) => (
              <div key={p.letter}>
                <strong style={{ color: p.color }}>{p.letter}</strong>
                {data.periods.map((era) => (
                  <button
                    type="button"
                    key={era.id}
                    disabled={!p.periodIds.includes(era.id)}
                    aria-label={`${p.letter}: ${era.label}${p.periodIds.includes(era.id) ? ", kirjattu käsittely" : ", ei kirjausta tässä rajauksessa"}`}
                    onClick={() => onPeriod(era.id)}
                    style={{
                      borderColor: p.periodIds.includes(era.id)
                        ? p.color
                        : undefined,
                    }}
                  >
                    {era.start}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {report.profiles.map((p) => (
            <details key={p.letter} className="experience-limits">
              <summary>{p.letter}: väite ja soveltamisala</summary>
              <p>{p.conclusion.claim}</p>
              <p>Laji: {p.conclusion.kind}</p>
              <p>{p.conclusion.limitations}</p>
              <p>
                {p.mechanismIds.length} kirjattua mekanismia ja{" "}
                {p.observationIds.length} lähdehavaintoa selitysrakenteen
                asiayhteydessä.
              </p>
              {p.scopes.length ? (
                p.scopes.map((scope, i) => <p key={i}>{scope}</p>)
              ) : (
                <p>
                  Kohderyhmää ja soveltamisehtoja ei ole tässä kerroksessa
                  rakenteistettu. Niiden vertailu vaatii artikkelien
                  tarkistamista.
                </p>
              )}
            </details>
          ))}
        </>
      )}
      {phase === 2 && (
        <>
          {report.arguments.map((a, i) => (
            <div className="comparison-argument" key={i}>
              <strong>
                {profile(a.from).letter} → {profile(a.to).letter}:{" "}
                {relationLabel[a.relation] ?? a.relation}
              </strong>
              <p>{a.rationale}</p>
              <p>{a.limitations}</p>
              <p>
                Väitteiden perustelusuhde · {reviewLabel(a.reviewStatus)} · ei
                päätelmien numeerinen vaikutusarvio.
              </p>
            </div>
          ))}
          <p className="comparison-note">
            Selitysrakenteen kattavuus:{" "}
            {report.profiles
              .map((p) => `${p.letter}: ${p.mechanismIds.length} mekanismia`)
              .join(" · ")}
            . Kirjausten puute ei osoita vaikutuksen puuttumista.
          </p>
        </>
      )}
      {focus && (
        <aside
          className="comparison-focus"
          aria-label="Pallolta valittu vertailukohta"
        >
          <strong>{periodName(focus.p)}</strong>
          {current ? (
            <p>
              {profile(current.left).letter}–{profile(current.right).letter}:{" "}
              {current.articles.length
                ? `yhteiset artikkelit ${current.articles.join(", ")}`
                : ""}
              {current.articles.length && current.concepts.length ? " · " : ""}
              {current.concepts.join("; ")}. Asiayhteys, ei vaikutusnuoli.
            </p>
          ) : focus.c && report.ids.includes(focus.c) ? (
            <p>
              {profile(focus.c).letter}: {profile(focus.c).conclusion.title}
            </p>
          ) : null}
          <button type="button" onClick={() => onPeriod(focus.p)}>
            Rajaa tähän aikakauteen
          </button>
        </aside>
      )}
      {report.profiles.some((p) =>
        p.periodIds.some(
          (id) =>
            (data.periods.find((era) => era.id === id)?.start ?? 0) >= 2026,
        ),
      ) && (
        <p className="comparison-note">
          Vuosien 2026–2050 kirjaukset ovat tulevaisuustarkasteluja, eivät
          toteutuneita havaintoja.
        </p>
      )}
      <div className="comparison-actions">
        <button
          type="button"
          disabled={phase === 0}
          onClick={() => choosePhase(phase - 1)}
        >
          ← Edellinen
        </button>
        <button
          type="button"
          className="comparison-primary"
          onClick={() => choosePhase(phase === 2 ? 0 : phase + 1)}
        >
          {phase === 2 ? "Kertomuksen alkuun" : "Jatka kertomusta →"}
        </button>
        <button
          type="button"
          disabled={reduced || phase === 2}
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pysäytä" : "Toista"}
        </button>
      </div>
      <button
        type="button"
        className="comparison-basis-toggle"
        aria-expanded={basis}
        onClick={() => {setPlaying(false);setBasis(!basis)}}
      >
        Mihin tämä perustuu?
      </button>
      {basis && (
        <div className="comparison-basis" aria-label="Vertailun perusteet">
          <p>
            Lähteen luotettavuus, väitteen perustelu ja artikkelikytkennän
            tarkistus ovat eri asioita. Yhteinen käsitesana ei ole sama kuin
            määritelty käsite-ID.
          </p>
          {treatments.some((q) => q.isLoading) && (
            <p>Ladataan artikkeliperusteluja…</p>
          )}
          {treatments.some((q) => q.error) && (
            <p>Kaikkia artikkeliperusteluja ei saatu ladattua.</p>
          )}
          <p>Artikkelikirjauksia: {basisRows.length}</p>
          {basisRows.slice(0, limit).map((t, i) => (
            <details
              key={`${t.c}:${t.articleNo}:${t.periodId}:${i}`}
              className="experience-limits"
            >
              <summary>
                {profile(t.c).letter} · Artikkeli {t.articleNo}:{" "}
                {t.articleTitle} · {periodName(t.periodId)}
              </summary>
              <p>{t.treatment}</p>
              <p>{t.evidence}</p>
              <p>{t.limitations}</p>
              <p>
                {(
                  {
                    direct: "Suora käsittely",
                    context: "Taustoittava käsittely",
                    counterevidence: "Vastanäyttö",
                  } as Record<string, string>
                )[t.relation] ?? t.relation}{" "}
                · {reviewLabel(t.reviewStatus ?? "needs_review")}
              </p>
            </details>
          ))}
          {basisRows.length > limit && (
            <button type="button" onClick={() => setLimit(limit + 12)}>
              Näytä lisää artikkelikirjauksia ({basisRows.length - limit})
            </button>
          )}
          {report.profiles.map((p) => (
            <div key={p.letter}>
              {p.observationIds.map((id) => {
                const o = data.evidence?.observations.find((o) => o.id === id);
                return (
                  o && (
                    <div key={id} className="comparison-source">
                      <strong>
                        {p.letter} · Selitysrakenteen lähdehavainto
                      </strong>
                      <p>{o.finding ?? o.title}</p>
                      <p>
                        {o.start != null
                          ? `${o.start}–${o.end}`
                          : "Ajoitus avoin; ei tarkka havaintojakso"}{" "}
                        · {o.population}
                      </p>
                      <p>{o.limitations}</p>
                      <p>{sourceCheck(o.verification)}</p>
                      {/^https?:\/\//.test(o.sourceUrl) && (
                        <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                          Avaa havaintolähde ↗
                        </a>
                      )}
                      <p>
                        Kirjattu asiayhteys ei yksin osoita koko päätelmän tai
                        yhteisvaikutuksen paikkansapitävyyttä.
                      </p>
                    </div>
                  )
                );
              })}
            </div>
          ))}
        </div>
      )}
      <details className="experience-limits">
        <summary>Tutki itse</summary>
        {report.profiles.map((p) => (
          <button
            type="button"
            className="comparison-inspect"
            key={p.letter}
            onClick={() => onInspect(p.conclusion.id)}
          >
            Tutki päätelmää {p.letter}: {p.conclusion.title} →
          </button>
        ))}
      </details>
      <div className="comparison-edit">
        <button type="button" onClick={onEdit}>
          Muuta valintoja
        </button>
        <button type="button" onClick={onExit}>
          Sulje vertailu
        </button>
      </div>
    </section>
  );
}
