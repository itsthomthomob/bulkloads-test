import { describe, expect, it } from "vitest";

import { parseEdi } from "../edi/parse";
import { SAMPLE_ORIGINAL } from "../edi/samples";
import { directMiles, locateStops, toZip5, type ZipTable } from "./locate";

const TABLE: ZipTable = {
  "77536": [29.69, -95.12],
  "65802": [37.21, -93.35],
};

const stops = () => parseEdi(SAMPLE_ORIGINAL).tenders[0].stops;

describe("toZip5", () => {
  it("accepts a five-digit ZIP and ZIP+4 in either form", () => {
    expect(toZip5("77536")).toBe("77536");
    expect(toZip5("77536-1234")).toBe("77536");
    expect(toZip5("775361234")).toBe("77536");
  });

  it("rejects anything that is not a US ZIP", () => {
    expect(toZip5(null)).toBeNull();
    expect(toZip5("K1A 0B1")).toBeNull();
    expect(toZip5("7753")).toBeNull();
  });
});

describe("locateStops", () => {
  it("places both sample stops at their ZIP centres", () => {
    const { points, unplaced } = locateStops(stops(), TABLE);

    expect(unplaced).toEqual([]);
    expect(points).toEqual([
      { index: 0, number: 1, kind: "pickup", zip: "77536", latitude: 29.69, longitude: -95.12 },
      { index: 1, number: 2, kind: "delivery", zip: "65802", latitude: 37.21, longitude: -93.35 },
    ]);
  });

  it("reports a stop it cannot place instead of dropping it", () => {
    const { points, unplaced } = locateStops(stops(), { "77536": [29.69, -95.12] });

    expect(points.map((point) => point.number)).toEqual([1]);
    expect(unplaced).toEqual([
      { index: 1, number: 2, reason: "ZIP 65802 is not in the map's ZIP table" },
    ]);
  });

  it("explains a stop with no ZIP at all", () => {
    const [pickup] = stops();
    const withoutAddress = { ...pickup, party: null };

    expect(locateStops([withoutAddress], TABLE).unplaced).toEqual([
      { index: 0, number: 1, reason: "no ZIP code in the file" },
    ]);
  });
});

describe("directMiles", () => {
  it("measures Deer Park to Springfield as roughly 530 miles", () => {
    const { points } = locateStops(stops(), TABLE);
    expect(directMiles(points)).toBeGreaterThan(500);
    expect(directMiles(points)).toBeLessThan(540);
  });

  it("is zero with fewer than two points", () => {
    expect(directMiles([])).toBe(0);
    expect(directMiles(locateStops(stops(), TABLE).points.slice(0, 1))).toBe(0);
  });
});
