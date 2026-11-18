export const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;
export const travelDirection = (heading: number) => normalizeHeading(heading) < 180 ? 1 : -1;

export type BridgeMotion = {
  pos: number;
  heading: number;
  velocity: number;
  lateral: number;
  roll: number;
};

export function advanceBridge(
  state: BridgeMotion,
  course: number,
  cruise: boolean,
  end: number,
  destination: number | null,
  dt: number,
): BridgeMotion {
  const turn = normalizeHeading(course - state.heading + 180) - 180;
  const rotation = Math.sign(turn) * Math.min(Math.abs(turn), 52 * dt);
  const heading = normalizeHeading(state.heading + rotation);
  const angle = heading * Math.PI / 180;
  const remaining = destination == null ? 0 : destination - state.pos;
  const speed = destination == null
    ? (cruise ? travelDirection(heading) * 0.19 * Math.max(0.08, Math.abs(Math.sin(angle))) : 0)
    : Math.sign(remaining) * Math.min(0.75, Math.sqrt(2 * 0.7 * Math.abs(remaining)));
  const velocity = state.velocity + (speed - state.velocity) * (1 - Math.exp(-2.4 * dt));
  const next = state.pos + velocity * dt;
  const arrived = destination != null && (Math.abs(remaining) < 0.003 || (destination - next) * remaining <= 0);
  const pos = Math.max(0, Math.min(end, arrived ? destination! : next));
  const atLimit = (pos === 0 && velocity < 0) || (pos === end && velocity > 0);
  const lateralTarget = -Math.cos(angle);
  const lateral = state.lateral + (lateralTarget - state.lateral) * (1 - Math.exp(-1.05 * dt));
  const bank = dt > 0 ? Math.max(-4, Math.min(4, rotation / dt * 0.075)) : 0;
  const roll = state.roll + (bank - state.roll) * (1 - Math.exp(-2.1 * dt));
  return { pos, heading, velocity: arrived || atLimit ? 0 : velocity, lateral, roll };
}
