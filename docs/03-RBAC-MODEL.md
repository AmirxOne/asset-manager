# مدل RBAC — ماتریس نقش × دسترسی

نسخه: 1. همه نقش‌ها seed می‌شوند. `isSuperAdmin` روی User = دسترسی همه‌چیز (bypass).

## نقش‌ها (7)

| کلید | نام فارسی | مأموریت |
|---|---|---|
| `super_admin` | مدیر کل سامانه | همه دسترسی‌ها |
| `asset_manager` | مدیر دارایی | چرخه عمر دارایی، انبار، ممیزی، گزارش |
| `it_manager` | مدیر IT | دارایی‌های IT + تأیید درخواست سطح IT |
| `it_staff` | کارشناس IT | عملیات روزمره دارایی، تعمیر، اسکن |
| `warehouse_manager` | مدیر انبار | انبار، ورود/خروج، ممیزی، برچسب |
| `dept_manager` | مدیر بخش | تأیید درخواست‌های بخش + گزارش بخش |
| `employee` | کارمند | درخواست دارایی، دیدن دارایی‌های خود |

## Permission keys (granular, `domain:action`)

```
asset:view asset:create asset:update asset:retire asset:dispose asset:import asset:bulk
asset:assign asset:return asset:transfer asset:retire
category:manage asset-type:manage settings:manage
employee:manage department:manage location:manage supplier:manage
warehouse:manage maintenance:view maintenance:manage
request:create request:view request:viewAll request:viewOwn
request:approve:manager request:approve:it request:fulfill
audit:view audit:manage audit:scan
dashboard:view report:view report:export
audit-log:view user:manage role:manage
```

## ماتریس (✓ = دارد)

| Permission | super_admin | asset_manager | it_manager | it_staff | warehouse_manager | dept_manager | employee |
|---|---|---|---|---|---|---|---|
| asset:view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — (فقط my-assets) |
| asset:create | ✓ | ✓ | ✓ | ✓ | — | — | — |
| asset:update | ✓ | ✓ | ✓ | ✓ | — | — | — |
| asset:retire | ✓ | ✓ | ✓ | — | — | — | — |
| asset:dispose | ✓ | ✓ | — | — | — | — | — |
| asset:assign | ✓ | ✓ | ✓ | ✓ | — | — | — |
| asset:return | ✓ | ✓ | ✓ | ✓ | — | — | — |
| asset:bulk | ✓ | ✓ | ✓ | — | ✓ (فقط QR/print) | — | — |
| asset:import | ✓ | ✓ | — | — | — | — | — |
| category:manage | ✓ | ✓ | ✓ | — | — | — | — |
| employee:manage | ✓ | ✓ | — | — | — | — | — |
| department:manage | ✓ | ✓ | — | — | — | — | — |
| location:manage | ✓ | ✓ | — | — | ✓ | — | — |
| warehouse:manage | ✓ | ✓ | — | — | ✓ | — | — |
| maintenance:view | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| maintenance:manage | ✓ | ✓ | ✓ | ✓ | — | — | — |
| supplier:manage | ✓ | ✓ | — | — | — | — | — |
| request:create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| request:viewAll | ✓ | ✓ | ✓ | — | — | ✓ (بخش خود) | — |
| request:approve:manager | ✓ | — | — | — | — | ✓ | — |
| request:approve:it | ✓ | ✓ | ✓ | — | — | — | — |
| request:fulfill | ✓ | ✓ | ✓ | ✓ | — | — | — |
| audit:view | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| audit:manage | ✓ | ✓ | — | — | ✓ | — | — |
| audit:log:view | ✓ | — | — | — | — | — |
| audit-log:view | ✓ | ✓ | — | — | — | — |
| dashboard:view | ✓ | ✓ | دسکتاپ IT | ✓ | ✓ | ✓ | — |
| report:view | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| report:export | ✓ | ✓ | ✓ | — | ✓ | — | — |
| user:manage · role:manage | ✓ | — | — | — | -| — | — |
| settings:manage | ✓ | — | — | — | — | — | — |
```

## قواعد پیاده‌سازی

1. **Session payload** شامل `roles[]` و `permissions: Set<string>` مسطح — `can(perm)` روی client (nav) و server (guard) یکسان.
2. **Server guard:** `requirePerm("asset:assign")` → 401/403 پاسخ می‌دهد؛ هر API route از آن استفاده می‌كند. تست Integration برای هر endpointِ دارای permission → کاربر بدون نقش = 403.
3. **Data scoping:** `dept_manager` درخواست‌های فقط بخش خودش را می‌بیند (فیلتر سرویس‌لایر، نه فقط UI). `employee` فقط دارایی‌های Assignment خودش (`my-assets`).
4. **UI:** nav items با `perm` فیلتر می‌شوند (مطابق الگوی nav.ts در meetinghub)؛ دکمه‌های action با `can()` مخفی/غیرفعال. اما حذف UI ≠ امنیت — guard سرور مبناست.
5. **Seed users:** برای هر نقش یک کاربر تستی + کاربر اصلی `admin` (رمز در seed، تغییر اجباری اولین ورود).
6. users/roles/audit-logs: فقط super_admin.
7. **تست‌های RBAC:** جدول-driven test — برای هر (role × critical-endpoint) انتظار 200/403. بخشی از Integration Tests هر فاز.

## Permission Model UI (Phase 10, admin)

- صفحه `/admin/roles`: ماتریس نقش‌ها؛ برای هر نقش checkbox-tree دسترسی‌ها؛ تغییر → `PATCH /api/admin/roles/{id}/permissions`.
- فقط `role:manage` (super_admin) می‌تواند ویرایش کند؛ نقش‌های `isSystem` کلیدشان قفل است ولی permissions قابل تنظیم.
