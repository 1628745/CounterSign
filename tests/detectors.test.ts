import { describe, expect, it } from "vitest";
import demo from "../data/scenarios/demo.json";
import { checkExecImpersonation } from "@/lib/countersign/execImpersonation";
import { detectHiddenText } from "@/lib/countersign/hiddenText";
import { renderNaiveEmail } from "@/lib/countersign/htmlText";
import { checkLookalike, checkLookalikeSender } from "@/lib/countersign/lookalike";
import { detectPressure } from "@/lib/countersign/pressure";

function findEmail(id: string) {
  const found = demo.emails.find((e) => e.id === id);
  if (!found) throw new Error(`fixture email ${id} not found`);
  return found;
}

// Detectors, unit-tested on the real E1-E8 emails (SPEC.md section 8, this prompt's task 1).

describe("hiddenText (SPEC.md section 8)", () => {
  it("E5: finds exactly one hidden span, with offsets that round-trip against the rendered text", () => {
    const email = findEmail("e5");
    const spans = detectHiddenText(email.html);
    expect(spans).toHaveLength(1);
    expect(spans[0].reason).toBe("display-none");

    const { text } = renderNaiveEmail(email.html);
    expect(text.slice(spans[0].offsetStart, spans[0].offsetEnd)).toBe(spans[0].text);
    expect(spans[0].text).toContain("effective immediately");
  });

  it("E1, E3, E4, E6, E7, E8: no hidden text", () => {
    for (const id of ["e1", "e3", "e4", "e6", "e7", "e8"]) {
      expect(detectHiddenText(findEmail(id).html)).toEqual([]);
    }
  });

  it("E2: no hidden text (the lookalike remittance-change email is fully visible)", () => {
    expect(detectHiddenText(findEmail("e2").html)).toEqual([]);
  });
});

describe("lookalike (SPEC.md section 8)", () => {
  it("E2's sender domain is a hyphen-insertion lookalike of blueridgegreencoffee.com", () => {
    const email = findEmail("e2");
    const result = checkLookalikeSender(email.from_address);
    expect(result).toEqual({ isLookalike: true, imitates: "blueridgegreencoffee.com", technique: "hyphen-insertion" });
  });

  it("legit vendor senders (E1, E3, E4, E6, E8) are not lookalikes", () => {
    for (const id of ["e1", "e3", "e4", "e6", "e8"]) {
      expect(checkLookalikeSender(findEmail(id).from_address).isLookalike).toBe(false);
    }
  });

  it("E7's gmail.com sender is not a lookalike of any known vendor domain", () => {
    expect(checkLookalikeSender(findEmail("e7").from_address).isLookalike).toBe(false);
  });

  it("detects TLD swap and homoglyph techniques directly", () => {
    expect(checkLookalike("chesapeakedairy.co")).toEqual({ isLookalike: true, imitates: "chesapeakedairy.com", technique: "tld-swap" });
    expect(checkLookalike("blueridgegreencoffee.corn")).toMatchObject({ isLookalike: true, imitates: "blueridgegreencoffee.com" });
  });
});

describe("pressure (SPEC.md section 8)", () => {
  it("E7 fires with the urgency/secrecy phrases actually present", () => {
    const email = findEmail("e7");
    const { text } = renderNaiveEmail(email.html);
    const result = detectPressure(text);
    expect(result.fired).toBe(true);
    expect(result.matches).toEqual(expect.arrayContaining(["urgent", "won't be reachable", "keep this quiet", "discreetly"]));
  });

  it("normal invoices (E1, E3, E4, E6, E8) do not fire pressure language", () => {
    for (const id of ["e1", "e3", "e4", "e6", "e8"]) {
      const { text } = renderNaiveEmail(findEmail(id).html);
      expect(detectPressure(text).fired).toBe(false);
    }
  });

  it("E5's hidden bait text fires pressure language on 'effective immediately'", () => {
    const { text } = renderNaiveEmail(findEmail("e5").html);
    expect(detectPressure(text).matches).toContain("effective immediately");
  });
});

describe("execImpersonation (SPEC.md section 8)", () => {
  it("E7 claims the owner from an outside domain", () => {
    const email = findEmail("e7");
    const result = checkExecImpersonation(email.from_name, email.from_address);
    expect(result).toMatchObject({ fired: true, claimedName: "Dana Whitfield (Owner)", senderDomain: "gmail.com" });
  });

  it("normal vendor emails do not claim to be the owner", () => {
    for (const id of ["e1", "e2", "e3", "e4", "e5", "e6", "e8"]) {
      const email = findEmail(id);
      expect(checkExecImpersonation(email.from_name, email.from_address).fired).toBe(false);
    }
  });
});
