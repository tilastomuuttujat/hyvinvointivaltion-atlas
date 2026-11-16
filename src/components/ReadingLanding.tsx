import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  emptyReading,
  offerReading,
  tickReading,
  pauseReading,
  type ReadingFrame,
  type ReadingItem,
} from "@/lib/atlas.reading";
import "@/styles/reading-landing.css";
function Arrival({
  item,
  color,
  onInspect,
}: {
  item: ReadingItem;
  color: string;
  onInspect: (kind: string, id: string) => void;
}) {
  const element = useRef<HTMLLIElement>(null);
  const [flight, setFlight] = useState<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    color: string;
  } | null>(null);
  useLayoutEffect(() => {
    const row = element.current;
    if (!row) return;
    const body = row.closest(".reading-landing-body") as HTMLElement | null;
    if (body) body.scrollTop = body.scrollHeight;
    const source = [
      ...document.querySelectorAll<HTMLElement>(
        item.kind === "concept"
          ? "[data-reading-concept]"
          : "[data-history-item]",
      ),
    ]
      .find(
        (e) =>
          (item.kind === "concept"
            ? e.dataset.readingConcept
            : e.dataset.historyItem) === (item.sourceId ?? item.id),
      )
      ?.querySelector("circle");
    if (source) {
      const from = source.getBoundingClientRect(),
        to = row.getBoundingClientRect();
      const x = from.x + from.width / 2,
        y = from.y + from.height / 2;
      if (
        from.width &&
        to.width &&
        x >= 0 &&
        x <= window.innerWidth &&
        y >= 0 &&
        y <= window.innerHeight
      ) {
        setFlight({
          x,
          y,
          dx: to.x + 12 - x,
          dy: to.y + 24 - y,
          color: window.getComputedStyle(row.querySelector("strong") ?? row)
            .color,
        });
      }
    }
    row.classList.add("arriving");
    const timer = setTimeout(() => setFlight(null), 950);
    return () => clearTimeout(timer);
  }, [item.id]);
  return (
    <>
      {flight &&
        createPortal(
          <span
            aria-hidden="true"
            className="reading-flight"
            style={
              {
                left: flight.x,
                top: flight.y,
                "--flight-x": `${flight.dx}px`,
                "--flight-y": `${flight.dy}px`,
                color: flight.color,
              } as React.CSSProperties
            }
          >
            {item.title}
          </span>,
          document.body,
        )}
      <li
        ref={element}
        className="reading-item"
        data-reading-item={item.id}
        style={{ "--reading-color": color } as React.CSSProperties}
      >
        {item.inspection ? (
          <button
            className="reading-step-title"
            onClick={() =>
              onInspect(item.inspection!.kind, item.inspection!.id)
            }
          >
            <strong>{item.title}</strong>
          </button>
        ) : (
          <strong>{item.title}</strong>
        )}
        {item.meaning && <p>{item.meaning}</p>}
      </li>
    </>
  );
}
export function ReadingLanding({
  incoming,
  themeIds,
  onPauseChange,
  onInspect,
}: {
  incoming: ReadingFrame | null;
  themeIds: string[];
  onPauseChange: (pause: boolean) => void;
  onInspect: (kind: string, id: string) => void;
}) {
  const [state, setState] = useState(emptyReading),
    [pinned, setPinned] = useState(false),
    [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    body = useRef<HTMLDivElement>(null);
  const paused = pinned || hover || focus;
  const togglePause = () => {
    setPinned(!pinned);
    if (pinned) setFocus(false);
  };
  useEffect(() => {
    setState((s) => offerReading(s, incoming, Date.now()));
  }, [incoming?.key]);
  useEffect(() => {
    setState((s) => pauseReading(s, paused, Date.now()));
    onPauseChange(paused);
  }, [paused, onPauseChange]);
  useEffect(() => {
    const timer = setInterval(
      () => setState((s) => tickReading(s, Date.now())),
      200,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!paused && body.current)
      body.current.scrollTop = body.current.scrollHeight;
  }, [state.frame?.key, state.shown, paused]);
  if (!state.frame) return null;
  return (
    <section
      className="reading-landing"
      aria-label="Luettavana olevan käsitteistön kiteytys"
      data-reading-key={state.frame.key}
      data-reading-paused={paused}
      tabIndex={0}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHover(false);
      }}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
      }}
      onClick={(e) => {
        if (!(e.target as Element).closest("button")) togglePause();
      }}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          togglePause();
        }
      }}
    >
      <div ref={body} className="reading-landing-body">
        <ol key={state.frame.key}>
          {state.frame.items.slice(0, state.shown).map((item) => (
            <Arrival
              key={`${item.kind}:${item.id}`}
              item={item}
              color={`var(--rs-${Math.max(0, themeIds.indexOf(item.theme)) + 1})`}
              onInspect={onInspect}
            />
          ))}
        </ol>
        {state.shown === state.frame.items.length && (
          <p className="reading-landing-note">{state.frame.note}</p>
        )}
      </div>
      <footer>
        {paused
          ? "Pysäytetty · kosketa jatkaaksesi"
          : `${state.shown}/${state.frame.items.length}`}
        {state.candidate && state.candidate.key !== state.frame.key && (
          <span> · Seuraava näkymä odottaa</span>
        )}
        {pinned && (
          <button
            onClick={() => {
              setPinned(false);
              setFocus(false);
            }}
          >
            Jatka
          </button>
        )}
      </footer>
    </section>
  );
}
