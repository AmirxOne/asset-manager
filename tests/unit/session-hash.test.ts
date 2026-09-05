import { describe, it, expect } from "vitest";
import { hashToken } from "@/server/auth/session";

describe("session token hashing", () => {
  it("deterministic — same token, same hash", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("different tokens → different hashes", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("output is sha256 hex (64 chars)", () => {
    expect(hashToken("token-1")).toMatch(/^[a-f0-9]{64}$/);
  });
});
