import { cn } from "@/lib";

/** Badge وضعیت دارایی — رنگ مطابق سند دیزاین 05 */
const ASSET_STATUS_TONE: Record<string, string> = {
  IN_STOCK: "badge-green",
  AVAILABLE: "badge-green",
  ASSIGNED: "badge-blue",
  IN_USE: "badge-blue",
  MAINTENANCE: "badge-amber",
  LOST: "badge-red",
  RETIRED: "badge-gray",
  DISPOSED: "badge-black",
};

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

const CONDITION_TONE: Record<string, string> = {
  EXCELLENT: "badge-green",
  GOOD: "badge-blue",
  FAIR: "badge-amber",
  DAMAGED: "badge-red",
  BROKEN: "badge-red",
};

const GENERIC_TONE: Record<string, string> = {
  ACTIVE: "badge-green",
  SUSPENDED: "badge-amber",
  TERMINATED: "badge-gray",
  PENDING: "badge-amber",
  MANAGER_APPROVED: "badge-blue",
  IT_APPROVED: "badge-blue",
  FULFILLED: "badge-green",
  REJECTED: "badge-red",
  CANCELLED: "badge-gray",
  OPEN: "badge-amber",
  IN_PROGRESS: "badge-blue",
  DONE: "badge-green",
  MATCHED: "badge-green",
  UNEXPECTED: "badge-amber",
  INVALID: "badge-red",
  DUPLICATE: "badge-gray",
  RETURNED: "badge-gray",
};

const GENERIC_FA: Record<string, string> = {
  ACTIVE: "فعال",
  SUSPENDED: "معلق",
  TERMINATED: "پایان همکاری",
  PENDING: "در انتظار",
  MANAGER_APPROVED: "تأیید مدیر",
  IT_APPROVED: "تأیید IT",
  FULFILLED: "تأمین‌شده",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
  OPEN: "باز",
  IN_PROGRESS: "در جریان",
  DONE: "انجام‌شده",
  MATCHED: "مطابق",
  UNEXPECTED: "خارج از فهرست",
  INVALID: "نامعتبر",
  DUPLICATE: "تکراری",
  RETURNED: "عودت‌شده",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const fa = ASSET_STATUS_FA[status] ?? GENERIC_FA[status] ?? status;
  const tone = ASSET_STATUS_TONE[status] ?? GENERIC_TONE[status] ?? "badge-gray";
  return <span className={cn("badge", tone, className)}>{fa}</span>;
}

export function ConditionBadge({ condition, className }: { condition: string; className?: string }) {
  const fa = ASSET_CONDITION_FA[condition] ?? condition;
  const tone = CONDITION_TONE[condition] ?? "badge-gray";
  return <span className={cn("badge", tone, className)}>{fa}</span>;
}
