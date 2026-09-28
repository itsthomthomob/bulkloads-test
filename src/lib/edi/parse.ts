import {
  coded,
  DATE_QUALIFIERS,
  EQUIPMENT_TYPES,
  KNOWN_IGNORED_SEGMENTS,
  PARTY_TYPES,
  PAYMENT_TERMS,
  PURPOSE_CODES,
  REFERENCE_QUALIFIERS,
  STOP_TYPES,
  TANK_SPECS,
  UNITS,
} from "./codes";
import { detectSeparators, field, numericField, tokenize } from "./tokenize";
import type {
  Address,
  CodedValue,
  Commodity,
  Contact,
  EdiDateTime,
  Envelope,
  Equipment,
  LoadTender,
  OrderDetail,
  ParseResult,
  Party,
  Quantity,
  Reference,
  Segment,
  Stop,
  TimeWindow,
  Totals,
} from "./types";

const RESPOND_BY_QUALIFIER = "64";
const BILL_TO_PARTY = "BT";
const UN_NUMBER_PATTERN = /^UN\d{4}$/;
const TANK_SPEC_PATTERN = /^(MC|DOT)\d{3}$/;

/**
 * Parses an EDI 204 load tender into a shape that maps onto what a dispatcher
 * needs to see.
 *
 * Unrecognised segments are recorded rather than treated as errors, so a file
 * carrying extra content still produces a usable result. Only input with no
 * readable segments at all throws.
 */
export function parseEdi(input: string): ParseResult {
  const separators = detectSeparators(input);
  const { segments, skipped } = tokenize(input, separators);
  const warnings: string[] = [];

  if (skipped.length > 0) {
    warnings.push(
      `Ignored ${skipped.length} ${skipped.length === 1 ? "line that" : "lines that"} did not look like EDI segments.`,
    );
  }

  const transactions = splitTransactions(segments);
  if (transactions.length > 1) {
    warnings.push(
      `This file contains ${transactions.length} load tenders. All of them are shown.`,
    );
  }

  return {
    tenders: transactions.map((transaction) =>
      parseTransaction(transaction, readEnvelope(segments, transaction)),
    ),
    separators,
    segmentCount: segments.length,
    warnings,
  };
}

/**
 * Groups segments into one list per ST/SE transaction. Input with no ST at all
 * — someone pasting just the interesting middle of a tender — becomes a single
 * transaction so it still parses.
 */
function splitTransactions(segments: Segment[]): Segment[][] {
  const transactions: Segment[][] = [];
  let current: Segment[] | null = null;

  for (const segment of segments) {
    if (segment.name === "ST") {
      current = [segment];
      transactions.push(current);
    } else if (segment.name === "SE") {
      current?.push(segment);
      current = null;
    } else {
      current?.push(segment);
    }
  }

  if (transactions.length > 0) {
    return transactions;
  }

  const withoutEnvelope = segments.filter(
    (segment) => !KNOWN_IGNORED_SEGMENTS.has(segment.name),
  );
  return withoutEnvelope.length > 0 ? [withoutEnvelope] : [];
}

/** Mutable working copy of a stop, filled in as later segments arrive. */
interface StopDraft {
  sequence: number | null;
  type: CodedValue;
  kind: Stop["kind"];
  quantity: Quantity | null;
  party: PartyDraft | null;
  contacts: Contact[];
  commodities: Commodity[];
  orders: OrderDetail[];
  windows: TimeWindow[];
}

