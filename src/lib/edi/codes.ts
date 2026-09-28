import type { CodedValue, StopKind, TenderPurpose } from "./types";

/** B2A purpose codes. */
export const PURPOSE_CODES: Record<string, { label: string; kind: TenderPurpose }> = {
  "00": { label: "Original tender", kind: "original" },
  "04": { label: "Change to a previous tender", kind: "change" },
  "01": { label: "Cancellation", kind: "cancellation" },
};

/** B2 field 6 payment terms. */
export const PAYMENT_TERMS: Record<string, string> = {
  PP: "Prepaid",
  CC: "Collect",
};

/** S5 field 2 stop types. */
export const STOP_TYPES: Record<string, { label: string; kind: StopKind }> = {
  LD: { label: "Pickup", kind: "pickup" },
  UL: { label: "Delivery", kind: "delivery" },
};

/** Quantity units used in S5, OID and L3. */
export const UNITS: Record<string, string> = {
  L: "lb",
  GA: "gal",
};

/** Longer unit names, for tooltips and prose. */
export const UNIT_NAMES: Record<string, string> = {
  L: "Pounds",
  GA: "Gallons",
};

/** G62 date/time qualifiers. */
export const DATE_QUALIFIERS: Record<
  string,
  { label: string; bound: "earliest" | "latest" | "other" }
> = {
  "37": { label: "Earliest pickup", bound: "earliest" },
  "38": { label: "Latest pickup", bound: "latest" },
  "68": { label: "Earliest delivery", bound: "earliest" },
  "54": { label: "Latest delivery", bound: "latest" },
  "64": { label: "Respond by", bound: "other" },
};

/** L11 reference qualifiers. */
export const REFERENCE_QUALIFIERS: Record<string, string> = {
  PO: "Purchase order",
  CR: "Customer reference",
  BM: "Bill of lading",
};

/** N1 party type codes. */
export const PARTY_TYPES: Record<string, string> = {
  BT: "Bill to",
  SF: "Ship from",
  ST: "Ship to",
};

/** N7 equipment type codes. */
export const EQUIPMENT_TYPES: Record<string, string> = {
  TL: "Tank trailer",
};

/** N7 tank spec codes, with a short note on what each spec is built for. */
export const TANK_SPECS: Record<string, { label: string; note: string }> = {
  MC306: {
    label: "MC306",
    note: "Non-pressure tank, typically fuels and other flammable liquids",
  },
  MC307: {
    label: "MC307",
    note: "Low-pressure chemical tank, typically chemicals and mild corrosives",
  },
  MC312: {
    label: "MC312",
    note: "High-density corrosive tank, typically acids and caustics",
  },
};

/**
 * Segments the cheat sheet tells us to disregard. Tracked separately from
 * genuinely unrecognised segments so the UI can stay quiet about them.
 */
export const KNOWN_IGNORED_SEGMENTS = new Set([
  "ISA",
  "IEA",
  "GS",
  "GE",
  "ST",
  "SE",
]);

/**
 * Looks up `code` in `table`, falling back to the code itself so unmapped
 * values still render as something readable.
 */
export function coded(
  code: string | null | undefined,
  table: Record<string, string>,
): CodedValue | null {
  if (!code) {
    return null;
  }
  const label = table[code];
  return {
    code,
    label: label ?? code,
    unknown: label === undefined,
  };
}
