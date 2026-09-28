import { describe, expect, it } from "vitest";

import { parseEdi, parseDate, parseTime } from "./parse";
import { SAMPLE_CHANGE, SAMPLE_ORIGINAL } from "./samples";
import { detectSeparators, splitInterchanges, tokenize } from "./tokenize";
import { EdiParseError } from "./types";

function parseOne(input: string) {
  const result = parseEdi(input);
  expect(result.tenders).toHaveLength(1);
  return result.tenders[0];
}

describe("separator detection", () => {
  it("reads separators from the ISA segment", () => {
    expect(detectSeparators(SAMPLE_ORIGINAL)).toEqual({
      element: "*",
      component: ">",
      segment: "~",
    });
  });

  it("handles a file that uses different separators", () => {
    // Swapping the separator characters in place keeps the ISA's fixed width,
    // so the declared positions still hold.
    const alternate = SAMPLE_ORIGINAL.replace(/\*/g, "|").replace(/~/g, "^");

    expect(detectSeparators(alternate)).toEqual({
      element: "|",
      component: ">",
      segment: "^",
    });

    // The same load, so it should parse to exactly the same result.
    expect(parseOne(alternate)).toEqual(parseOne(SAMPLE_ORIGINAL));
  });

  it("falls back to the common separators when there is no ISA", () => {
    expect(detectSeparators("B2**BTMS**ACM-44817**PP~")).toEqual({
      element: "*",
      component: ":",
      segment: "~",
    });
  });
});

describe("tokenizing", () => {
  it("reads a file with every segment on one line", () => {
    const oneLine = SAMPLE_ORIGINAL.replace(/\r?\n/g, "");
    expect(parseOne(oneLine)).toEqual(parseOne(SAMPLE_ORIGINAL));
  });

  it("reads a file with Windows line endings", () => {
    const crlf = SAMPLE_ORIGINAL.replace(/\n/g, "\r\n");
    expect(parseOne(crlf)).toEqual(parseOne(SAMPLE_ORIGINAL));
  });

  it("tolerates blank lines, padding and a missing final terminator", () => {
    const messy = "\n\n  B2**BTMS**ACM-44817**PP~\n\n   S5*1*LD*46000*L";
    const { segments } = tokenize(messy);
    expect(segments.map((segment) => segment.name)).toEqual(["B2", "S5"]);
  });

  it("skips an email signature pasted after the file", () => {
    const result = parseEdi(`${SAMPLE_ORIGINAL}\nThanks,\nBob`);
    expect(result.tenders[0]).toEqual(parseOne(SAMPLE_ORIGINAL));
    expect(result.warnings).toEqual([
      expect.stringContaining("did not look like EDI segments"),
    ]);
  });

  it("reads the whole file, envelope included, when prose precedes it", () => {
    // The note is split off at the ISA, so it cannot swallow the envelope.
    const result = parseEdi(`Here is tomorrow's tender.\n${SAMPLE_ORIGINAL}`);
    expect(result.tenders[0]).toEqual(parseOne(SAMPLE_ORIGINAL));
    expect(result.warnings).toEqual([
      expect.stringContaining("did not look like EDI segments"),
    ]);
  });

  it("throws when there is nothing resembling EDI", () => {
    expect(() => parseEdi("good morning denise")).toThrow(EdiParseError);
    expect(() => parseEdi("   ")).toThrow(EdiParseError);
    expect(() => parseEdi("")).toThrow(EdiParseError);
  });
});

describe("dates and times", () => {
  it("converts EDI dates to ISO", () => {
    expect(parseDate("20260924")).toBe("2026-09-24");
    expect(parseDate("260921")).toBe("2026-09-21");
    expect(parseDate("990921")).toBe("1999-09-21");
  });

  it("rejects dates it cannot trust", () => {
    expect(parseDate("2026092")).toBeNull();
    expect(parseDate("20261324")).toBeNull();
    expect(parseDate("TBD")).toBeNull();
  });

  it("converts EDI times to 24 hour clock", () => {
    expect(parseTime("0700")).toBe("07:00");
    expect(parseTime("1300")).toBe("13:00");
    expect(parseTime("070000")).toBe("07:00");
    expect(parseTime("2599")).toBeNull();
  });
});

