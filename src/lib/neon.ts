// Neon via Lovable connector gateway. Server-only usage (call from server function handlers).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/neon";

function gatewayHeaders(): Record<string, string> {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  const NEON_API_KEY = process.env["NEON_API_KEY"];
  if (!LOVABLE_API_KEY || !NEON_API_KEY) throw new Error("Missing LOVABLE_API_KEY or NEON_API_KEY");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": NEON_API_KEY,
    "Content-Type": "application/json",
  };
}

type Statement = { query: string; params?: unknown[] };
export type NeonResult = {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID: number }[];
  rowCount: number | null;
  command: string;
};
export type NeonBatchResult = { results: NeonResult[] };
type NeonResponse = { status: number; retryAfter: string | null; text: string; json: any; elapsedMs: number };
type NeonErrorKind =
  | "stale_connection" | "endpoint_blocked" | "maybe_committed" | "too_large"
  | "rate_limited" | "unavailable" | "input" | "statement" | "rejected";
type NeonError = Error & { status: number; code?: string; body: string; kind: NeonErrorKind };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toBody = (q: string | Statement[], params: unknown[]) =>
  typeof q === "string" ? { query: q, params } : { queries: q };

async function neonFetch(body: unknown, headers: Record<string, string>, signal?: AbortSignal): Promise<NeonResponse> {
  const base = gatewayHeaders();
  const started = Date.now();
  try {
    const res = await fetch(`${GATEWAY_URL}/sql`, {
      method: "POST",
      headers: { ...base, ...headers },
      body: JSON.stringify(body),
      signal: signal ?? null,
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = {}; }
    return { status: res.status, retryAfter: res.headers.get("Retry-After"), text, json, elapsedMs: Date.now() - started };
  } catch (err: any) {
    return { status: 0, retryAfter: null, text: "", json: { message: String(err?.name ?? err) }, elapsedMs: Date.now() - started };
  }
}

const isStale = (json: any) =>
  json?.code === "28P01" || json?.code === "28000" ||
  /^(password authentication failed|Control plane request failed: endpoint cannot be found)/.test(json?.message ?? "");
const isEndpointBlocked = (json: any) =>
  /^(The endpoint has been disabled|Control plane request failed: endpoint is)/.test(json?.message ?? "");

function neonFailure(r: NeonResponse, write: boolean): NeonError {
  const { status, json, elapsedMs } = r;
  let hint: string;
  let kind: NeonErrorKind;
  if (isStale(json)) { kind = "stale_connection"; hint = "stored connection string no longer works"; }
  else if (isEndpointBlocked(json)) { kind = "endpoint_blocked"; hint = "Neon is not serving this endpoint"; }
  else if (status === 413) { kind = "too_large"; hint = "request too large"; }
  else if (status === 507) { kind = "too_large"; hint = "result too large: add LIMIT"; }
  else if (status === 429) { kind = "rate_limited"; hint = "gateway rate limit"; }
  else if (status === 0 || status === 502) {
    const slow = /^(TimeoutError|AbortError)/.test(json?.message ?? "") || elapsedMs >= 25_000;
    kind = write ? "maybe_committed" : slow ? "statement" : "unavailable";
    hint = slow ? "too slow" : "could not reach Neon";
  } else if (json?.code === "42P01") { kind = "statement"; hint = "table renamed or removed"; }
  else if (/^2[23]/.test(json?.code ?? "")) { kind = "input"; hint = "constraint or type violation"; }
  else if (/^Control plane request failed/.test(json?.message ?? "")) { kind = "unavailable"; hint = "Neon control-plane outage"; }
  else if (status === 400) { kind = "statement"; hint = "fix the statement"; }
  else if (status >= 500) { kind = "unavailable"; hint = "Neon error"; }
  else { kind = "rejected"; hint = "gateway rejection"; }
  const code = json?.code || json?.type;
  return Object.assign(
    new Error(`Neon ${status}${code ? ` ${code}` : ""}: ${json?.message ?? r.text.slice(0, 300)} (${hint})`),
    { status, code, body: r.text, kind },
  );
}

export function neonUserError(err: unknown): { status: number; message: string } {
  switch ((err as Partial<NeonError>)?.kind) {
    case "stale_connection":
      return { status: 503, message: "Tietokantayhteys ei enää toimi. Sovelluksen omistajan on päivitettävä yhteys." };
    case "endpoint_blocked":
      return { status: 503, message: "Tietokanta ei ole juuri nyt käytettävissä." };
    case "too_large":
      return { status: 413, message: "Pyyntö tai tulos on liian suuri." };
    case "rate_limited":
      return { status: 429, message: "Tietokanta on kiireinen. Yritä hetken päästä uudelleen." };
    case "unavailable":
      return { status: 503, message: "Tietokanta on tilapäisesti poissa käytöstä. Yritä hetken päästä." };
    default:
      return { status: 500, message: "Tietokantapyyntöä ei voitu suorittaa." };
  }
}

export async function neonQuery<T = NeonResult>(
  query: string | Statement[], params: unknown[] = [], headers: Record<string, string> = {},
): Promise<T> {
  const deadline = Date.now() + 30_000;
  const left = () => Math.max(0, deadline - Date.now());
  let retried429 = false;
  for (let attempt = 1; ; attempt++) {
    const r = await neonFetch(toBody(query, params), headers, AbortSignal.timeout(Math.max(1, left())));
    if (r.status >= 200 && r.status < 300) return r.json as T;
    if (isStale(r.json) || isEndpointBlocked(r.json)) throw neonFailure(r, false);
    if (r.status === 429 && !retried429) {
      retried429 = true;
      const seconds = Math.min(Math.max(Number(r.retryAfter) || 1, 1), 15);
      await sleep(Math.min(seconds * 1000, left()));
      continue;
    }
    const backoff = 500 * 2 ** (attempt - 1);
    if ((r.status === 500 || r.status === 503) && attempt < 3 && backoff < left()) {
      await sleep(backoff);
      continue;
    }
    throw neonFailure(r, false);
  }
}
