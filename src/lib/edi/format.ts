import type { Address, Quantity, Stop, TimeWindow } from "./types";

/**
 * 204 files carry no time zone, so dates are formatted in UTC from their
 * parts. Reading them in the viewer's local zone would shift the calendar day
 * for anyone west of Greenwich and would differ between server and browser.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** `2026-09-24` to `Thu, Sep 24, 2026`. */
export function formatDate(date: string | null): string | null {
  if (date === null) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    return date;
  }
  const [, year, month, day] = match;
  return DATE_FORMAT.format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
  );
}

/** A single date and time, e.g. `Tue, Sep 22, 2026 at 12:00`. */
export function formatDateTime(value: {
  date: string | null;
  time: string | null;
}): string | null {
  const date = formatDate(value.date);
  if (date === null) {
    return value.time === null ? null : `${value.time} (no date given)`;
  }
  return value.time === null ? date : `${date} at ${value.time}`;
}

/**
 * Describes a stop's appointment window in one line.
 *
 * A window with no closing time is stated as such rather than padded out, so
 * a missing "latest" in the file stays visible.
 */
export function formatWindow(
  earliest: TimeWindow | null,
  latest: TimeWindow | null,
): string | null {
  if (earliest === null && latest === null) {
    return null;
  }
  if (earliest !== null && latest === null) {
    const formatted = formatDateTime(earliest);
    return earliest.time === null ? formatted : `${formatted}, no closing time`;
  }
  if (earliest === null && latest !== null) {
    return `By ${formatDateTime(latest)}`;
  }

  const from = earliest as TimeWindow;
  const to = latest as TimeWindow;

  // Same calendar day is the common case, and reads better as one date.
  if (from.date !== null && from.date === to.date) {
    const date = formatDate(from.date);
    if (from.time !== null && to.time !== null) {
      return `${date}, ${from.time} to ${to.time}`;
    }
    return date;
  }

  return `${formatDateTime(from)} to ${formatDateTime(to)}`;
}

/** `{ value: 46000, unit: lb }` to `46,000 lb`. */
export function formatQuantity(quantity: Quantity | null): string | null {
  if (quantity === null) {
    return null;
  }
  if (quantity.value === null) {
    return quantity.raw === "" ? null : quantity.raw;
  }
  const number = NUMBER_FORMAT.format(quantity.value);
  return quantity.unit === null ? number : `${number} ${quantity.unit.label}`;
}

/** Street lines then `CITY, ST ZIP`, ready to render one per line. */
export function formatAddressLines(address: Address | null): string[] {
  if (address === null) {
    return [];
  }
  const locality = [
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
  ]
    .filter((part) => part !== null && part !== "")
    .join(" ");

  return [...address.street, locality].filter((line) => line !== "");
}

/** `Stop 1 — Pickup`, falling back sensibly when the file is vague. */
export function formatStopHeading(stop: Stop, index: number): string {
  const number = stop.sequence ?? index + 1;
  return `Stop ${number} — ${stop.type.label}`;
}

export function formatCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
