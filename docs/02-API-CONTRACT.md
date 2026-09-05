# قرارداد API — AMS (REST)

نسخه: 1.0 — Phase 0 · همه مسیرها زیر `/api` · JSON · Cookie Session

## قواعد عمومی

- **Auth:** Cookie `ams_session` (HttpOnly, SameSite=Lax). مسیرهای بدون `/api/auth/login` و `/api/health` محافظت‌شده‌اند (middleware).
- **Permissions:** هر endpoint یک permission لازم دارد (سند 03). خطای 403 با کد `FORBIDDEN`.
- **خطاها:** شکل واحد:
  ```json
  { "error": { "code": "ASSET_INVALID_TRANSITION", "message": "دارایی در وضعیت Retired قابل تحویل نیست", "details": [...] } }
  ```
  کدهای عمومی: `UNAUTHORIZED(401)`, `FORBIDDEN(403)`, `NOT_FOUND(404)`, `VALIDATION(400)`, `CONFLICT(409)`, `RATE_LIMITED(429)`, `INTERNAL(500)`.
- **Pagination:** `?page=1&pageSize=25&sort=code&order=asc` → پاسخ `{ data: [...], total, page, pageSize }`.
- **مالی/تاریخ:** قیمت Decimal به string؛ تاریخ UTC ISO 8601.
- **Zod schema** هر بدنه، مشترک بین client و server (`src/lib/validations/`).

## Auth — Phase 1
| Method | Path | Permission | شرح |
|---|---|---|---|
| POST | `/api/auth/login` | — | {identifier, password} → set-cookie + user+roles |
| POST | `/api/auth/logout` | — | ابطال session + AuditLog(LOGOUT) |
| GET | `/api/auth/me` | authenticated | پروفایل + roles + permissions (set مسطح برای can()) |
| PATCH | `/api/auth/password` | authenticated | تغییر رمز عبور خود |

## Users / Roles — Phase 1 & 10
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/admin/users` | `user:manage` |
| GET/PATCH/DELETE | `/api/admin/users/{id}` | `user:manage` |
| GET/POST | `/api/admin/roles` | `role:manage` |
| PATCH | `/api/admin/roles/{id}/permissions` | `role:manage` |

## Categories & Types — Phase 2
| Method | Path | Permission |
|---|---|---|
| GET | `/api/categories` (tree) | authenticated |
| POST/PATCH/DELETE | `/api/categories[/{id}]` | `category:manage` |
| GET/POST | `/api/asset-types` | authenticated / `category:manage` |
| PATCH/DELETE | `/api/asset-types/{id}` | `category:manage` |
| GET | `/api/settings/code-pattern` · PUT | `settings:manage` |

## Assets — Phase 2+ (قلب سیستم)
| Method | Path | Permission | شرح |
|---|---|---|---|
| GET | `/api/assets` | `asset:view` | فیلترهای ترکیبی: `status, condition, categoryId, typeId, brand, locationId, departmentId, holderEmployeeId, supplierId, warrantyExpiringBefore, priceMin/Max, q (search), ids` |
| POST | `/api/assets` | `asset:create` | بدنه کامل؛ کد خودکار یا دستی (unique check) |
| GET | `/api/assets/{id}` (یا `?code=`) | `asset:view` | شامل events, assignments, maintenances, documents |
| PATCH | `/api/assets/{id}` | `asset:update` | فیلدهای غیرحساس (diff → AuditLog) |
| POST | `/api/assets/{id}/retire` | `asset:retire` | soft-delete مسیر رسمی |
| POST | `/api/assets/{id}/dispose` | `asset:dispose` | ترمینال |
| POST | `/api/assets/{id}/mark-lost` | `asset:update` | |
| GET | `/api/assets/{id}/qr.svg` · `/qr.png` | `asset:view` | تولید QR (پارامتر size) |
| GET | `/api/assets/{id}/barcode.svg` | `asset:view` | Code128 |
| POST | `/api/assets/bulk` | `asset:bulk` | `{action: UPDATE|ASSIGN|TRANSFER|STATUS|REGENERATE_QR, ids[], patch}` اتمیک |
| GET | `/api/assets/export` | `report:export` | `format=csv|xlsx` + همان فیلترها |
| POST | `/api/assets/import/validate` | `asset:import` | آپلود فایل → validation + preview + duplicates (بدون درج) |
| POST | `/api/assets/import/commit` | `asset:import` | اجرای درج پس از تأیید preview (token-bound) |

## Employees / Departments / Locations — Phase 3
| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/employees[/{id}]` | `employee:manage` (DELETE = soft/status) |
| GET | `/api/employees/{id}/assets` | `asset:view` | همه دارایی‌های تحویل‌شده (فعال + تاریخچه) |
| GET/POST/PATCH/DELETE | `/api/departments[/{id}]` | `department:manage` |
| GET/POST/PATCH/DELETE | `/api/locations[/{id}]` | `location:manage` |

