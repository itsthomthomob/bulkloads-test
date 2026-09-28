import { parseEdi } from "./parse";
import type { LoadTender, ParseResult } from "./types";

/** One source of EDI text: an uploaded file, or whatever was pasted. */
export interface SourceDocument {
  id: string;
  /** File name, or a label such as "Pasted text". */
  name: string;
  text: string;
}

export type DocumentResult =
  | { id: string; name: string; status: "parsed"; result: ParseResult }
  | { id: string; name: string; status: "failed"; message: string };

/** A tender with where it came from and the letter the UI knows it by. */
export interface TenderEntry {
  /** Stable within one parse, for React keys and selection. */
  key: string;
  /** `A`, `B`, … in the order the tenders appear. */
  letter: string;
  sourceName: string;
  tender: LoadTender;
}

/**
 * Parses each document on its own, so one unreadable file is reported
 * against its name while the rest still load.
 */
export function parseDocuments(documents: SourceDocument[]): DocumentResult[] {
  return documents.map(({ id, name, text }) => {
    try {
      return { id, name, status: "parsed", result: parseEdi(text) };
    } catch (error) {
      return {
        id,
        name,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong reading this file.",
      };
    }
  });
}

/** Every tender across the documents, in order, lettered A, B, C… */
export function listTenders(results: DocumentResult[]): TenderEntry[] {
  const entries: TenderEntry[] = [];
  for (const document of results) {
    if (document.status !== "parsed") {
      continue;
    }
    document.result.tenders.forEach((tender, index) => {
      entries.push({
        key: `${document.id}:${index}`,
        letter: tenderLetter(entries.length),
        sourceName: document.name,
        tender,
      });
    });
  }
  return entries;
}

/** 0 → `A`, 25 → `Z`, 26 → `AA`, like spreadsheet columns. */
export function tenderLetter(index: number): string {
  let letters = "";
  let remaining = index + 1;
  while (remaining > 0) {
    const digit = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + digit) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}
