import type { Stop, StopKind } from "../edi/types";

/** ZIP code to `[latitude, longitude]` of the ZIP's centre. */
export type ZipTable = Readonly<Record<string, readonly [number, number]>>;

export interface StopPoint {
  /** Position of the stop in `tender.stops`. */
  index: number;
  /** Stop number as the map shows it: S5 field 1, or the position if absent. */
  number: number;
  kind: StopKind;
  zip: string;
  latitude: number;
  longitude: number;
}

export interface UnplacedStop {
  index: number;
  number: number;
  /** Why the stop is missing from the map, phrased for the dispatcher. */
  reason: string;
}

export interface StopLocations {
  points: StopPoint[];
  unplaced: UnplacedStop[];
}

/** Built by `npm run data:zips`. */
const ZIP_TABLE_URL = "/data/zip-centroids.json";

let zipTable: Promise<ZipTable> | null = null;

/**
 * Loads the ZIP centroid table from this app's own static files. It is only
 * fetched once a map is on screen, since at ~200 kB it is by far the largest
 * asset on the page, and then kept for every later tender.
 */
export function loadZipTable(): Promise<ZipTable> {
  zipTable ??= fetch(ZIP_TABLE_URL).then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load the ZIP table (HTTP ${response.status}).`);
    }
    return response.json() as Promise<ZipTable>;
  });
  // A failed load should not stick; the next map gets a fresh attempt.
  zipTable.catch(() => {
    zipTable = null;
  });
  return zipTable;
}

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Straight-line miles from stop to stop in order, summed. Only a rough sense
 * of the haul: it is measured between ZIP centres, not along any road.
 */
export function directMiles(points: StopPoint[]): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const dLat = radians(to.latitude - from.latitude);
    const dLng = radians(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(from.latitude)) *
        Math.cos(radians(to.latitude)) *
        Math.sin(dLng / 2) ** 2;
    total += 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
  }

  return total;
}

/**
 * The five-digit ZIP from a postal code, accepting ZIP+4 with or without the
 * hyphen. Anything else, such as a Canadian postal code, gives null.
 */
export function toZip5(postalCode: string | null): string | null {
  if (postalCode === null) {
    return null;
  }
  const match = /^(\d{5})(?:-?\d{4})?$/.exec(postalCode.trim());
  return match === null ? null : match[1];
}

/**
 * Places each stop at the centre of its ZIP code.
 *
 * This is deliberately approximate: a 204 carries street addresses, and
 * turning those into exact points would mean sending them to a geocoding
 * service. Stops that cannot be placed are returned with a reason rather than
 * dropped, so the map never silently shows fewer stops than the tender has.
 */
export function locateStops(stops: Stop[], table: ZipTable): StopLocations {
  const points: StopPoint[] = [];
  const unplaced: UnplacedStop[] = [];

  stops.forEach((stop, index) => {
    const number = stop.sequence ?? index + 1;
    const postalCode = stop.party?.address?.postalCode ?? null;
    const zip = toZip5(postalCode);

    if (zip === null) {
      unplaced.push({
        index,
        number,
        reason:
          postalCode === null
            ? "no ZIP code in the file"
            : `"${postalCode}" is not a US ZIP code`,
      });
      return;
    }

    const centre = table[zip];
    if (centre === undefined) {
      unplaced.push({ index, number, reason: `ZIP ${zip} is not in the map's ZIP table` });
      return;
    }

    points.push({
      index,
      number,
      kind: stop.kind,
      zip,
      latitude: centre[0],
      longitude: centre[1],
    });
  });

  return { points, unplaced };
}
