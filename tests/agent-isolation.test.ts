import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC.md section 14, non-negotiable #1: "Agent code never imports the
// signer or reads *_SECRET_KEY vars." This is enforced statically by the
// no-restricted-imports/no-restricted-syntax rule in eslint.config.mjs;
// this test is the belt-and-suspenders runtime check the non-negotiable
// asks for, so it still fails even if the lint rule is ever disabled.

const AGENT_DIR = join(__dirname, "..", "src", "lib", "agent");

function listFilesRecursive(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFilesRecursive(full) : [full];
  });
}

describe("agent isolation (SPEC.md section 14, #1)", () => {
  const files = listFilesRecursive(AGENT_DIR).filter((f) => /\.(ts|tsx)$/.test(f));

  it("found agent source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s never imports the signer", (file) => {
    const source = readFileSync(file, "utf-8");
    expect(source).not.toMatch(/from\s+["'].*solana\/signer.*["']/);
  });

  it.each(files)("%s never references a *_SECRET_KEY env var", (file) => {
    const source = readFileSync(file, "utf-8");
    expect(source).not.toMatch(/process\.env\.\w*_SECRET_KEY\b/);
  });
});