describe("the original tender", () => {
  const tender = parseOne(SAMPLE_ORIGINAL);

  it("reads the load header", () => {
    expect(tender.shipmentId).toBe("ACM-44817");
    expect(tender.carrierCode).toBe("BTMS");
    expect(tender.paymentTerms).toMatchObject({ code: "PP", label: "Prepaid" });
    expect(tender.purpose).toMatchObject({
      code: "00",
      kind: "original",
      label: "Original tender",
    });
  });

  it("reads references", () => {
    expect(tender.references).toEqual([
      {
        qualifier: { code: "PO", label: "Purchase order", unknown: false },
        value: "PO-88213",
      },
      {
        qualifier: { code: "CR", label: "Customer reference", unknown: false },
        value: "ACM-44817",
      },
    ]);
  });

  it("treats the header G62 as the respond-by deadline", () => {
    expect(tender.respondBy).toMatchObject({ date: "2026-09-22", time: "12:00" });
  });

  it("keeps the customer note, where the TWIC requirement hides", () => {
    expect(tender.notes).toEqual([
      "DRIVER MUST HAVE TWIC. CALL TERMINAL 24 HRS AHEAD FOR APPT.",
    ]);
  });

  it("reads the bill-to party with its address", () => {
    expect(tender.billTo).toEqual({
      type: { code: "BT", label: "Bill to", unknown: false },
      name: "ACME CHEMICAL CO",
      locationCode: "ACME01",
      address: {
        street: ["4400 INDUSTRIAL PKWY"],
        city: "HOUSTON",
        state: "TX",
        postalCode: "77015",
        oneLine: "4400 INDUSTRIAL PKWY, HOUSTON, TX, 77015",
      },
    });
  });

  it("reads equipment despite the field numbering in the cheat sheet", () => {
    expect(tender.equipment).toEqual({
      number: "T-4471",
      type: { code: "TL", label: "Tank trailer", unknown: false },
      spec: {
        code: "MC307",
        label: "MC307",
        unknown: false,
        note: "Low-pressure chemical tank, typically chemicals and mild corrosives",
      },
    });
  });

  it("splits the file into a pickup and a delivery", () => {
    expect(tender.stops).toHaveLength(2);
    expect(tender.stops.map((stop) => [stop.sequence, stop.kind])).toEqual([
      [1, "pickup"],
      [2, "delivery"],
    ]);
  });

  it("attaches each stop's own party, contact and window", () => {
    const [pickup, delivery] = tender.stops;

    expect(pickup.party?.name).toBe("ACME CHEMICAL - DEER PARK TERMINAL");
    expect(pickup.party?.address?.city).toBe("DEER PARK");
    expect(pickup.contacts).toEqual([
      { name: "TERMINAL OFFICE", phone: "(281) 555-0144" },
    ]);
    expect(pickup.earliest).toMatchObject({ date: "2026-09-24", time: "07:00" });
    expect(pickup.latest).toMatchObject({ date: "2026-09-24", time: "13:00" });

    expect(delivery.party?.name).toBe("MIDWEST PAPER PRODUCTS");
    expect(delivery.party?.address?.city).toBe("SPRINGFIELD");
    expect(delivery.contacts).toEqual([
      { name: "RECEIVING", phone: "(417) 555-0199" },
    ]);
    expect(delivery.earliest).toMatchObject({ date: "2026-09-25", time: "08:00" });
    expect(delivery.latest).toMatchObject({ date: "2026-09-25", time: "16:00" });
  });

  it("flags the hazmat commodity", () => {
    expect(tender.hazmat).toEqual({ present: true, unNumbers: ["UN1824"] });
    expect(tender.stops[0].commodities).toEqual([
      {
        description: "SODIUM HYDROXIDE SOLUTION 50%",
        code: "UN1824",
        unNumber: "UN1824",
        hazmat: true,
      },
    ]);
    expect(tender.stops[0].hazmat).toBe(true);
  });

  it("reads quantities, orders and totals", () => {
    expect(tender.stops[0].quantity).toMatchObject({
      value: 46000,
      unit: { code: "L", label: "lb" },
    });
    expect(tender.stops[0].orders).toEqual([
      {
        orderId: "ACM-44817",
        purchaseOrder: "PO-88213",
        quantity: {
          value: 46000,
          unit: { code: "L", label: "lb", unknown: false },
          raw: "46000 L",
        },
      },
    ]);
    expect(tender.totals).toMatchObject({ pieces: 1 });
    expect(tender.totals?.quantity?.value).toBe(46000);
  });

  it("reads the envelope", () => {
    expect(tender.envelope).toMatchObject({
      senderId: "ACMECHEM",
      receiverId: "BULKTMS",
      transactionSetCode: "204",
      interchangeControlNumber: "000000731",
    });
    expect(tender.envelope.sent).toMatchObject({
      date: "2026-09-21",
      time: "09:12",
    });
  });

  it("parses cleanly, with no warnings and nothing unrecognised", () => {
    expect(tender.warnings).toEqual([]);
    expect(tender.ignoredSegments).toEqual([]);
  });
});

