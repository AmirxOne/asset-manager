import { describe, it, expect } from "vitest";
import {
  canTransition,
  allowedTransitions,
  eventOfTransition,
  ASSET_STATUSES,
} from "@/server/modules/asset-lifecycle";

describe("asset status transition matrix", () => {
  it("گذارهای مجاز اصلی", () => {
    expect(canTransition("IN_STOCK", "ASSIGNED")).toBe(true);
    expect(canTransition("AVAILABLE", "MAINTENANCE")).toBe(true);
    expect(canTransition("MAINTENANCE", "AVAILABLE")).toBe(true);
    expect(canTransition("ASSIGNED", "IN_USE")).toBe(true);
    expect(canTransition("RETIRED", "DISPOSED")).toBe(true);
    expect(canTransition("LOST", "RETIRED")).toBe(true);
  });

  it("گذارهای غیرمجاز رد می‌شوند", () => {
    expect(canTransition("DISPOSED", "AVAILABLE")).toBe(false); // ترمینال
    expect(canTransition("DISPOSED", "IN_STOCK")).toBe(false);
    expect(canTransition("RETIRED", "ASSIGNED")).toBe(false); // بازنشسته دیگر تحویل نمی‌شود
    expect(canTransition("LOST", "ASSIGNED")).toBe(false); // اول باید پیدا شود
    expect(canTransition("IN_STOCK", "IN_USE")).toBe(false); // باید اول تحویل شود
  });

  it("هر وضعیت لیست گذار معتبر دارد", () => {
    for (const s of ASSET_STATUSES) {
      expect(Array.isArray(allowedTransitions(s))).toBe(true);
    }
    expect(allowedTransitions("DISPOSED")).toEqual([]);
  });

  it("نقش رویداد هر گذار", () => {
    expect(eventOfTransition("AVAILABLE", "ASSIGNED")).toBe("ASSIGNED");
    expect(eventOfTransition("ASSIGNED", "ASSIGNED")).toBe("TRANSFERRED");
    expect(eventOfTransition("MAINTENANCE", "AVAILABLE")).toBe("REPAIRED");
    expect(eventOfTransition("IN_STOCK", "RETIRED")).toBe("RETIRED");
    expect(eventOfTransition("AVAILABLE", "LOST")).toBe("LOST");
    expect(eventOfTransition("MAINTENANCE", "MAINTENANCE")).toBe("MAINTENANCE");
  });
});
