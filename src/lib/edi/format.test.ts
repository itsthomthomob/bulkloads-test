import { describe, expect, it } from "vitest";

import {
  formatAddressLines,
  formatDate,
  formatDateTime,
  formatQuantity,
  formatWindow,
} from "./format";
import { parseEdi } from "./parse";
import { SAMPLE_CHANGE, SAMPLE_ORIGINAL } from "./samples";

describe("formatDate", () => {
  it("writes dates the way a dispatcher reads them", () => {
    expect(formatDate("2026-09-24")).toBe("Thu, Sep 24, 2026");
  });

  it("does not shift the calendar day", () => {
    // A naive `new Date("2026-01-01")` formatted in a western zone would show
    // Dec 31, which would put a load on the wrong day.
    expect(formatDate("2026-01-01")).toBe("Thu, Jan 1, 2026");
  });

  it("passes through anything it cannot format", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("whenever")).toBe("whenever");
  });
});

describe("formatDateTime", () => {
  it("joins a date and time", () => {
    expect(formatDateTime({ date: "2026-09-22", time: "12:00" })).toBe(
      "Tue, Sep 22, 2026 at 12:00",
    );
  });

  it("handles a date with no time", () => {
    expect(formatDateTime({ date: "2026-09-22", time: null })).toBe(
      "Tue, Sep 22, 2026",
    );
  });

  it("says so when the date is missing", () => {
    expect(formatDateTime({ date: null, time: "12:00" })).toBe(
      "12:00 (no date given)",
    );
    expect(formatDateTime({ date: null, time: null })).toBeNull();
  });
});

describe("formatWindow", () => {
  const original = parseEdi(SAMPLE_ORIGINAL).tenders[0];
  const change = parseEdi(SAMPLE_CHANGE).tenders[0];

  it("collapses a same-day window to one date and two times", () => {
    const pickup = original.stops[0];
    expect(formatWindow(pickup.earliest, pickup.latest)).toBe(
      "Thu, Sep 24, 2026, 07:00 to 13:00",
    );
  });

  it("spells out a window that spans two days", () => {
    expect(
      formatWindow(
        { ...original.stops[0].earliest!, date: "2026-09-24", time: "22:00" },
        { ...original.stops[0].latest!, date: "2026-09-25", time: "06:00" },
      ),
    ).toBe("Thu, Sep 24, 2026 at 22:00 to Fri, Sep 25, 2026 at 06:00");
  });

  it("makes a missing closing time visible", () => {
    const delivery = change.stops[1];
    expect(delivery.latest).toBeNull();
    expect(formatWindow(delivery.earliest, delivery.latest)).toBe(
      "Mon, Sep 28, 2026 at 09:00, no closing time",
    );
  });

  it("returns nothing when the file gave no window", () => {
    expect(formatWindow(null, null)).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("groups thousands and names the unit", () => {
    const original = parseEdi(SAMPLE_ORIGINAL).tenders[0];
    expect(formatQuantity(original.totals?.quantity ?? null)).toBe("46,000 lb");
  });

  it("uses the gallons unit from the revised tender", () => {
    const change = parseEdi(SAMPLE_CHANGE).tenders[0];
    expect(formatQuantity(change.totals?.quantity ?? null)).toBe("3,800 gal");
  });

  it("falls back to the raw text when the value is not a number", () => {
    expect(
      formatQuantity({ value: null, unit: null, raw: "SEE BOL" }),
    ).toBe("SEE BOL");
    expect(formatQuantity(null)).toBeNull();
  });
});

describe("formatAddressLines", () => {
  it("builds street lines plus city, state and zip", () => {
    const original = parseEdi(SAMPLE_ORIGINAL).tenders[0];
    expect(formatAddressLines(original.stops[1].party?.address ?? null)).toEqual([
      "1500 MILL RD",
      "SPRINGFIELD, MO 65802",
    ]);
  });

  it("returns nothing when there is no address", () => {
    expect(formatAddressLines(null)).toEqual([]);
  });
});
