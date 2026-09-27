import { load } from "cheerio";
import type { AnyNode } from "domhandler";

export type HiddenReason =
  | "display-none"
  | "visibility-hidden"
  | "opacity-zero"
  | "tiny-font"
  | "color-match-background"
  | "zero-width-chars";

export interface HiddenSpan {
  text: string;
  offsetStart: number;
  offsetEnd: number;
  reason: HiddenReason;
}

export interface RenderedEmail {
  /** Naive HTML-to-text: every text node, in document order, hidden or not (SPEC.md section 7). */
  text: string;
  /** Where (in `text`) hidden content landed, and why it's considered hidden. */
  hiddenSpans: HiddenSpan[];
}

const BLOCK_TAGS = new Set(["p", "div", "tr", "table", "hr", "li"]);
const ZERO_WIDTH_RE = /[​‌‍﻿]+/g;

function normalizeColor(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/** Checks an element's own inline style for one of SPEC.md section 8's hidden-text techniques. */
function ownHiddenReason(style: string | undefined): HiddenReason | null {
  if (!style) return null;
  const s = style.toLowerCase();
  if (/display\s*:\s*none/.test(s)) return "display-none";
  if (/visibility\s*:\s*hidden/.test(s)) return "visibility-hidden";
  if (/opacity\s*:\s*0*\.?0+\s*(;|$)/.test(s)) return "opacity-zero";

  const fontSize = s.match(/font-size\s*:\s*([\d.]+)px/);
  if (fontSize && parseFloat(fontSize[1]) <= 2) return "tiny-font";

  const color = s.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
  const background = s.match(/background(?:-color)?\s*:\s*([^;]+)/);
  if (color && background && normalizeColor(color[1]) === normalizeColor(background[1])) {
    return "color-match-background";
  }
  return null;
}

/**
 * Walks the DOM in document order, building the same naive plain-text
 * rendering src/lib/agent/tools.ts's read_email produces (hidden content
 * included — that's the point), while separately tracking which offset
 * ranges in that text came from hidden elements or zero-width characters.
 */
export function renderNaiveEmail(html: string): RenderedEmail {
  const $ = load(html);
  let text = "";
  const hiddenSpans: HiddenSpan[] = [];

  function appendText(chunk: string, hiddenReason: HiddenReason | null): void {
    if (chunk.length === 0) return;
    const offsetStart = text.length;
    text += chunk;
    if (hiddenReason) {
      hiddenSpans.push({ text: chunk, offsetStart, offsetEnd: text.length, reason: hiddenReason });
    } else {
      // Even visible text can smuggle zero-width characters.
      let match: RegExpExecArray | null;
      const re = new RegExp(ZERO_WIDTH_RE);
      while ((match = re.exec(chunk))) {
        const start = offsetStart + match.index;
        hiddenSpans.push({ text: match[0], offsetStart: start, offsetEnd: start + match[0].length, reason: "zero-width-chars" });
      }
    }
  }

  function walk(node: AnyNode, inheritedHidden: HiddenReason | null): void {
    if (node.type === "text") {
      appendText((node as unknown as { data: string }).data, inheritedHidden);
      return;
    }
    if (node.type !== "tag" && node.type !== "script" && node.type !== "style") {
      return;
    }
    const el = node as unknown as { name: string; attribs?: Record<string, string>; children: AnyNode[] };
    if (node.type === "script" || node.type === "style") {
      return;
    }
    const ownReason = ownHiddenReason(el.attribs?.style);
    const effectiveHidden = inheritedHidden ?? ownReason;

    if (el.name === "br") {
      text += "\n";
      return;
    }

    for (const child of el.children ?? []) {
      walk(child, effectiveHidden);
    }

    if (BLOCK_TAGS.has(el.name)) {
      text += "\n";
    }
  }

  const root = $.root().get(0);
  if (root) {
    for (const child of (root as unknown as { children: AnyNode[] }).children ?? []) {
      walk(child, null);
    }
  }

  // Only trim leading/trailing whitespace — offsets shift by a constant
  // amount for a leading trim, which is easy to correct for. Collapsing
  // repeated internal newlines is deliberately not done here: it would
  // require re-deriving every span's offset against a shorter string, and
  // read_email must render *exactly* this text for offsets to mean
  // anything (SPEC.md section 7).
  const leadingWhitespace = text.length - text.replace(/^\s+/, "").length;
  const trimmedText = text.trim();
  const adjustedSpans = hiddenSpans
    .map((span) => ({
      ...span,
      offsetStart: span.offsetStart - leadingWhitespace,
      offsetEnd: span.offsetEnd - leadingWhitespace,
    }))
    .filter((span) => span.offsetStart >= 0 && span.offsetEnd <= trimmedText.length);

  return { text: trimmedText, hiddenSpans: adjustedSpans };
}
