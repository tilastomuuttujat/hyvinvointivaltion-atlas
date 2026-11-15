import type { AtlasData } from "./atlas.functions";
export type ExploreQuestion = "before" | "after" | "how" | "conditions";
export const EXPLORE_QUESTIONS: { id: ExploreQuestion; label: string }[] = [
  { id: "before", label: "Mikä tähän johti?" },
  { id: "after", label: "Mihin tämä vaikuttaa?" },
  { id: "how", label: "Miten vaikutus välittyy?" },
  { id: "conditions", label: "Millä ehdoilla?" },
];
export function exploreOptions(
  data: AtlasData,
  id: string,
  question: ExploreQuestion,
) {
  const concepts = new Map(data.evidence?.concepts.map((c) => [c.id, c]) ?? []);
  const statements = new Set(
    (data.evidence?.reasoning?.statements ?? [])
      .filter((s) => s.reviewStatus !== "rejected")
      .map((s) => s.id),
  );
  return (data.evidence?.reasoning?.mechanisms ?? [])
    .filter(
      (m) =>
        m.isCurrent &&
        statements.has(m.statementId) &&
        m.reviewStatus !== "rejected" &&
        concepts.has(m.from) &&
        concepts.has(m.to),
    )
    .filter((m) =>
      question === "before"
        ? m.to === id
        : question === "after"
          ? m.from === id
          : m.from === id || m.to === id,
    )
    .map((m) => ({
      mechanism: m,
      target: concepts.get(m.from === id ? m.to : m.from)!,
      incoming: m.to === id,
    }));
}

export type ExploreStep = { id: string; via?: string; contextNote?: string };
export type ExploreHistory = {
  steps: ExploreStep[];
  past: ExploreStep[][];
  future: ExploreStep[][];
  pending?: string;
};
export const EMPTY_EXPLORATION: ExploreHistory = {
  steps: [],
  past: [],
  future: [],
};
export type ExploreAction =
  | { type: "pick"; id: string; via?: string }
  | { type: "back" | "forward" | "clear" | "cancel" };
/** Navigation history stores the actual mechanism ID, never the first parallel match. */
export function exploreTransition(
  state: ExploreHistory,
  action: ExploreAction,
  data: AtlasData,
): ExploreHistory {
  if (action.type === "cancel") return { ...state, pending: undefined };
  if (action.type === "clear")
    return state.steps.length
      ? { steps: [], past: [...state.past, state.steps], future: [] }
      : state;
  if (action.type === "back") {
    const prior = state.past.at(-1);
    return prior
      ? {
          steps: prior,
          past: state.past.slice(0, -1),
          future: [state.steps, ...state.future],
        }
      : state;
  }
  if (action.type === "forward") {
    const next = state.future[0];
    return next
      ? {
          steps: next,
          past: [...state.past, state.steps],
          future: state.future.slice(1),
        }
      : state;
  }
  if (action.type !== "pick") return state;
  if (!data.evidence?.concepts.some((c) => c.id === action.id)) return state;
  const index = state.steps.findIndex((s) => s.id === action.id);
  const current = state.steps.at(-1)?.id;
  const options = current
    ? exploreOptions(data, current, "how").filter(
        (o) => o.target.id === action.id,
      )
    : [];
  const matches = action.via
    ? options.filter((o) => o.mechanism.id === action.via)
    : options;
  if (action.via && !matches.length) return state;
  if (!action.via && index < 0 && matches.length > 1)
    return { ...state, pending: action.id };
  const steps =
    index >= 0
      ? state.steps.slice(0, index + 1)
      : matches.length === 1
        ? [...state.steps, { id: action.id, via: matches[0]!.mechanism.id }]
        : [{ id: action.id }];
  if (JSON.stringify(steps) === JSON.stringify(state.steps))
    return { ...state, pending: undefined };
  return { steps, past: [...state.past, state.steps], future: [] };
}
/** Fit the immediate neighbourhood by minimal pan, zooming out only if necessary. */
export function frameGraph(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  padding = 75,
  minScale = 0.25,
) {
  if (!points.length) return { scale: 1, dx: 0, dy: 0 };
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const loX = Math.min(...xs),
    hiX = Math.max(...xs),
    loY = Math.min(...ys),
    hiY = Math.max(...ys);
  const scale = Math.max(
    Math.min(1, minScale),
    Math.min(
      1,
      (width - padding * 2) / Math.max(1, hiX - loX),
      (height - padding * 2) / Math.max(1, hiY - loY),
    ),
  );
  const left = width / 2 + (loX - width / 2) * scale,
    right = width / 2 + (hiX - width / 2) * scale;
  const top = height / 2 + (loY - height / 2) * scale,
    bottom = height / 2 + (hiY - height / 2) * scale;
  const dx =
    left < padding
      ? padding - left
      : right > width - padding
        ? width - padding - right
        : 0;
  const dy =
    top < padding
      ? padding - top
      : bottom > height - padding
        ? height - padding - bottom
        : 0;
  return { scale, dx, dy };
}