## Assignment — Phase 3
| Method | Path | Permission | شرح |
|---|---|---|---|
| POST | `/api/assets/{id}/assign` | `asset:assign` | {employeeId, note?, dueAt?, expectedCondition} — خطای 409 اگر ASSIGNED فعال باشد |
| POST | `/api/assets/{id}/return` | `asset:return` | {toLocationId?, condition, note?} |
| POST | `/api/assets/{id}/transfer` | `asset:transfer` | {toEmployeeId, note?} = return+assign اتمیک |
| GET | `/api/assignments` | `asset:view` | تاریخچه با فیلتر employee/asset/status |

## Warehouse / Stock — Phase 4
| Method | Path | Permission |
|---|---|---|
| GET | `/api/warehouse/summary` | `asset:view` | شمارش‌ها: total/inStock/assigned/available/maintenance/broken/lost/retired + ارزش |
| GET | `/api/warehouse/locations/{id}/stock` | `asset:view` | موجودی هر محل |
| POST | `/api/warehouse/stock-in` · `/stock-out` | `asset:assign` / `warehouse:manage` | ورود/خروج انبار (روی IN_STOCK⇄AVAILABLE) |

## QR / Labels — Phase 5
| Method | Path | Permission |
|---|---|---|
| POST | `/api/qr/bulk` | `asset:view` | {ids[], format: svg\|png, size} → آرشیو zip |
| GET | `/api/labels/print?ids=` | `asset:view` | HTML print-ready (A4 grid برچسب) |
| GET | `/a/{code}` (صفحه، نه API) | authenticated | ریدایرکت به `/assets/{id}` |

## Maintenance / Suppliers — Phase 6
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/maintenances` | `maintenance:view` / `maintenance:manage` | فیلتر asset/status/technician/dateRange |
| PATCH | `/api/maintenances/{id}` | `maintenance:manage` | آپدیت + افزودن قطعات |
| POST | `/api/maintenances/{id}/complete` | `maintenance:manage` | {endDate, cost, returnTo: AVAILABLE\|IN_STOCK, condition} |
| GET/POST/PATCH/DELETE | `/api/suppliers[/{id}]` | `supplier:manage` |
| GET | `/api/suppliers/{id}/purchases` | `supplier:manage` | تاریخچه خرید (assets by supplier) |
| GET | `/api/warranties/expiring?withinDays=90` | `asset:view` | |

## Requests — Phase 7
| Method | Path | Permission | شرح |
|---|---|---|---|
| GET/POST | `/api/requests` | `request:viewOwn` / `request:create` | کارمند درخواست می‌زند |
| POST | `/api/requests/{id}/approve` | `request:approve:manager` یا `request:approve:it` | {decision, note} — level از stage می‌آید |
| POST | `/api/requests/{id}/fulfill` | `request:fulfill` | {items:[{assetId}]} → assign خودکار |
| POST | `/api/requests/{id}/cancel` | صاحب درخواست | |
| GET | `/api/notifications` · POST `/read` | authenticated | شمارش unread + لیست |

## Audit Sessions — Phase 8
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/audits` | `audit:view` / `audit:manage` | ایجاد جلسه با scope → expected محاسبه و قفل می‌شود |
| POST | `/api/audits/{id}/scan` | `audit:scan` | {code} → MATCHED/UNEXPECTED/INVALID/DUPLICATE + mismatch location |
| GET | `/api/audits/{id}/results` | `audit:view` | matched/unexpected/missing/mismatch lists |
| POST | `/api/audits/{id}/close` | `audit:manage` | بستن + ثبت AssetEvent(AUDIT) برای هر asset اسکن‌شده |

## Dashboard / Reports — Phase 9
| Method | Path | Permission |
|---|---|---|
| GET | `/api/dashboard/summary` | `dashboard:view` | همه KPIها + recent activity/assignments/repairs/requests |
| GET | `/api/reports/{report}` | `report:view` | report ∈ `by-category, by-department, by-employee, by-location, by-status, by-condition, by-supplier, maintenance-cost, lost, retired, warranty-expiration, asset-value, audit, employee-assets` |
| GET | `/api/reports/{report}/export` | `report:export` | `format=csv\|xlsx\|pdf` + فیلترها |
| GET | `/api/search?q=` | authenticated | asset/employee/supplier/location/department |

## System — Phase 10
| Method | Path | Permission |
|---|---|---|
| GET | `/api/admin/audit-logs?entity=&actorId=&action=&from=&to=` | `audit-log:view` |
| GET | `/api/health` | — | liveness (بدون auth) |

## قراردادهای کلیدی (نمونه)

**POST /api/assets/{id}/assign 200:**
```json
{ "assignment": { "id": "...", "assetId": "...", "employeeId": "...", "status": "ACTIVE" },
  "asset": { "id": "...", "code": "AST-IT-LAP-000003", "status": "ASSIGNED" },
  "event": { "id": "...", "type": "ASSIGNED" } }
```
**409:**
```json
{ "error": { "code": "ASSET_ALREADY_ASSIGNED", "message": "این دارایی به کارمند دیگری تحویل شده است" } }
```
