import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";

const REDACTED = "[redacted]";
const REDACT_KEYS = new Set(["passwordHash", "password", "tokenHash", "token", "secret"]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k) ? REDACTED : redact(v);
    }
    return out;
  }
  return value;
}

export type AuditAction =
  | "CREATE" | "UPDATE" | "DELETE" | "ASSIGN" | "RETURN" | "TRANSFER"
  | "MAINTENANCE" | "STATUS_CHANGE" | "AUDIT" | "LOGIN" | "LOGOUT"
  | "EXPORT" | "IMPORT" | "BULK";

export async function writeAudit(opts: {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  req?: NextRequest;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: opts.actorId ?? null,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      oldValue: opts.oldValue === undefined ? undefined : (redact(opts.oldValue) as object),
      newValue: opts.newValue === undefined ? undefined : (redact(opts.newValue) as object),
      ip:
        opts.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        opts.req?.headers.get("x-real-ip") ??
        null,
      userAgent: opts.req?.headers.get("user-agent") ?? null,
    },
  }).catch((e) => console.error("[audit] write failed", e));
}
