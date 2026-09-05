# استراتژی تست — AMS

نسخه: 1.0 — Phase 0

## هرم تست

```
        ┌─────────┐
        │   E2E   │  Playwright — جریان کاربر واقعی (هر فاز + Final QA)
        ├─────────┤
        │Component│  RTL + jsdom — فرم‌ها، Select، جدول‌ها، Badgeهای وضعیت
        ├─────────┤
        │Integration│ Vitest + DB واقعی — API routes، تراکنش‌ها، permissions
        ├─────────┤
        │  Unit   │  Vitest — منطق خالص: code-gen، state machine، rbac matrix، fa/jalali
        └─────────┘
```

## ابزار و پیکربندی

- **Vitest** (environment: node برای unit/integration، jsdom برای component — دو project یا دو config include).
- **Integration روی Postgres واقعی**: قبل از هر فایل، truncate جدول‌ها (helper `resetDb()`)؛ schema با `prisma migrate deploy` روی database تست (`assetmanager_test`) اعمال می‌شود — بدون mock دیتابیس.
- **Playwright** با **system Chrome** (channel: "chrome") — مطابق تجربه این ماشین (CDN بلاک است، دانلود مرورگر fail می‌شود). webServer: `pnpm dev -p 3201` (یا build+start) با DATABASE_URL تست.
- **No-skip policy:** هیچ `it.skip`, `xit`, `test.todo` — CI محلی gate است.
- **Fixture data:** factory helperها (`createUser`, `createAsset`, ...) بدون mock — درج واقعی.

## پوشش Critical Logic (الزام سند نیازمندی‌ها)

| حوزه | نوع تست | چه چیزی اثبات می‌شود |
|---|---|---|
| **Asset Code Generation** | Unit + Integration | کد یکتا؛ قالب `AST-{CAT}-{TYPE}-{SEQ}`؛ concurrency (N درخواست موازی → N کد یکتا، بدون gap توخالی)؛ الگوی سفارشی از Settings؛ کد دستی duplicate → 409 |
| **Assignment/Return/Transfer** | Integration | assign از AVAILABLE ok؛ assign دارایی ASSIGNED → 409؛ return → status صحیح + condition ثبت؛ transfer اتمیک (assignment جدید+بسته + رویداد TRANSFER)؛ history کامل |
| **Status Transition** | Unit (ماتریس) | هر گذار مجاز/غیرمجاز؛ گذار غیرمجاز → ASSET_INVALID_TRANSITION 422/409 |
| **Permission** | Integration | جدول role×endpoint (سند 03) — بدون نقش → 403؛ بدون login → 401 |
| **Inventory Count** | Integration | expected محاسبه از scope؛ scan → matched/unexpected/duplicate؛ close → missing/mismatch درست؛ شمارش‌های summary |
| **Audit** | Integration | هر عملیات → AuditLog با before/after صحیح؛ AssetEvent برای هر گذار |
| **QR Mapping** | Unit + E2E | QR محتوا = URL `/a/{code}`؛ GET /a/{code} → 302 به asset detail؛ QR PNG/SVG تولید می‌شود |
| **Import** | Integration | validate → errors/duplicates گزارش؛ commit → درج درست؛ ردیف خراب → کل import اتمیک fail یا row-level report (طراحی: row-level با گزارش) |
| **Bulk Operations** | Integration | bulk status/assign/transfer روی چند asset؛ partial failure → تراکنش rollback یا گزارش per-item (طراحی: per-item گزارش، اتمیک per item) |
| **Reports/Export** | Integration | اعداد گزارش با seed مشخص مطابق انتظار؛ CSV/XLSX تولید و ساختار صحیح |
| **Maintenance** | Integration | open→status=MAINTENANCE؛ complete→status برگشت + cost جمع |
| **Requests workflow** | Integration | PENDING→manager approve→IT approve→fulfill (assign خودکار)؛ reject در هر مرحله؛ cancellation |
| **Login/Session** | Integration | login ok، رمز غلط 401، rate-limit، logout ابطال session، /me |

## Component Tests (jsdom + RTL)

- `<Select>`: باز/بسته، کیبورد، placeholder، disabled — port تست از الگوی meetinghub.
- AssetForm: validation errors، submit payload درست.
- StatusBadge / ConditionBadge: mapping رنگ‌ها (سند 06).
- FilterBar: تغییر گروه → onChange، «پاک کردن همه».
- JalaliDatePicker / FaInput: نمایش فارسی، تبدیل.
- DataTable: sort/pagination UI.
- QRLabel preview.

## E2E (Playwright) — per-phase + Full (Phase 11)

سناریوی کامل (طبق نیازمندی):
1. Login admin → 2. Create Department → 3. Create Employee → 4. Create Category → 5. Create Location/Warehouse → 6. Create Supplier → 7. Create Asset (+code auto) → 8. Generate QR → 9. Print label → 10. Assign → 11. Transfer → 12. Return → 13. Send to Maintenance → 14. Complete Maintenance → 15. Stock-in → 16. Open Audit session → 17. Scan QR (کامرا شبیه‌سازی‌شده با تزریق code) → 18. Close audit → 19. Generate Report → 20. Export CSV/Excel → 21. Permission matrix UI spot-check با کاربر employee → 22. Global search → 23. Responsive (viewport 375) sanity.

**تست از دید کاربر واقعی در هر فاز:** علاوه بر E2E خودکار، هر فاز با مرورگر واقعی (computer-use / Playwright trace) چک می‌شود و اسکرین‌شات‌ها در گزارش فاز می‌آید.

## Definition of Done (هر فاز) — اجرای واقعی

```bash
pnpm typecheck   # tsc --noEmit — صفر خطا
pnpm lint        # next lint — صفر error (warning فقط با توجیه)
pnpm build       # next build — success
pnpm test        # unit + integration + component — همه PASS
pnpm test:e2e    # E2Eهای فاز — همه PASS (system Chrome)
```
هیچ فازی بدون اجرای واقعی این پنج فرمان و دیدن خروجی سبز Complete نمی‌شود.

## گزارش تست هر فاز

```
Phase N:
Tests Added: unit X, integration Y, component Z, e2e W
Tests Passed: X+Y+Z+W / total
Tests Failed: 0 (bugs fixed during phase: ...)
Coverage (critical logic): باقی‌مانده‌ها
```
