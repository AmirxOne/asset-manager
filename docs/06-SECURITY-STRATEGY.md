# امنیت، اعتبارسنجی و خطاها — AMS

نسخه: 1.0 — Phase 1..10 · الزامات + استراتژی

## 1. Authentication

- **Session opaque token**: 256-bit random (crypto) → cookie `ams_session` HttpOnly + SameSite=Lax + Secure(prod) + Path=/. در DB فقط **sha256(token)** ذخیره می‌شود (سرقت DB ≠ session hijack).
- TTL: 7 روز rollover با `lastSeenAt` (اگر 14 روز未见 → انقضا). ابطال سرور-side (logout / user deactivate → همه sessions حذف).
- bcryptjs cost 12. سیاست رمز: حداقل 8 کاراکتر شامل حرف+رقم.
- **Rate limiting login:** 5 تلاش/15 دقیقه per (identifier + IP) با پاسخ 429 و پیام فارسی؛ شمارنده در DB (بدون Redis اجباری برای v1 — جدول LoginAttempt با پاکسازی دوره‌ای).
- خروج و تغییر رمز → rotate همه sessionها.

## 2. Authorization

- middleware.ts: مسیرهای `/((api|app) منهای public)` → بدون session valid → 401/redirect login.
- هر route handler: `requirePerm(perm)` (سند 03) — تست integration دارد.
- Data scoping (dept_manager/employee) در سرویس‌لایر — نه فقط UI.
- **Object-level checks:** `/api/assets/{id}` برای employee → فقط دارایی‌های خودش (IDOR تست می‌شود).
- CSRF: SameSite=Lax + mutation endpoints فقط POST/PATCH/DELETE با same-origin check (header Origin/Sec-Fetch-Site).

## 3. Input Validation & Sanitization

- Zod روی همه بدنه‌ها/کوئری‌ها؛ schema مشترک client/server.
- حدها: string max (مثلاً name 120)، enumها allowlist، Decimal با precision مقید، تاریخ ISO.
- Upload: whitelist mime (png/jpg/webp/pdf/xlsx/csv)، حداکثر 5MB، اسم فایل sanitize، ذخیره خارج از public با سرو از route مجاز.
- Mass-assignment: هر endpoint فیلدهای مجاز صریح را می‌گیرد (never spread body).

## 4. امنیت فایل و QR

- QRهای تولیدی از داده سیستمی (URL ثابت) ساخته می‌شوند — ورودی کاربر در QR تزریق نمی‌شود.
- Import: parse در حافظه با سقف حجم/ردیف (10k)، بدون eval، فرمول‌های Excel اجرا نمی‌شوند (exceljs type-check).
- Content-Disposition: attachment روی exportها؛ نام فایل ASCII + filename*.

## 5. Audit & Traceability

- AuditLog برای: CREATE/UPDATE/DELETE/ASSIGN/RETURN/TRANSFER/MAINTENANCE/STATUS_CHANGE/AUDIT/LOGIN/LOGOUT/EXPORT/IMPORT/BULK — با actor/entity/entityId/oldValue/newValue/ip/userAgent.
- oldValue/newValue: فیلدهای حساس (passwordHash, token) هرگز ثبت نمی‌شوند (redact list).
- جدول append-only از دید اپ (no update/delete API).

## 6. Headers & Transport

- CSP: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none' (Next.js needs unsafe-inline for styled-jsx؟ — بدون styled-jsx، امن است).
- X-Content-Type-Options: nosniff · Referrer-Policy: strict-origin-when-cross-origin · Permissions-Policy: camera=(self) برای صفحه اسکن.
- Prod: TLS termination (reverse proxy / Caddy در compose).

## 7. Error Handling

- شکل خطای واحد (سند 02). هیچ stack trace / پیام انگلیسی raw به client نشت نمی‌کند — `getServerError()` map به کد+پیام فارسی.
- Global `error.tsx` + `global-error.tsx` + not-found فارسی.
- ZodError → 400 با details per-field.
- Prisma known errors (P2002 unique, P2025 not found) → map استاندارد 409/404.
- Promise rejectionهای unhandled در worker/API → log ساختارمند.

## 8. Privacy / Data Retention

- Soft delete همه سوژه‌های اصلی؛ AuditLog نگهداری 2 سال (پاکسازی دوره‌ای cron داخلی، Phase 10).
- رمز عبور قابل بازیابی نیست؛ exportها فقط با `report:export`.

## 9. تست‌های امنیتی (Phase 10 gate)

- 401 بدون cookie روی 20 endpoint نمونه.
- 403 matrix (سند 03) — تست جدولی.
- IDOR: employee → asset دیگری → 404/403.
- Session fixation/hijack: بعد از logout توکن قدیمی → 401.
- Rate limit login → 429 بعد از حد.
- XSS reflect: تزریق `<script>` در فیلدها → ذخیره literal + render ایمن (React) — تست ذخیره و خواندن.
- SQL injection: فیلترهای q در Prisma parameterized — تست payloadهایی مثل `' OR 1=1 --`.
- Upload mime spoof → reject.
- CSRF: POST با Origin خارجی → 403.
