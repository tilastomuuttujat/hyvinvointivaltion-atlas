import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AtlasSphere } from './AtlasSphere';
import type { AtlasData } from '@/lib/atlas.functions';
import { ERA_STORIES } from '@/lib/atlas.insights';
import { relatedConnections } from '@/lib/atlas.relationships';
import { useQuery } from '@tanstack/react-query';
import { getTreatments } from '@/lib/atlas.static';
import { periodAt } from '@/lib/atlas.storylines';

export function AtlasExperience({ data }: { data: AtlasData }) {
  const [selected, setSelected] = useState<number | null>(1);
  const [period, setPeriod] = useState<string | null>('p1');
  const [story, setStory] = useState<number | null>(0);
  const [lensOpen, setLensOpen] = useState(false);
  const [year, setYear] = useState(1850);
  const [mapFocus, setMapFocus] = useState<{ c: number; p: string; label: string; articles: number[] } | null>(null);
  const kinds = useMemo(() => new Set(data.conclusions.map(c => c.kind)), [data]);
  const era = data.periods.find(p => p.id === period);
  const chapter = story == null ? undefined : ERA_STORIES[story];
  const top = data.cells.filter(c => c.p === period).sort((a, b) => b.articles - a.articles)[0];
  const conclusion = data.conclusions.find(c => c.id === (selected ?? chapter?.id ?? top?.c));
  const connections = conclusion ? relatedConnections(data.evidenceIndex ?? [], conclusion.id).filter(c => !period || c.p === period) : [];
  const { data: treatments = [] } = useQuery({ queryKey: ['static-treatments', conclusion?.id], enabled: !!conclusion, queryFn: () => conclusion ? getTreatments({ data: { conclusionId: conclusion.id } }) : Promise.resolve([]) });
  const treatment = treatments.find(t => !period || t.periodId === period);
  const goStory = (index: number) => {
    const p = data.periods[index], s = ERA_STORIES[index];
    if (!p || !s) return;
    setStory(index); setPeriod(p.id); setYear(p.start); setSelected(s.id); setMapFocus(null);
  };
  return <section className="atlas-experience" aria-label="Hyvinvointivaltion visuaalinen tutkimus">
    <div className="experience-toolbar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm text-primary"><BookOpen size={16} /> Tarinakatsaus</span>
        <span className="text-xs text-muted-foreground">Kehityskaari</span>
      </div>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">Aikakone <input aria-label="Aikakone 1850–2050" className="w-40 accent-primary" type="range" min="1850" max="2050" value={year} onChange={e => { const y = Number(e.target.value); setYear(y); setPeriod(periodAt(data.periods, y)?.id ?? null); setStory(null); }} /><span className="w-8 text-primary tabular-nums">{year}</span></label>
    </div>
    <div className="experience-field">
      <AtlasSphere data={data} kinds={kinds} selected={selected} period={period} showContext immersive scrubYear={year} onMapDetail={setMapFocus}
        onEra={p => { setPeriod(p); setStory(null); }} onLensChange={setLensOpen}
        onPick={(c, p) => { setSelected(c); setPeriod(p); setYear(data.periods.find(x => x.id === p)?.end ?? year); setStory(null); }} onClear={() => { setSelected(null); setStory(null); }} />
      {!lensOpen && <article className="experience-hud" aria-label="Aikakauden oivallus" aria-live="polite">
        <p className="experience-eyebrow">{era?.label ?? '1850–2050'} · {era && era.start >= 2026 ? 'Mahdollinen tulevaisuus' : 'Historiallinen tarkastelu'}</p>
        {chapter && <p className="experience-chapter">{chapter.title}</p>}
        <h2>{conclusion?.title ?? 'Suomen hyvinvointivaltion kehitys'}</h2>
        <p className="experience-claim">{conclusion?.claim}</p>
        <p className="experience-caution">Toimituksellinen tulkinta · ei vahvistettu syy-yhteys</p>
        {!!connections.length && <div className="experience-links"><span>Kirjatut asiayhteydet</span>{connections.slice(0, 2).map(c => <Button key={`${c.c}:${c.p}`} variant="ghost" onClick={() => { setSelected(c.c); setPeriod(c.p); setStory(null); }}>{data.conclusions.find(x => x.id === c.c)?.title}<ArrowRight /></Button>)}</div>}
        <details className="experience-limits"><summary>Rajaukset ja aineiston tila</summary><p>{conclusion?.limitations ?? 'Aineiston kytkennät eivät osoita kausaalivaikutusta.'}</p></details>
        <details className="experience-limits"><summary>Artikkelien perustelut ({treatments.filter(t => !period || t.periodId === period).length})</summary>{treatment ? <><p className="text-primary">Artikkeli {treatment.articleNo}: {treatment.articleTitle}</p><p>{treatment.treatment}</p><p>{treatment.evidence}</p><p>{treatment.limitations}</p><p>Tarkistus: {treatment.reviewStatus === 'accepted' ? 'hyväksytty' : 'odottaa tarkistusta'}</p></> : <p>Aineistoaukko: tälle jaksolle ei ole kirjattua artikkeliperustelua.</p>}</details>
        {story != null && <div className="experience-story-controls"><Button variant="outline" size="icon" aria-label="Edellinen murros" disabled={story === 0} onClick={() => goStory(story - 1)}><ArrowLeft /></Button><span>{story + 1} / {data.periods.length}</span><Button size="sm" disabled={story === data.periods.length - 1} onClick={() => goStory(story + 1)}>Seuraava murros <ArrowRight /></Button></div>}
      </article>}
      {!lensOpen && mapFocus && <article className="map-selection" aria-label="Kartan kirjattu käsite">
        <div className="flex items-start justify-between gap-3"><h3>{mapFocus.label}</h3><Button size="icon" variant="ghost" aria-label="Sulje käsitetieto" onClick={() => setMapFocus(null)}><X /></Button></div>
        <p>{data.periods.find(p => p.id === mapFocus.p)?.label} · {data.conclusions.find(c => c.id === mapFocus.c)?.title}</p>
        <p className="text-primary">Kirjatut artikkelit: {mapFocus.articles.join(', ')}</p>
        <p className="text-muted-foreground">Artikkeliaineiston käsitemerkintä · ei osoitettu syy-yhteys</p>
      </article>}

    </div>
    <nav className="experience-eras" aria-label="Historialliset murrokset">{data.periods.map((p, i) => <Button key={p.id} variant="ghost" aria-current={period === p.id ? 'step' : undefined} onClick={() => goStory(i)}><span>{p.label}</span><span>{ERA_STORIES[i]?.title}</span></Button>)}</nav>
  </section>;
}