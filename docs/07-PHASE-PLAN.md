# نقشه فازها و Definition of Done — AMS

نسخه: 1.0 · هر فاز فقط با PASS کامل فاز قبل شروع می‌شود.

| فاز | عنوان | تحویل‌دادنی | تست‌های E2E فاز |
|---|---|---|---|
| 0 | معماری و طراحی | docs/00..06 + repo init | — |
| 1 | Auth & RBAC | login/logout/me/password، User/Role/Permission/Session، seed نقش‌ها، AppShell + nav + login page | login موفق/ناموفق، redirect، منو بر اساس نقش |
| 2 | Asset Core | Categories(tree)، AssetTypes، Asset CRUD + فیلترها، Code Generator اتمیک، AssetEvent، صفحه لیست/جزئیات/فرم | ساخت category→type→asset با کد خودکار، invalid transition، unique serial |
| 3 | Org & Assignment | Employees، Departments(tree)، Locations(tree)، Assign/Return/Transfer + history، my-assets | چرخه تحویل→انتقال→عودت با تاریخچه |
| 4 | Warehouse | summary API، stock-in/out، Bulk Operations (edit/assign/transfer/status/QR/print/export) | bulk assign 3 دارایی، خروج انبار، summary درست |
| 5 | QR/Barcode | QR svg/png، Code128، bulk zip، print labels A4، /a/{code} redirect، صفحه /scan کامرا | generate→download→print view→scan→redirect به دارایی |
| 6 | Maintenance & Suppliers | MaintenanceRecord + parts + attachments، complete→return to stock، Suppliers + purchase history، warranty expiring | تعمیر کامل: open→in-progress→done→available |
| 7 | Requests & Workflow | درخواست کارمند، تأیید مدیر بخش→IT، fulfill→assign، notifications درون‌برنامه‌ای | درخواست→تأیید دومرحله‌ای→fulfill→تحویل خودکار |
| 8 | Audit Sessions | ایجاد جلسه با scope، اسکن (کامرا/دستی)، matched/unexpected/missing/mismatch، close + گزارش | audit با 3 دارایی: 2 اسکن، 1 missing، 1 unexpected |
| 9 | Dashboard & Reports | داشبورد KPI + activity، 13 گزارش + فیلتر، export CSV/XLSX/PDF | dashboard اعداد درست، 2 گزارش export |
| 10 | Hardening | Audit Log UI، Admin users/roles، settings، rate-limit، security headers، performance (index/N+1)، global search | permission matrix UI، لاگ‌ها، جستجوی سراسری |
| 11 | Final E2E + QA | سناریوی کامل 20+ مرحله‌ای کاربر واقعی، responsive، error scenarios | سناریوی کامل admin + employee + it_staff |

## گزارش فاز (قالب الزامی)

```
Phase:
Implemented:
Files Changed:
Database Changes:
API Changes:
Tests Added:
Tests Passed:
Tests Failed:
Bugs Fixed:
E2E Scenarios:
Remaining Issues:
Status: PASS / FAIL
```

## Definition of Done (همه فازها)

1. `pnpm typecheck` صفر خطا
2. `pnpm lint` صفر error
3. `pnpm build` موفق
4. `pnpm test` (unit+integration+component) همه PASS
5. `pnpm test:e2e` فاز PASS
6. بدون TODO بحرانی
7. بدون mock در مسیر واقعی (unit فقط برای edgeهای خالص)
8. Error handling + Authorization تست‌شده
9. بازبینی UI از دید کاربر واقعی (اسکرین‌شات)
