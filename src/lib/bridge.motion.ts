export const clampHeading = (heading: number) => Math.max(0, Math.min(180, heading));
export type TimeDirection = 1 | -1;

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
  timeDirection: TimeDirection,
  end: number,
  destination: number | null,
  dt: number,
): BridgeMotion {
  const turn = clampHeading(course) - state.heading;
  const rotation = Math.sign(turn) * Math.min(Math.abs(turn), 52 * dt);
  const heading = clampHeading(state.heading + rotation);
  const angle = heading * Math.PI / 180;
  const remaining = destination == null ? 0 : destination - state.pos;
  const speed = destination == null
    ? (cruise ? timeDirection * 0.19 : 0)
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
