# UX Structure & Design System — AMS

نسخه: 1.0 — Phase 0
**منبع حقیقت: `D:\meetinghub` — ظاهر AMS عیناً مطابق آن.**

این سند تفاوت‌ها را از دیزاین‌سیستم مرجع استخراج و قفل می‌کند. هر کامپوننتی که در این سند «port وفادار» است، بدون تغییر بصری از meetinghub آورده می‌شود (کپی فایل + importهای آن).

## 1. توکن‌های پایه (tailwind.config.ts — عیناً)

```ts
colors: {
  ink:    { DEFAULT: "#0d0d0d", soft: "#6e6e80", faint: "#9b9ba7" },
  paper:  { DEFAULT: "#ffffff", soft: "#f7f7f8", deep: "#ececf1" },
  line:   "#e5e5e8",
  danger: "#ef4056",
  success: "#059669",
}
fontFamily: { sans: ["alibaba", "Tahoma", "Segoe UI", "sans-serif"] }
```

- **تم: ChatGPT-mono روشن.** پس‌زمینه سفید، متن `ink`، بدون رنگ سازمانی دومینانت. رنگ فقط در badgeهای معنایی (emerald/red/amber/blue) و danger.
- فونت: **Alibaba** (woff2 از public/fonts مرجع کپی می‌شود) — Regular/Medium/Bold/Black با font-display: swap.
- `body { font-size: 14px; color:#0d0d0d; background:#fff }` · `::selection` مشکی‌معکوس · scrollbar باریک (`#d4d4d8`).
- direction: **rtl** روی `<html dir="rtl" lang="fa">`.

## 2. پریمیتیوها (port وفادار از src/components/ui meetinghub)