describe("the revised tender", () => {
  const tender = parseOne(SAMPLE_CHANGE);

  it("is marked as a change to an earlier tender for the same shipment", () => {
    expect(tender.shipmentId).toBe("ACM-44817");
    expect(tender.purpose).toMatchObject({ code: "04", kind: "change" });
  });

  it("picks up the added bill of lading reference", () => {
    expect(
      tender.references.find((reference) => reference.qualifier.code === "BM"),
    ).toMatchObject({ value: "BOL-207731" });
  });

  it("reads the quantity restated in gallons", () => {
    expect(tender.stops[0].quantity).toMatchObject({
      value: 3800,
      unit: { code: "GA", label: "gal" },
    });
    expect(tender.totals?.quantity).toMatchObject({
      value: 3800,
      unit: { code: "GA", label: "gal" },
    });
  });

  it("has a delivery with an earliest window but no latest", () => {
    const delivery = tender.stops[1];
    expect(delivery.earliest).toMatchObject({ date: "2026-09-28", time: "09:00" });
    expect(delivery.latest).toBeNull();
  });

  it("parses cleanly", () => {
    expect(tender.warnings).toEqual([]);
    expect(tender.ignoredSegments).toEqual([]);
  });
});

describe("holding up under odd input", () => {
  it("records unknown segments instead of failing", () => {
    const tender = parseOne(
      "B2**BTMS**ACM-1**PP~B2A*00~ZZ*SOMETHING~S5*1*LD*100*L~QQQ*1~",
    );
    expect(tender.shipmentId).toBe("ACM-1");
    expect(tender.ignoredSegments).toEqual(["QQQ", "ZZ"]);
  });

  it("labels codes it does not know rather than dropping them", () => {
    const tender = parseOne("B2**BTMS**ACM-2**XX~B2A*77~S5*1*ZZ*100*KG~");
    expect(tender.paymentTerms).toMatchObject({ code: "XX", unknown: true });
    expect(tender.purpose).toMatchObject({ code: "77", kind: "other", unknown: true });
    expect(tender.stops[0].type).toMatchObject({ code: "ZZ", unknown: true });
    expect(tender.stops[0].kind).toBe("other");
    expect(tender.stops[0].quantity?.unit).toMatchObject({
      code: "KG",
      unknown: true,
    });
  });

  it("warns about a missing shipment ID and purpose code", () => {
    const tender = parseOne("S5*1*LD*100*L~");
    expect(tender.warnings).toEqual([
      expect.stringContaining("No shipment ID"),
      expect.stringContaining("No purpose code"),
    ]);
  });

  it("warns when there are no stops", () => {
    const tender = parseOne("B2**BTMS**ACM-3**PP~B2A*00~");
    expect(tender.warnings).toEqual([expect.stringContaining("No stops")]);
  });

  it("parses a file holding more than one tender", () => {
    const twoTenders = SAMPLE_ORIGINAL.trimEnd() + "\n" + SAMPLE_CHANGE;
    const result = parseEdi(twoTenders);
    expect(result.tenders).toHaveLength(2);
    expect(result.tenders.map((tender) => tender.purpose.kind)).toEqual([
      "original",
      "change",
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining("contains 2 load tenders"),
    ]);
  });

  it("does not let segments after L3 reopen the last stop", () => {
    const tender = parseOne(
      "B2**BTMS**ACM-4**PP~B2A*00~S5*1*LD*100*L~L3*100*L*******1~G61*IC*NOBODY*TE*5551234567~",
    );
    expect(tender.stops[0].contacts).toEqual([]);
  });
});

describe("several files pasted together", () => {
  const both = `${SAMPLE_ORIGINAL}\n${SAMPLE_CHANGE}`;

  it("splits at each ISA that starts a segment", () => {
    expect(splitInterchanges(both)).toEqual([`${SAMPLE_ORIGINAL}\n`, SAMPLE_CHANGE]);
  });

  it("does not split at ISA inside data", () => {
    const named = SAMPLE_ORIGINAL.replace("ACME CHEMICAL CO", "ISA*CO");
    expect(splitInterchanges(named)).toHaveLength(1);
  });

  it("gives each tender its own envelope", () => {
    const [original, change] = parseEdi(both).tenders;
    expect(original).toEqual(parseOne(SAMPLE_ORIGINAL));
    expect(change).toEqual(parseOne(SAMPLE_CHANGE));
    expect(original.envelope.interchangeControlNumber).toBe("000000731");
    expect(change.envelope.interchangeControlNumber).toBe("000000748");
  });

  it("reads each file with its own separators", () => {
    const alternate = SAMPLE_CHANGE.replace(/\*/g, "|").replace(/~/g, "^");
    const [original, change] = parseEdi(`${SAMPLE_ORIGINAL}${alternate}`).tenders;
    expect(original).toEqual(parseOne(SAMPLE_ORIGINAL));
    expect(change).toEqual(parseOne(SAMPLE_CHANGE));
  });
});
