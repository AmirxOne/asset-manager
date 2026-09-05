# معماری سامانه — Asset Management System (AMS)

نسخه: 1.0 — Phase 0
تاریخ: 1405/06/14

## 1. نمای کلی

سامانه مدیریت اموال و دارایی سازمانی (Enterprise Asset Management) برای پیگیری چرخه عمر کامل دارایی‌های فیزیکی و IT: خرید، ورود به انبار، تحویل به کارمند، انتقال، تعمیر، ممیزی، افتضا و بازنشسته‌سازی.

## 2. تصمیم‌های معماری (ADR)

### ADR-001 — هم‌راستایی کامل با استک MeetingHub
ریپوی مرجع `D:\meetinghub` بررسی شد. تصمیم: **همان استک** برای پروژه جدید، چون تیم با آن آشناست، تست‌شده است و دیزاین‌سیستم آن باید عیناً عین این پروژه باشد (خواسته صریح محصول):

| لایه | انتخاب | دلیل |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | API Routes + SSR در یک进程، الگوی اثبات‌شده در meetinghub |
| زبان | TypeScript strict | type-safety سرتاسری |
| DB | PostgreSQL 16 + Prisma ORM | مطابق meetinghub؛ instance موجود Docker (`meetinghub-postgres-1`) با database جدا |
| Auth | Session cookie (opaque token, هش‌شده در DB) + bcryptjs | مطابق meetinghub؛ بدون وابستگی خارجی |
| State/Server | TanStack Query v5 + Zustand | مطابق meetinghub |
| UI | Tailwind 3 + framer-motion + Iconsax | مطابق دیزاین‌سیستم meetinghub (سند 06) |
| اعتبارسنجی | Zod (اشتراک client/server) | مطابق meetinghub |
| تست | Vitest (unit/integration/component) + Playwright (E2E) | مطابق meetinghub + الزام Component Test |
| Export | exceljs (XLSX/CSV) + PDF از طریق همان | meetinghub همین را دارد |
| QR/Barcode | `qrcode` (رانر PNG/SVG) + Code128 سفارشی | بدون سرویس خارجی |

### ADR-002 — Monolith Modular (نه Microservice)
یک اپ Next.js واحد با ماژول‌های جدا در `src/server/modules/*` (asset, employee, assignment, maintenance, request, audit, report...). دلیلت: هزینه عملیاتی صفر، پیچیدگی استقرار کم، تناسب با اندازه سازمان. مرزهای ماژول از روز اول نگه داشته می‌شوند تا در صورت رشد، جداسازی ممکن باشد.

### ADR-003 — جدا بودن Employee از User
`Employee` موجودیت سازمانی (گیرنده دارایی) است؛ `User` حساب ورود به سیستم است. هر User اختیاری به یک Employee وصل می‌شود (`User.employeeId`). دارایی به Employee تحویل داده می‌شود نه به User — چون همه کارمندان حساب ندارند و دارایی باید به «شخص حقیقی سازمانی» تعلق گیرد.

### ADR-004 — دو محور مستقل: Status و Lifecycle Stage
- **Status** (وضعیت جاری قابل فیلتر): `IN_STOCK | AVAILABLE | ASSIGNED | IN_USE | MAINTENANCE | LOST | RETIRED | DISPOSED`
- **Lifecycle Stage** (ایستگاه چرخه عمر در تاریخچه): `PURCHASED | RECEIVED | IN_STOCK | ASSIGNED | IN_USE | MAINTENANCE | REPAIRED | AVAILABLE | TRANSFERRED | RETURNED | LOST | RETIRED | DISPOSED`
- **Condition** (کیفیت فیزیکی، مستقل از هر دو): `EXCELLENT | GOOD | FAIR | DAMAGED | BROKEN`
- جدول `AssetEvent` هر گذار lifecycle را با before/after ثبت می‌کند. هیچ mutation مهمی بدون رویداد تاریخچه انجام نمی‌شود (در سرویس‌لایه enforce می‌شود و تست می‌شود).

### ADR-005 — تولید Asset Code اتمیک
الگوی پیش‌فرض: `AST-{CAT}-{TYPE}-{SEQ:6}` مثل `AST-IT-MOU-000001`.
- شمارنده در جدول `CodeSequence` با `SELECT ... FOR UPDATE` داخل تراکنش (یا upsert increment) → هیچ دو asset کد تکراری نمی‌گیرند حتی با concurrency.
- الگو در `Settings` قابل تنظیم است (جداکننده، padding، پیشوند، شامل سال باشد یا نه).
- `{CAT}` از Category (IT/NET/FUR/GEN...) و `{TYPE}` از AssetType (MOU/MON/LAP/SRV...) می‌آید.

### ADR-006 — Soft Delete برای دارایی
حذف فیزیکی Asset ممنوع. مسیر حذف = `RETIRED` (با تاریخچه) و در صورت نیاز نهایی `DISPOSED`. فیلد `deletedAt` فقط برای.Entity های مدیریتی (Category و ...) به‌کار می‌رود. اطلاعات تاریخی هرگز از بین نمی‌رود.

### ADR-007 — QR محتوای URL دارد
محتوای QR = URL مطلق `/a/{assetCode}` (مثل `https://ams.example.com/a/AST-IT-LAP-000003`). اسکن با هر دوربین → ریدایرکت به صفحه Asset. مزیت: بدون نیاز به اپلیکیشن اختصاصی و decode مقاوم. Barcode = Code128 از همان asset code.

