import { EdiParseError, type Segment, type Separators } from "./types";

const DEFAULT_SEPARATORS: Separators = {
  element: "*",
  component: ":",
  segment: "~",
};

/**
 * An ISA segment is fixed width: 105 characters of data plus a terminator.
 * The separators are declared by position rather than by value.
 */
const ISA_LENGTH = 106;
const ISA_ELEMENT_SEPARATOR_INDEX = 3;
const ISA_COMPONENT_SEPARATOR_INDEX = 104;
const ISA_SEGMENT_TERMINATOR_INDEX = 105;

/**
 * Reads the separators out of the ISA segment. Both sample files use the
 * common `*` and `~`, but the standard lets a sender pick anything, and a
 * file that uses something else is otherwise unreadable.
 */
export function detectSeparators(input: string): Separators {
  const text = input.trimStart();
  if (!text.toUpperCase().startsWith("ISA") || text.length < ISA_LENGTH) {
    return DEFAULT_SEPARATORS;
  }

  const element = text[ISA_ELEMENT_SEPARATOR_INDEX];
  const component = text[ISA_COMPONENT_SEPARATOR_INDEX];
  const segment = text[ISA_SEGMENT_TERMINATOR_INDEX];

  // A separator has to be punctuation; if these positions hold letters or
  // digits the ISA is not really fixed width and we are better off guessing.
  if (!isSeparator(element) || !isSeparator(segment)) {
    return DEFAULT_SEPARATORS;
  }

  return {
    element,
    component: isSeparator(component) ? component : DEFAULT_SEPARATORS.component,
    segment,
  };
}

function isSeparator(char: string | undefined): boolean {
  return char !== undefined && !/[A-Za-z0-9\s]/.test(char);
}

/** X12 segment IDs are two or three characters, letters and digits only. */
const SEGMENT_NAME_PATTERN = /^[A-Z][A-Z0-9]{1,2}$/;

export interface TokenizeResult {
  segments: Segment[];
  /**
   * Chunks that did not begin with a plausible segment name, such as an email
   * signature pasted along with the file.
   */
  skipped: string[];
}

/**
 * Splits raw EDI text into segments.
 *
 * Tolerates the ways a file arrives from a mail client or Notepad: one segment
 * per line, everything on a single line, stray blank lines, a missing
 * terminator on the final segment, and surrounding prose.
 *
 * Throws only when nothing in the input looks like a segment.
 */
export function tokenize(
  input: string,
  separators: Separators = detectSeparators(input),
): TokenizeResult {
  const segments: Segment[] = [];
  const skipped: string[] = [];

  for (const chunk of input.split(separators.segment)) {
    // Line breaks between segments are formatting, not data.
    const raw = chunk.replace(/[\r\n]+/g, "").trim();
    if (raw === "") {
      continue;
    }

    const elements = raw.split(separators.element).map((value) => value.trim());
    const name = elements[0].toUpperCase();
    if (!SEGMENT_NAME_PATTERN.test(name)) {
      skipped.push(raw);
      continue;
    }

    elements[0] = name;
    segments.push({ name, elements, position: segments.length + 1, raw });
  }

  if (segments.length === 0) {
    throw new EdiParseError(
      "This does not look like an EDI file. Expected records separated by " +
        `"${separators.segment}", for example "B2**BTMS**ACM-44817**PP${separators.segment}".`,
    );
  }

  return { segments, skipped };
}

/**
 * Returns field `index` of a segment, or null when it is absent or blank.
 * Index matches the cheat sheet, where field 1 is the first field after the
 * segment name.
 */
export function field(segment: Segment, index: number): string | null {
  const value = segment.elements[index];
  return value === undefined || value === "" ? null : value;
}

/** Field `index` parsed as a number, or null when absent or non-numeric. */
export function numericField(segment: Segment, index: number): number | null {
  const value = field(segment, index);
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
