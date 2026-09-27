import { describe, expect, it } from "vitest";
import { mapPollResponse, sanitizeBindingMessage } from "@/lib/auth0/ciba";

describe("sanitizeBindingMessage (SPEC.md section 9)", () => {
  it("keeps letters, digits, spaces and + - _ . , : #", () => {
    expect(sanitizeBindingMessage("Pay 4800.00 mUSDC to 9xQe..Wk2P new payee: +confirm-me_1,2#3"))
      .toBe("Pay 4800.00 mUSDC to 9xQe..Wk2P new payee: +confirm-me_1,2#3");
  });

  it("strips disallowed characters (emoji, slashes, quotes, newlines, question marks, dollar signs)", () => {
    expect(sanitizeBindingMessage('Pay $4,800 to "attacker"? 🚨\n/bin/sh')).toBe("Pay 4,800 to attacker binsh");
  });

  it("truncates to 64 characters", () => {
    const long = "A".repeat(100);
    const result = sanitizeBindingMessage(long);
    expect(result).toHaveLength(64);
    expect(result).toBe("A".repeat(64));
  });

  it("truncates after sanitizing, not before", () => {
    const input = "!".repeat(60) + "A".repeat(60); // 60 stripped chars + 60 kept chars
    expect(sanitizeBindingMessage(input)).toBe("A".repeat(60));
  });
});

describe("mapPollResponse (SPEC.md section 9)", () => {
  it("maps HTTP 200 to approved", () => {
    expect(mapPollResponse(200, {})).toEqual({ status: "approved" });
  });

  it("maps authorization_pending to pending with no interval override", () => {
    expect(mapPollResponse(400, { error: "authorization_pending" })).toEqual({ status: "pending" });
  });

  it("maps slow_down with a numeric interval field", () => {
    expect(mapPollResponse(400, { error: "slow_down", interval: 12 })).toEqual({ status: "pending", intervalS: 12 });
  });

  it("maps slow_down by parsing seconds out of error_description", () => {
    expect(mapPollResponse(400, { error: "slow_down", error_description: "You are polling too fast, wait 15 seconds" })).toEqual({
      status: "pending",
      intervalS: 15,
    });
  });

  it("floors slow_down backoff at 6 seconds", () => {
    expect(mapPollResponse(400, { error: "slow_down", interval: 2 })).toEqual({ status: "pending", intervalS: 6 });
    expect(mapPollResponse(400, { error: "slow_down" })).toEqual({ status: "pending", intervalS: 6 });
  });

  it("maps access_denied to denied", () => {
    expect(mapPollResponse(400, { error: "access_denied" })).toEqual({ status: "denied" });
  });

  it("maps expired_token to expired", () => {
    expect(mapPollResponse(400, { error: "expired_token" })).toEqual({ status: "expired" });
  });

  it("throws on an unrecognized error code", () => {
    expect(() => mapPollResponse(400, { error: "invalid_grant", error_description: "nope" })).toThrow();
  });
});
