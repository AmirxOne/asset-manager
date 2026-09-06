import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * /a/{code} — مقصد QR.
 * نیازی به auth نداریم چون middleware کوکی session را چک می‌کند و
 * بدون لاگین به /login?next=/a/CODE می‌رود؛ بعد از ورود برمی‌گردد همین‌جا.
 */
export default async function QRRedirectPage(
  { params }: { params: Promise<{ code: string }> },
  _req?: NextRequest,
) {
  const { code } = await params;
  const decoded = decodeURIComponent(code).toUpperCase();

  const asset = await prisma.asset.findFirst({
    where: { code: decoded, isDeleted: false },
    select: { id: true },
  });

  if (!asset) redirect("/assets?q=" + encodeURIComponent(decoded));
  redirect(`/assets/${asset.id}`);
}