/** Mutable working copy of an N1/N3/N4 group. */
interface PartyDraft {
  typeCode: string;
  type: CodedValue;
  name: string | null;
  locationCode: string | null;
  street: string[];
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

function parseTransaction(segments: Segment[], envelope: Envelope): LoadTender {
  const warnings: string[] = [];
  const ignored = new Set<string>();
  const references: Reference[] = [];
  const notes: string[] = [];
  const stopDrafts: StopDraft[] = [];
  const headerParties: PartyDraft[] = [];

  let shipmentId: string | null = null;
  let carrierCode: string | null = null;
  let paymentTerms: CodedValue | null = null;
  let purposeCode: string | null = null;
  let respondBy: EdiDateTime | null = null;
  let equipment: Equipment | null = null;
  let totals: Totals | null = null;

  // Each S5 opens a stop that following segments belong to; L3 closes the last
  // one. N3/N4 attach to whichever N1 came most recently.
  let stop: StopDraft | null = null;
  let party: PartyDraft | null = null;

  for (const segment of segments) {
    switch (segment.name) {
      case "B2":
        carrierCode = field(segment, 2);
        shipmentId = field(segment, 4);
        paymentTerms = coded(field(segment, 6), PAYMENT_TERMS);
        break;

      case "B2A":
        purposeCode = field(segment, 1);
        break;

      case "L11": {
        const value = field(segment, 1);
        const qualifier = coded(field(segment, 2), REFERENCE_QUALIFIERS);
        if (value !== null && qualifier !== null) {
          references.push({ qualifier, value });
        }
        break;
      }

      case "NTE": {
        const text = field(segment, 2);
        if (text !== null) {
          notes.push(text);
        }
        break;
      }

      case "G62": {
        const window = readTimeWindow(segment, warnings);
        if (window === null) {
          break;
        }
        if (stop !== null) {
          stop.windows.push(window);
        } else if (window.qualifier.code === RESPOND_BY_QUALIFIER) {
          respondBy = window;
        } else {
          warnings.push(
            `Ignored a "${window.qualifier.label}" date that appeared before the first stop.`,
          );
        }
        break;
      }

      case "N1":
        party = readParty(segment);
        if (stop !== null) {
          stop.party = party;
        } else {
          headerParties.push(party);
        }
        break;

      case "N3":
        if (party !== null) {
          // N3 allows a second address line in field 2.
          for (const index of [1, 2]) {
            const line = field(segment, index);
            if (line !== null) {
              party.street.push(line);
            }
          }
        }
        break;

      case "N4":
        if (party !== null) {
          party.city = field(segment, 1);
          party.state = field(segment, 2);
          party.postalCode = field(segment, 3);
        }
        break;

      case "N7":
        equipment = readEquipment(segment);
        break;

      case "S5":
        stop = readStop(segment);
        party = null;
        stopDrafts.push(stop);
        break;

      case "G61": {
        const contact: Contact = {
          name: field(segment, 2),
          phone: formatPhone(field(segment, 4)),
        };
        if (contact.name !== null || contact.phone !== null) {
          stop?.contacts.push(contact);
        }
        break;
      }

      case "L5":
        stop?.commodities.push(readCommodity(segment));
        break;

      case "OID":
        stop?.orders.push(readOrder(segment));
        break;

      case "L3":
        totals = {
          quantity: readQuantity(field(segment, 1), field(segment, 2)),
          pieces: numericField(segment, 9),
        };
        stop = null;
        party = null;
        break;

      default:
        if (!KNOWN_IGNORED_SEGMENTS.has(segment.name)) {
          ignored.add(segment.name);
        }
        break;
    }
  }

  if (shipmentId === null) {
    warnings.push(
      "No shipment ID found (B2 field 4), so this tender cannot be matched to an earlier one.",
    );
  }
  if (purposeCode === null) {
    warnings.push(
      "No purpose code found (B2A field 1), so we cannot tell whether this is a new load or a change.",
    );
  }
  if (stopDrafts.length === 0) {
    warnings.push("No stops found (S5 segments).");
  }

  const stops = stopDrafts.map(buildStop);
  const billToDraft = headerParties.find(
    (candidate) => candidate.typeCode === BILL_TO_PARTY,
  );
  const unNumbers = collectUnNumbers(stops);

  return {
    shipmentId,
    carrierCode,
    paymentTerms,
    purpose: readPurpose(purposeCode),
    references,
    respondBy,
    notes,
    billTo: billToDraft === undefined ? null : buildParty(billToDraft),
    equipment,
    stops,
    totals,
    hazmat: { present: unNumbers.length > 0, unNumbers },
    envelope,
    warnings,
    ignoredSegments: [...ignored].sort(),
  };
}

function readStop(segment: Segment): StopDraft {
  const typeCode = field(segment, 2);
  const mapped = typeCode === null ? undefined : STOP_TYPES[typeCode];

  return {
    sequence: numericField(segment, 1),
    type: {
      code: typeCode ?? "",
      label: mapped?.label ?? typeCode ?? "Stop",
      unknown: mapped === undefined,
    },
    kind: mapped?.kind ?? "other",
    quantity: readQuantity(field(segment, 3), field(segment, 4)),
    party: null,
    contacts: [],
    commodities: [],
    orders: [],
    windows: [],
  };
}

function buildStop(draft: StopDraft): Stop {
  return {
    sequence: draft.sequence,
    type: draft.type,
    kind: draft.kind,
    quantity: draft.quantity,
    party: draft.party === null ? null : buildParty(draft.party),
    contacts: draft.contacts,
    commodities: draft.commodities,
    orders: draft.orders,
    windows: draft.windows,
    earliest: draft.windows.find((window) => window.bound === "earliest") ?? null,
    latest: draft.windows.find((window) => window.bound === "latest") ?? null,
    hazmat: draft.commodities.some((commodity) => commodity.hazmat),
  };
}

function readParty(segment: Segment): PartyDraft {
  const typeCode = field(segment, 1) ?? "";
  return {
    typeCode,
    type: coded(typeCode, PARTY_TYPES) ?? {
      code: "",
      label: "Party",
      unknown: true,
    },
    name: field(segment, 2),
    locationCode: field(segment, 4),
    street: [],
    city: null,
    state: null,
    postalCode: null,
  };
}

function buildParty(draft: PartyDraft): Party {
  return {
    type: draft.type,
    name: draft.name,
    locationCode: draft.locationCode,
    address: buildAddress(draft),
  };
}

function buildAddress(draft: PartyDraft): Address | null {
  const hasAnything =
    draft.street.length > 0 ||
    draft.city !== null ||
    draft.state !== null ||
    draft.postalCode !== null;

  if (!hasAnything) {
    return null;
  }

  const cityState = [draft.city, draft.state].filter(Boolean).join(", ");
  const oneLine = [...draft.street, cityState, draft.postalCode]
    .filter((part) => part !== null && part !== "")
    .join(", ");

  return {
    street: draft.street,
    city: draft.city,
    state: draft.state,
    postalCode: draft.postalCode,
    oneLine,
  };
}

function readPurpose(code: string | null): LoadTender["purpose"] {
  if (code === null) {
    return { code: "", label: "Unknown", unknown: true, kind: "other" };
  }
  const mapped = PURPOSE_CODES[code];
  return {
    code,
    label: mapped?.label ?? `Purpose code ${code}`,
    unknown: mapped === undefined,
    kind: mapped?.kind ?? "other",
  };
}

function readTimeWindow(
  segment: Segment,
  warnings: string[],
): TimeWindow | null {
  const qualifierCode = field(segment, 1);
  if (qualifierCode === null) {
    return null;
  }

  const mapped = DATE_QUALIFIERS[qualifierCode];
  const rawDate = field(segment, 2) ?? "";
  const rawTime = field(segment, 4) ?? "";
  const date = parseDate(rawDate);

  if (rawDate !== "" && date === null) {
    warnings.push(`Could not read the date "${rawDate}" in a G62 segment.`);
  }

  return {
    qualifier: {
      code: qualifierCode,
      label: mapped?.label ?? `Date qualifier ${qualifierCode}`,
      unknown: mapped === undefined,
    },
    bound: mapped?.bound ?? "other",
    date,
    time: parseTime(rawTime),
    raw: { date: rawDate, time: rawTime },
  };
}

/** `YYYYMMDD`, or the envelope's `YYMMDD`, to an ISO calendar date. */
export function parseDate(value: string): string | null {
  const digits = value.trim();
  let year: number;
  let month: string;
  let day: string;

  if (/^\d{8}$/.test(digits)) {
    year = Number(digits.slice(0, 4));
    month = digits.slice(4, 6);
    day = digits.slice(6, 8);
  } else if (/^\d{6}$/.test(digits)) {
    // Two-digit years appear only in the envelope. X12 reads 00-49 as 2000s.
    const shortYear = Number(digits.slice(0, 2));
    year = shortYear <= 49 ? 2000 + shortYear : 1900 + shortYear;
    month = digits.slice(2, 4);
    day = digits.slice(4, 6);
  } else {
    return null;
  }

  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

/** `HHMM` or `HHMMSS` to `HH:MM`. */
export function parseTime(value: string): string | null {
  const digits = value.trim();
  if (!/^\d{4}(\d{2})?$/.test(digits)) {
    return null;
  }
  if (Number(digits.slice(0, 2)) > 23 || Number(digits.slice(2, 4)) > 59) {
    return null;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function readQuantity(
  value: string | null,
  unitCode: string | null,
): Quantity | null {
  if (value === null && unitCode === null) {
    return null;
  }
  const parsed = value === null ? null : Number(value);
  return {
    value: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    unit: coded(unitCode, UNITS),
    raw: [value, unitCode].filter(Boolean).join(" "),
  };
}

function readCommodity(segment: Segment): Commodity {
  const code = field(segment, 3);
  const qualifier = field(segment, 4);
  const unNumber =
    code !== null && UN_NUMBER_PATTERN.test(code.toUpperCase())
      ? code.toUpperCase()
      : null;

  return {
    description: field(segment, 2),
    code,
    unNumber,
    // A UN qualifier in field 4 also marks hazmat, even when the code itself
    // is not in the UN#### shape.
    hazmat: unNumber !== null || qualifier?.toUpperCase() === "UN",
  };
}

function readOrder(segment: Segment): OrderDetail {
  return {
    orderId: field(segment, 1),
    purchaseOrder: field(segment, 2),
    quantity: readQuantity(field(segment, 6), field(segment, 7)),
  };
}

/**
 * Reads the N7 equipment segment.
 *
 * The cheat sheet puts the equipment type in field 11 and the tank spec in
 * field 13, but in both sample files those values sit at 9 and 12. Rather than
 * committing to one numbering, this checks the documented position first and
 * otherwise looks for a recognisable code anywhere in the segment.
 */
function readEquipment(segment: Segment): Equipment {
  const elements = segment.elements.slice(1);

  const typeCode =
    field(segment, 11) ??
    elements.find((value) => value in EQUIPMENT_TYPES) ??
    null;

  const specCode =
    field(segment, 13) ??
    elements.find((value) => TANK_SPEC_PATTERN.test(value.toUpperCase())) ??
    null;

  const spec = specCode === null ? undefined : TANK_SPECS[specCode.toUpperCase()];

  return {
    number: field(segment, 2),
    type: coded(typeCode, EQUIPMENT_TYPES),
    spec:
      specCode === null
        ? null
        : {
            code: specCode,
            label: spec?.label ?? specCode,
            unknown: spec === undefined,
            note: spec?.note ?? null,
          },
  };
}

/** `2815550144` to `(281) 555-0144`, leaving anything unexpected alone. */
function formatPhone(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
}

function collectUnNumbers(stops: Stop[]): string[] {
  const numbers = new Set<string>();
  for (const stop of stops) {
    for (const commodity of stop.commodities) {
      if (commodity.unNumber !== null) {
        numbers.add(commodity.unNumber);
      }
    }
  }
  return [...numbers].sort();
}

/**
 * Pulls envelope details for a transaction. ISA and GS sit outside the ST/SE
 * pair, so they come from the whole file rather than the transaction.
 */
function readEnvelope(all: Segment[], transaction: Segment[]): Envelope {
  const isa = all.find((segment) => segment.name === "ISA");
  const gs = all.find((segment) => segment.name === "GS");
  const st = transaction.find((segment) => segment.name === "ST");

  const rawDate = isa === undefined ? "" : field(isa, 9) ?? "";
  const rawTime = isa === undefined ? "" : field(isa, 10) ?? "";
  const date = parseDate(rawDate);
  const time = parseTime(rawTime);

  return {
    senderId: isa === undefined ? null : field(isa, 6),
    receiverId: isa === undefined ? null : field(isa, 8),
    sent:
      date === null && time === null
        ? null
        : { date, time, raw: { date: rawDate, time: rawTime } },
    interchangeControlNumber: isa === undefined ? null : field(isa, 13),
    groupControlNumber: gs === undefined ? null : field(gs, 6),
    transactionSetControlNumber: st === undefined ? null : field(st, 2),
    transactionSetCode: st === undefined ? null : field(st, 1),
  };
}
