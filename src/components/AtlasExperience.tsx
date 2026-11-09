import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Layers, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AtlasSphere } from './AtlasSphere';
import { AtlasNavigator } from './AtlasNavigator';
import type { AtlasData } from '@/lib/atlas.functions';
import { bridgedConclusions, ERA_STORIES } from '@/lib/atlas.insights';
import { initialNavigation, type Navigation } from '@/lib/atlas.navigation';
import { relatedConnections } from '@/lib/atlas.relationships';
import { useQuery } from '@tanstack/react-query';
import { getTreatments } from '@/lib/atlas.static';
import { periodAt } from '@/lib/atlas.storylines';

export function AtlasExperience({ data }: { data: AtlasData }) {
  const [selected, setSelected] = useState<number | null>(1);
  const [period, setPeriod] = useState<string | null>('p1');
  const [navigation, setNavigation] = useState<Navigation>(initialNavigation);
  const [exploring, setExploring] = useState(false);
  const [story, setStory] = useState<number | null>(0);
  const [lensOpen, setLensOpen] = useState(false);
  const [year, setYear] = useState(1850);
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
    setStory(index); setPeriod(p.id); setYear(p.start); setSelected(s.id); setExploring(false);
  };
  const navigate = (next: Navigation) => {
    setNavigation(next); setStory(null);
    const stop = next.trail[next.trail.length - 1];
    const ids = stop ? bridgedConclusions(data, stop) : [];
    setSelected(ids[0] ?? null);
  };
  const stop = navigation.trail[navigation.trail.length - 1];
  const bridgeIds = stop ? bridgedConclusions(data, stop) : [];
  return <section className="atlas-experience" aria-label="Hyvinvointivaltion visuaalinen tutkimus">
    <div className="experience-toolbar">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={story != null ? 'default' : 'outline'} onClick={() => goStory(0)}><BookOpen /> Tarinakatsaus</Button>
        <Button size="sm" variant={exploring ? 'default' : 'outline'} onClick={() => { setExploring(!exploring); setStory(null); }}><Layers /> Tutki tasoittain</Button>
      </div>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">Aikakone <input aria-label="Aikakone 1850–2050" className="w-40 accent-primary" type="range" min="1850" max="2050" value={year} onChange={e => { const y = Number(e.target.value); setYear(y); setPeriod(periodAt(data.periods, y)?.id ?? null); setStory(null); }} /><span className="w-8 text-primary tabular-nums">{year}</span></label>
    </div>
    <div className={`experience-field ${exploring ? 'is-exploring' : ''}`}>
      <AtlasSphere data={data} kinds={kinds} selected={selected} period={period} showContext immersive scrubYear={year}
        onEra={p => { setPeriod(p); setStory(null); }} onLensChange={setLensOpen}
        onPick={(c, p) => { setSelected(c); setPeriod(p); setYear(data.periods.find(x => x.id === p)?.end ?? year); setStory(null); }} onClear={() => { setSelected(null); setStory(null); }} />
      {!lensOpen && !exploring && <article className="experience-hud" aria-label="Aikakauden oivallus" aria-live="polite">
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
      {!lensOpen && exploring && <div className="experience-investigation" aria-label="Tasoittainen tutkiminen pallolla">
        <div className="flex items-center justify-between border-b border-border p-3"><span className="text-xs text-primary">Ilmiö → käsite → selitys → havainto</span><Button variant="ghost" size="sm" onClick={() => setExploring(false)}><Compass /> Takaisin palloon</Button></div>
        <AtlasNavigator data={data} navigation={navigation} onNavigate={navigate} period={period} onPeriod={p => { setPeriod(p); setYear(data.periods.find(x => x.id === p)?.end ?? 2050); }} onOpenConclusion={id => { setSelected(id); setExploring(false); }} />
        <p className="experience-bridge">{bridgeIds.length ? `Pallolla korostettu päätelmä ${bridgeIds.join(', ')} · kirjattu taustayhteys, ei syyvaikutus.` : 'Tähän tasoon ei ole kirjattua siltaa pallon päätelmiin. Yhteyttä ei päätellä käsitteen nimestä.'}</p>
      </div>}
    </div>
    <nav className="experience-eras" aria-label="Historialliset murrokset">{data.periods.map((p, i) => <Button key={p.id} variant="ghost" aria-current={period === p.id ? 'step' : undefined} onClick={() => goStory(i)}><span>{p.label}</span><span>{ERA_STORIES[i]?.title}</span></Button>)}</nav>
  </section>;
}