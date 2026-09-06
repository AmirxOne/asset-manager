# سامانه مدیریت دارایی (Asset Management System)

سامانه جامع مدیریت اموال و دارایی‌های سازمانی — چرخه عمر کامل دارایی از خرید تا اسقاط.

## استک فناوری

- **Next.js 15** (App Router) + React 19 + TypeScript strict
- **PostgreSQL 16** + Prisma ORM
- **Tailwind CSS 3** — دیزاین‌سیستم ChatGPT-mono با فونت Alibaba (RTL کامل)
- **TanStack Query** + Zustand
- **Vitest** (unit/integration/component) + **Playwright** (E2E)

## امکانات

- ✅ **فاز ۱:** احراز هویت، RBAC (۷ نقش × ۳۳ دسترسی)، Session امن، Rate limiting، Audit log
- ✅ **فاز ۲:** دارایی‌ها — CRUD کامل، تولید کد خودکار (`AST-IT-LAP-000001`)، ماشین گذار وضعیت، تاریخچه رویدادها، فیلترهای ترکیبی
- 🔜 فازهای ۳ تا ۱۱: کارمندان و تحویل، انبار، QR/بارکد، تعمیرات، درخواست‌ها، ممیزی، داشبورد و گزارش‌ها

## راه‌اندازی

```bash
pnpm install
cp .env.example .env   # DATABASE_URL را تنظیم کنید
pnpm db:migrate         # migrations
pnpm db:seed            # نقش‌ها + دسترسی‌ها + دسته‌ها + کاربر اولیه
pnpm dev                # http://localhost:3200
```

**کاربر اولیه:** `admin@ams.local` / `Admin@123`

## تست‌ها

```bash
pnpm test               # unit + component
pnpm test:integration   # روی DB واقعی (assetmanager_test)
pnpm test:e2e           # Playwright با system Chrome
pnpm typecheck && pnpm lint && pnpm build
```

## معماری

مستندات کامل در [`docs/`](./docs): طراحی دیتابیس، قرارداد API، مدل RBAC، استراتژی تست و امنیت، دیزاین‌سیستم.
