import { prisma } from "@/server/db";

export const DEFAULT_CODE_PATTERN = "AST-{CAT}-{TYPE}-{SEQ:6}";

/**
 * تولید کد دارایی اتمیک — AST-IT-MOU-000001
 * شمارنده در CodeSequence با upsert increment — زیر UNIQUE تضمین می‌شود
 * و چون increment داخل تراکنش انجام می‌شود، دو درخواست همزمان هرگز
 * کد یکسان نمی‌گیرند.
 */
export async function generateAssetCode(
  categoryCode: string,
  typeCode: string,
  pattern: string = DEFAULT_CODE_PATTERN,
): Promise<string> {
  const prefix = buildPrefix(categoryCode, typeCode, pattern);

  const row = await prisma.$queryRaw<{ seq: bigint }[]>`
    INSERT INTO "CodeSequence" ("prefix", "seq") VALUES (${prefix}, 1)
    ON CONFLICT ("prefix")
    DO UPDATE SET "seq" = "CodeSequence"."seq" + 1
    RETURNING "seq"
  `;
  const seq = Number(row[0].seq);

  const padded = pattern.includes("{SEQ:6}")
    ? String(seq).padStart(6, "0")
    : String(seq).padStart(4, "0");

  return pattern
    .replace("{CAT}", categoryCode.toUpperCase())
    .replace("{TYPE}", typeCode.toUpperCase())
    .replace(/\{SEQ:?6?\}/, padded);
}

function buildPrefix(cat: string, type: string, pattern: string): string {
  // prefix شمارنده باید مستقل از SEQ padding باشد
  return pattern
    .replace("{CAT}", cat.toUpperCase())
    .replace("{TYPE}", type.toUpperCase())
    .replace(/\{SEQ:?6?\}/, "");
}

/** اعتبارسنجی کد دستی در برابر الگو */
export function isValidAssetCode(code: string): boolean {
  return /^AST-[A-Z0-9]+-[A-Z0-9]+-\d{4,6}$/.test(code);
}
