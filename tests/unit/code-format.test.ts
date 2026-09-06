import { describe, it, expect } from "vitest";
import { isValidAssetCode } from "@/server/modules/code-generator";

describe("asset code validation", () => {
  it("قالب استاندارد پذیرفته می‌شود", () => {
    expect(isValidAssetCode("AST-IT-MOU-000001")).toBe(true);
    expect(isValidAssetCode("AST-NET-SRV-000123")).toBe(true);
    expect(isValidAssetCode("AST-FUR-DSK-1234")).toBe(true);
  });

  it("قالب‌های خراب رد می‌شوند", () => {
    expect(isValidAssetCode("it-mou-1")).toBe(false);
    expect(isValidAssetCode("AST-IT-000001")).toBe(false);
    expect(isValidAssetCode("")).toBe(false);
    expect(isValidAssetCode("AST-IT-MOU-ABC")).toBe(false);
  });
});
