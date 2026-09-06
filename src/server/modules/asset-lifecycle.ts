/** ماشین حالت وضعیت دارایی — سند 01 (DB Design) §Status Transitions */

export const ASSET_STATUSES = [
  "IN_STOCK", "AVAILABLE", "ASSIGNED", "IN_USE",
  "MAINTENANCE", "LOST", "RETIRED", "DISPOSED",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "DAMAGED", "BROKEN"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

/** گذارهای مجاز — هر چیز خارج از این ماتریس reject می‌شود */
const TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  IN_STOCK: ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "LOST", "RETIRED"],
  AVAILABLE: ["ASSIGNED", "IN_STOCK", "MAINTENANCE", "LOST", "RETIRED"],
  ASSIGNED: ["IN_USE", "AVAILABLE", "IN_STOCK", "MAINTENANCE", "LOST", "RETIRED", "ASSIGNED"],
  IN_USE: ["AVAILABLE", "IN_STOCK", "MAINTENANCE", "LOST", "RETIRED"],
  MAINTENANCE: ["AVAILABLE", "IN_STOCK", "RETIRED", "MAINTENANCE"],
  LOST: ["RETIRED", "IN_STOCK", "AVAILABLE"],
  RETIRED: ["DISPOSED"],
  DISPOSED: [],
};

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: AssetStatus): AssetStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}

/** نقش رویداد چرخه عمر برای هر گذار (ASSIGNED→ASSIGNED = انتقال) */
export function eventOfTransition(from: AssetStatus, to: AssetStatus): string {
  if (from === to && to === "MAINTENANCE") return "MAINTENANCE";
  if (from === to && to === "ASSIGNED") return "TRANSFERRED";
  switch (to) {
    case "ASSIGNED": return "ASSIGNED";
    case "IN_USE": return "IN_USE";
    case "MAINTENANCE": return "MAINTENANCE";
    case "LOST": return "LOST";
    case "RETIRED": return "RETIRED";
    case "DISPOSED": return "DISPOSED";
    case "AVAILABLE": return from === "MAINTENANCE" ? "REPAIRED" : "AVAILABLE";
    case "IN_STOCK": return "IN_STOCK";
    default: return "STATUS_CHANGE";
  }
}

export const ASSET_STATUS_FA: Record<string, string> = {
  IN_STOCK: "در انبار",
  AVAILABLE: "موجود",
  ASSIGNED: "تحویل‌شده",
  IN_USE: "در استفاده",
  MAINTENANCE: "در تعمیر",
  LOST: "گم‌شده",
  RETIRED: "بازنشسته",
  DISPOSED: "اسقاط‌شده",
};

export const ASSET_CONDITION_FA: Record<string, string> = {
  EXCELLENT: "عالی",
  GOOD: "خوب",
  FAIR: "قابل قبول",
  DAMAGED: "آسیب‌دیده",
  BROKEN: "خراب",
};