### ADR-008 — Audit Log سراسری + AssetEvent دامنه‌ای
- `AuditLog` (سراسری، مطابق meetinghub): actor/action/entity/entityId/oldValue/newValue/ip/userAgent/timestamp — برای همه عملیات حساس شامل LOGIN/LOGOUT.
- `AssetEvent` (دامنه Asset): رویدادهای چرخه عمر با متادیتای اختصاصی (fromEmployee/toEmployee/cost/...).
این دو مکمل‌اند؛ گزارش «تاریخچه دارایی» از AssetEvent و گزارش «فعالیت کاربران» از AuditLog ساخته می‌شود.

### ADR-009 — اعداد و تاریخ فارسی
همه اعداد نمایشی با `faNum` فارسی‌سازی می‌شوند (lib/fa.ts مطابق meetinghub). تاریخ‌ها Jalali با `date-fns-jalali` + کامپوننت zero-dep `JalaliDatePicker` (port از meetinghub). ذخیره‌سازی: UTC ISO.

### ADR-010 — ناوبری و پورت
پورت **3200** (meetinghub روی 3100 است). Database جدا (`assetmanager`) روی همان Postgres 16 موجود. Docker-compose مستقل برای استقرار production.

## 3. ساختار ریپو

```
asset-manager/
├── docs/                    # مستندات Phase 0 (این پوشه)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts              # roles, permissions, admin, categories پیش‌فرض
├── src/
│   ├── app/
│   │   ├── (app)/           # پوسته احراز هویت‌شده (layout با AppShell)
│   │   │   ├── dashboard/   # Phase 9
│   │   │   ├── assets/      # لیست/جزئیات/ویرایش/QR
│   │   │   ├── employees/
│   │   │   ├── departments/
│   │   │   ├── locations/
│   │   │   ├── suppliers/
│   │   │   ├── maintenance/
│   │   │   ├── requests/
│   │   │   ├── audits/      # جلسات ممیزی + اسکنر
│   │   │   ├── reports/
│   │   │   ├── imports/     # ایمپورت Excel/CSV
│   │   │   ├── admin/       # users, roles, audit-logs, settings
│   │   │   └── my-assets/   # نمای کارمند عادی
│   │   ├── api/             # REST (سند 02)
│   │   ├── login/
│   │   ├── a/[code]/        # ریدایرکت QR → /assets/{id}
│   │   └── scan/            # صفحه اسکنر QR (کامرا)
│   ├── components/
│   │   ├── ui/              # کیت UI — port وفادار از meetinghub (سند 06)
│   │   ├── layout/          # AppShell, OrgBrandMark
│   │   └── features/        # کامپوننت‌های دامنه (asset/, audit/, ...)
│   ├── lib/                 # fa.ts, icons.tsx→iconsax-glyphs, api.ts, jalali.ts, validations...
│   ├── server/
│   │   ├── auth/            # session, rbac, guards
│   │   ├── modules/         # منطق دامنه (asset, code-gen, assignment, ...)
│   │   └── audit/           # audit-log helper
│   └── middleware.ts        # مسیربندی auth/permission
├── tests/
│   ├── unit/                # منطق خالص (code-gen, transitions, rbac matrix...)
│   ├── integration/         # API + DB واقعی
│   └── component/           # React Testing Library (jsdom)
├── e2e/                     # Playwright (system Chrome)
├── docker-compose.yml
└── Dockerfile
```

## 4. جریان‌های داده اصلی

1. **تحویل (Assign):** `POST /api/assets/{id}/assign` → تراکنش: بررسی status مجاز → ایجاد `Assignment(active)` → آپدیت `Asset.assignedEmployeeId/status=ASSIGNED` → ثبت `AssetEvent(ASSIGNED)` → `AuditLog(ASSIGN)` → Notification به کارمند.
2. **عودت (Return):** بستن Assignment + ثبت condition هنگام عودت → status=AVAILABLE (یا IN_STOCK اگر به انبار برگشت) → رویدادها.
3. **انتقال (Transfer):** بستن Assignment قبلی + ایجاد Assignment جدید در یک تراکنش → رویداد TRANSFER با from/to.
4. **تعمیر:** ایجاد `MaintenanceRecord(open)` → status=MAINTENANCE → ثبت پایان → status=AVAILABLE/IN_STOCK + رویداد REPAIRED + هزینه.
5. **ممیزی:** ایجاد `AuditSession(open, scope)` → اسکن‌ها (`AuditScan`: matched/unexpected) → بستن جلسه → محاسبه missing و mismatch (expected در scope ولی اسکن‌نشده / دارایی اسکن‌شده با location ناهماهنگ).

## 5. استقرار (DevOps)

- **Dev:** `pnpm dev` پورت 3200، Postgres موجود Docker، `prisma migrate dev`.
- **Prod:** Docker multi-stage (`output: "standalone"`)، docker-compose شامل postgres+app، `prisma migrate deploy` در entrypoint.
- **Quality gates (هر فاز):** `pnpm typecheck && pnpm lint && pnpm build && pnpm test` — همه باید سبز باشند قبل از اعلان Complete.
