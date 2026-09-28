import { describe, expect, it } from "vitest";

import { listTenders, parseDocuments, tenderLetter } from "./documents";
import { SAMPLE_CHANGE, SAMPLE_ORIGINAL } from "./samples";

describe("parseDocuments", () => {
  it("reports an unreadable file by name and still reads the rest", () => {
    const results = parseDocuments([
      { id: "a", name: "original.edi", text: SAMPLE_ORIGINAL },
      { id: "b", name: "notes.txt", text: "call me back" },
      { id: "c", name: "change.edi", text: SAMPLE_CHANGE },
    ]);

    expect(results.map((result) => result.status)).toEqual([
      "parsed",
      "failed",
      "parsed",
    ]);
    expect(results[1]).toMatchObject({
      name: "notes.txt",
      message: expect.stringContaining("does not look like an EDI file"),
    });
  });
});

describe("listTenders", () => {
  it("letters every tender across files, remembering its source", () => {
    const entries = listTenders(
      parseDocuments([
        { id: "a", name: "original.edi", text: SAMPLE_ORIGINAL },
        { id: "b", name: "both.edi", text: `${SAMPLE_ORIGINAL}${SAMPLE_CHANGE}` },
      ]),
    );

    expect(
      entries.map(({ key, letter, sourceName, tender }) => [
        key,
        letter,
        sourceName,
        tender.purpose.kind,
      ]),
    ).toEqual([
      ["a:0", "A", "original.edi", "original"],
      ["b:0", "B", "both.edi", "original"],
      ["b:1", "C", "both.edi", "change"],
    ]);
  });
});

describe("tenderLetter", () => {
  it("counts like spreadsheet columns", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(tenderLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});
