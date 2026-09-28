import type { Stop } from "@/lib/edi";
import type { StopPoint } from "@/lib/geo/locate";

/**
 * Which stop of which tender is being inspected. Shared by the map pins, the
 * inspector's stop buttons and the load tabs, so all three stay in step.
 */
export interface StopSelection {
  /** `TenderEntry.key` of the tender. */
  key: string;
  /** Index into that tender's `stops`. */
  index: number;
}

/** One tender's placed stops, as the map draws them. */
export interface MapRoute {
  key: string;
  letter: string;
  points: StopPoint[];
}

/** The inspector opens on a tender's first pickup, where the load starts. */
export function defaultStop(stops: Stop[]): number {
  const pickup = stops.findIndex((stop) => stop.kind === "pickup");
  return pickup === -1 ? 0 : pickup;
}

/**
 * How a stop is named on pins and buttons: `1` for a single tender, `A1`
 * once there are several, so a pin says which tender it belongs to.
 */
export function stopLabel(letter: string | null, number: number): string {
  return letter === null ? String(number) : `${letter}${number}`;
}
