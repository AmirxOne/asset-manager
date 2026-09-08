# سامانه مدیریت دارایی (Asset Management System)

سامانه جامع مدیریت اموال و دارایی‌های سازمانی — چرخه عمر کامل دارایی از خرید تا اسقاط.

## قابلیت‌ها

- **دارایی‌ها**: CRUD کامل، کد یکتای خودکار (`AST-IT-LAP-000001`)، وضعیت/وضع ظاهری، ماشین گذار وضعیت، تاریخچه کامل رویدادها
- **تخصیص**: تحویل / عودت / انتقال اتمیک با تاریخچه، دارایی‌های من
- **انبار**: خلاصه موجودی و ارزش، ورود/خروج، عملیات گروهی (تغییر وضعیت/ویرایش/تحویل/چاپ برچسب)
- **QR/بارکد**: QR با محتوای `/a/{code}`، بارکد Code39، چاپ برچسب A4 گروهی، اسکنر (دوربین + دستی)
- **تعمیرات**: چرخه ثبت→در جریان→تکمیل/لغو، قطعات با جمع خودکار هزینه، بازگشت به چرخه
- **تأمین‌کنندگان**: CRUD + تاریخچه خرید، گزارش انقضای گارانتی
- **درخواست‌ها**: گردش دومرحله‌ای (مدیر بخش → IT) با اعمال مرحله، تأمین خودکار، اعلان‌های درون‌برنامه‌ای با زنگ در هدر
- **ممیزی موجودی**: نشست snapshot، اسکن با تشخیص مطابق/مغایر/غیرمنتظره/تکراری، تسویه مفقودی‌ها
- **داشبورد**: ۸ کارت آماری، رویدادهای اخیر، تحویل‌ها، درخواست‌های باز، هشدار تعمیرات
- **گزارش‌ها**: ۱۴ نوع گزارش با فیلتر + خروجی CSV (BOM فارسی) / اکسل / PDF (چاپ)
- **ورود گروهی**: Import از CSV دو مرحله‌ای (اعتبارسنجی + پیش‌نمایش + تشخیص تکراری → ثبت)
- **RBAC**: ۷ نقش × ۳۳+ مجوز گرانیولار، صفحه کاربران و ماتریس نقش‌ها
- **لاگ عملیات**: همه عملیات مهم با بازیگر/قبل/بعد/IP + UI با فیلتر
- **امنیت**: session opaque (HttpOnly)، bcrypt(12)، rate-limit لاگین، same-origin، soft-delete

## استک فناوری

- **Next.js 15** (App Router) + React 19 + TypeScript strict
- **Prisma + PostgreSQL 16**
- **Tailwind 3** — دیزاین دقیقاً مطابق پروژه مرجع (فونت Alibaba، Iconsax، RTL، تاریخ شمسی)
- **TanStack Query + Zod**
- **تست**: Vitest (unit/component/integration) + Playwright E2E (system Chrome)

## اجرا

```bash
pnpm install
cp .env.example .env        # DATABASE_URL را تنظیم کنید
npx prisma migrate deploy
pnpm db:seed
pnpm dev                    # http://localhost:3200
```

### کاربران seed

| نقش | ایمیل | رمز |
|---|---|---|
| ابرمدیر | admin@ams.local | Admin@123 |
| مدیر دارایی | assetmgr@ams.local | Test@1234 |
| مدیر IT | itmgr@ams.local | Test@1234 |
| کارشناس IT | itstaff@ams.local | Test@1234 |
| مدیر انبار | whmgr@ams.local | Test@1234 |
| مدیر بخش | deptmgr@ams.local | Test@1234 |
| کارمند | employee@ams.local | Test@1234 |

صفحه لاگین چیپ‌های ورود سریع برای همه نقش‌ها دارد.

## تست

```bash
pnpm typecheck && pnpm lint && pnpm build
npx vitest run tests/unit --config vitest.config.ts
npx vitest run tests/component --config vitest.component.config.ts
npx vitest run tests/integration --config vitest.integration.config.ts   # نیاز به سرور dev روی DB تست
npx playwright test
```

**۱۹۰+ تست** در ۴ لایه — شامل E2E کامل ۲۰ مرحله‌ای (لاگین → بخش → کارمند → دارایی → کد → QR → برچسب → تحویل → انتقال → عودت → تعمیر → تکمیل → ممیزی → اسکن → گزارش → Export → جستجو).