| کامپوننت | مشخصات قفل‌شده |
|---|---|
| **Select** | دکمه h-11 (sm: h-9) rounded-md، border `#d9d9e0` → hover `ink/50` → open: `border-ink` + ring `0 0 0 3px rgba(13,13,13,.08)`؛ چرخونده ChevronDown (rotate-180)؛ پنل: `rounded-md border-line bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)]` max-h-64، آیتم hover/active `bg-paper-soft`، انتخاب‌شده bold + Check؛ hint sub-label؛ کیبورد کامل ↑↓/Enter/Esc/Tab؛ خالی: «موردی نیست»؛ placeholder «انتخاب کنید…». **بدون native select — مطلق.** |
| **Button** | variants: primary(bg-ink→hover #2a2a2e), secondary(paper-soft→deep), ghost, danger(red-600), outline(border-line). sizes: sm h-8/12px, md h-10/13px, lg h-11/14px, icon h-9w-9. rounded-md, focus ring ink/30, loading spinner. |
| **Card** | `rounded-md border-line bg-white`؛ CardHeader: `px-5 py-4 border-b` + title 14px bold؛ CardBody `p-5` |
| **StatCard** | label 12px ink-soft، value 24px bold (tone: success emerald-600 / danger red-600 / warn amber-600)، hint 11px faint |
| **Modal** | دسکتاپ centered (max-w-lg، wide: 2xl)، موبایل bottom-sheet با drag-to-dismiss؛ backdrop black/45؛ header 14px bold + X؛ footer با safe-area |
| **FilterBar** | کانتینر `border-line bg-paper-soft/40 px-4 py-3 rounded-md` + آیکن SlidersHorizontal + «فیلترها» + badge «N فعال» (bg-ink) + «پاک کردن همه»؛ dropdownها h-9 با شمارنده count badge |
| **Badge** | `rounded-full px-2.5 py-0.5 text-[11px] font-medium` — خاکستری/سبز/قرمز/کهربایی/آبی/مشکی |
| **JalaliDatePicker** | zero-dep port از meetinghub (src/components/ui/jalali-date-picker.tsx) |
| **FaInput (fa-input.tsx)** | input فارسی‌ارقام |
| **Toast, Tooltip, UserAvatar, PeoplePicker, Icon** | port مستقیم — Icon از `iconsax-glyphs` (inline SVG glyphs) |

## 3. AppShell (ساختار صفحه — port با تغییر محتوا)

- **سایدبار راست** `w-60 fixed` (bg-paper-soft, border-l) + `lg:pr-60` روی بدنه — RTL مثل مرجع.
- سربرگ سایدبار: لوگو/برند + عنوان سامانه («مدیریت دارایی» جای «مدیریت جلسات») + subtitle.
- nav گروه‌بندی‌شده: `اصلی / سازمان / سامانه` — آیتم active: `bg-white shadow` + آیکن‌باکس `bg-ink text-white`؛ گروه‌ها label 10px faint.
- دکمه CTA پایین سایدبار: **«ثبت دارایی جدید»** (bg-ink full-width h-10 rounded-lg).
- **Header** h-16 sticky (bg-white/95 backdrop-blur, border-b): GlobalSearch (max-w-xl, bg-paper-soft h-10 rounded-md)، منوی کاربر (avatar + name + role + ChevronDown → پروفایل/خروج).
- **موبایل:** drawer (w-72) + **bottom nav** h-16 با 4-5 آیتم.
- Page transition: framer-motion (opacity/y 10→0, 0.22s) مطابق مرجع.
- Skeletons: sidebar skeleton + table skeleton + row skeleton (shimmer) — همان کلاس‌های .skeleton.

## 4. ناوبری AMS

```
اصلی:    داشبورد | دارایی‌ها | انبار | ممیزی
سازمان:  کارمندان | بخش‌ها | محل‌ها | تأمین‌کنندگان | درخواست‌ها
سامانه:  تعمیرات | گزارش‌ها | کاربران | نقش‌ها | لاگ ممیزی | تنظیمات
+ My Assets (برای employee) — از دید همه: «دارایی‌های من» زیر اصلی
```

## 5. صفحات کلیدی (ساختار UX)

### داشبورد
ردیف StatCardها (کل دارایی، در استفاده، موجود، در تعمیر، گم‌شده، بازنشسته، ارزش کل، گارانتی در حال انقضا) → دو ستون: «فعالیت اخیر» (timeline از AssetEvent/AuditLog) + «درخواست‌های در انتظار» → «اختصاص‌های اخیر» و «تعمیرات اخیر» جدول‌های compact.

### لیست دارایی‌ها (صفحه قلب)
FilterBar (وضعیت/دسته/نوع/محل/بخش/تأمین‌کننده + جستجو) → DataTable (کد، نام، دسته، وضعیت Badge، condition، نگهدارنده، محل، ارزش؛ انتخاب چندتایی با checkbox → نوار Bulk Actions شناور: تحویل/انتقال/تغییر وضعیت/QR/چاپ/خروجی) → pagination.

### جزئیات دارایی
هدر: کد بزرگ + Badgeها + QR thumbnail → تب‌ها: «مشخصات» (فرم view/edit) · «تاریخچه» (AssetEvent timeline) · «تحویل‌ها» · «تعمیرات» · «اسناد» · عملیات سریع (Assign/Return/Transfer/Maintenance/Retire) به‌صورت دکمه‌های outline.

### اسکن QR (/scan)
کامرا (getUserMedia + jsQR یا BarcodeDetector) fullscreen تیره، overlay crosshair، تزریق دستی کد برای desktop. نتیجه اسکن → toast + navigate.

### ممیزی (/audits)
لیست جلسات → جزئیات جلسه: شمارنده‌های بزرگ (expected/scanned/missing/unexpected/mismatch) + دکمه شروع اسکن → نمای اسکنر + لیست live نتایج → بستن جلسه با گزارش.

### Import
wizard سه‌مرحله‌ای: آپلود → preview جدولی (ردیف‌های error قرمز/ duplicated کهربایی) → نتیجه درج.

## 6. قواعد UI سراسری

- اعداد فارسی (faNum) همه‌جا؛ کدهای Asset لاتین LTR داخل `<bdi dir="ltr">`.
- قیمت: جداکننده هزارگان فارسی + «ریال» ( یا currency فیلد).
- Status → رنگ Badge: IN_STOCK/AVAILABLE→green, ASSIGNED/IN_USE→blue, MAINTENANCE→amber, LOST→red, RETIRED→gray, DISPOSED→gray-black. Condition: EXCELLENT→green, GOOD→blue, FAIR→amber, DAMAGED/BROKEN→red.
- Empty states همیشه با آیکن + توضیح + دکمه action.
- فرم‌ها: label بالای فیلد، ارور 12px red-600 زیر فیلد، دکمه‌ها راست (RTL: پایان فرم).
- Responsive: sidebar از lg، جداول → کارت‌های ردیفی در <md، touch targets ≥44px.
- تِم تاریک: **نداریم** (مطابق مرجع).
