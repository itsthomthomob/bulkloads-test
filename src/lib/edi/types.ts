/** A single segment after tokenizing. `elements[0]` is the segment name. */
export interface Segment {
  /** Segment name, e.g. `B2`, `S5`, `N1`. */
  name: string;
  /**
   * Raw element values. Index matches the cheat sheet's field numbers, so
   * `elements[4]` is "field 4". Index 0 holds the segment name.
   */
  elements: string[];
  /** 1-based position in the file, used for warning messages. */
  position: number;
  /** The segment as it appeared in the input, without the terminator. */
  raw: string;
}

export interface Separators {
  element: string;
  component: string;
  segment: string;
}

/** A code paired with the human-readable text we show for it. */
export interface CodedValue {
  code: string;
  label: string;
  /** True when the code was not in our lookup table. */
  unknown: boolean;
}

/**
 * A date and/or time exactly as the file stated it. 204 files carry no time
 * zone, so these stay as strings rather than becoming `Date` objects.
 */
export interface EdiDateTime {
  /** ISO calendar date, e.g. `2026-09-24`. Null if the file omitted it. */
  date: string | null;
  /** 24-hour `HH:MM`, e.g. `07:00`. Null if the file omitted it. */
  time: string | null;
  raw: { date: string; time: string };
}

export interface TimeWindow extends EdiDateTime {
  qualifier: CodedValue;
  /** Which end of a window this is, when the qualifier tells us. */
  bound: "earliest" | "latest" | "other";
}

export interface Quantity {
  value: number | null;
  unit: CodedValue | null;
  raw: string;
}

export interface Address {
  street: string[];
  city: string | null;
  state: string | null;
  postalCode: string | null;
  /** Single-line form for display and geocoding. */
  oneLine: string;
}

export interface Party {
  type: CodedValue;
  name: string | null;
  /** Shipper's own code for the site, from N1 field 4. */
  locationCode: string | null;
  address: Address | null;
}

export interface Contact {
  name: string | null;
  phone: string | null;
}

export interface Commodity {
  description: string | null;
  /** Commodity code from L5 field 3, e.g. `UN1824`. */
  code: string | null;
  /** UN number when the commodity code identifies a hazardous material. */
  unNumber: string | null;
  hazmat: boolean;
}

export interface OrderDetail {
  orderId: string | null;
  purchaseOrder: string | null;
  quantity: Quantity | null;
}

export interface Equipment {
  /** Trailer number from N7 field 2. */
  number: string | null;
  type: CodedValue | null;
  /** Tank spec such as `MC307`, with what that spec means. */
  spec: (CodedValue & { note: string | null }) | null;
}

export interface Reference {
  qualifier: CodedValue;
  value: string;
}

export type StopKind = "pickup" | "delivery" | "other";

export interface Stop {
  /** Stop number from S5 field 1. */
  sequence: number | null;
  type: CodedValue;
  kind: StopKind;
  quantity: Quantity | null;
  party: Party | null;
  contacts: Contact[];
  commodities: Commodity[];
  orders: OrderDetail[];
  windows: TimeWindow[];
  /** Earliest window for this stop, when one was given. */
  earliest: TimeWindow | null;
  /** Latest window for this stop, when one was given. */
  latest: TimeWindow | null;
  hazmat: boolean;
}

export interface Totals {
  quantity: Quantity | null;
  /** Piece count from L3 field 9. */
  pieces: number | null;
}

export interface Envelope {
  senderId: string | null;
  receiverId: string | null;
  /** When the envelope says it was sent. */
  sent: EdiDateTime | null;
  interchangeControlNumber: string | null;
  groupControlNumber: string | null;
  transactionSetControlNumber: string | null;
  /** Transaction set code from ST field 1. `204` for a load tender. */
  transactionSetCode: string | null;
}

export type TenderPurpose = "original" | "change" | "cancellation" | "other";

export interface LoadTender {
  /** Customer's ID for the load, from B2 field 4. The key we match on. */
  shipmentId: string | null;
  /** Our carrier code, from B2 field 2. */
  carrierCode: string | null;
  paymentTerms: CodedValue | null;
  /** B2A purpose code, which says whether this is a new load or a change. */
  purpose: CodedValue & { kind: TenderPurpose };
  references: Reference[];
  /** Header G62 with qualifier 64 — when the customer wants an answer. */
  respondBy: EdiDateTime | null;
  notes: string[];
  billTo: Party | null;
  equipment: Equipment | null;
  stops: Stop[];
  totals: Totals | null;
  hazmat: {
    present: boolean;
    unNumbers: string[];
  };
  envelope: Envelope;
  /** Things we could not make sense of but chose not to fail on. */
  warnings: string[];
  /** Segment names present in the file that this parser does not interpret. */
  ignoredSegments: string[];
}

export interface ParseResult {
  /** One entry per ST/SE transaction. A file usually holds exactly one. */
  tenders: LoadTender[];
  separators: Separators;
  segmentCount: number;
  /** File-level problems, e.g. no recognisable segments at all. */
  warnings: string[];
}

export class EdiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdiParseError";
  }
}
