# طراحی پایگاه داده — AMS

نسخه: 1.0 — Phase 0 · PostgreSQL 16 + Prisma

## نمودار روابط (خلاصه)

```
Role ─┬─ RolePermission ─ Permission      Organization ─ (کلی، تک-سازمانه v1)
      └─ UserRole ─ User ─ Session
                User.employeeId? ──► Employee ── Department (tree) ── manager(Employee)
                                      Employee.managerId? (self)
Supplier ──< Asset >── AssetType >── AssetCategory (tree)
   │           │
   │           ├──< AssetDocument (images/attachments)
   │           ├──< AssetEvent (lifecycle history)
   │           ├──< Assignment >── Employee (holder)
   │           ├──< MaintenanceRecord >──< MaintenancePart
   │           ├──< AuditScan >── AuditSession
   │           └──< AssetRequestItem (fulfillment)
AssetRequest ─┬─ Employee (requester)   ─┬─ AssetType (requested)
              └─< RequestApproval ─ User (approver)
CodeSequence (atomic per-prefix counter)   Settings (key-value)
Notification ─ User                        AuditLog (global)
```

## جداول اصلی

### Identity & RBAC (Phase 1)
| جدول | فیلدهای کل | نکات |
|---|---|---|
| `User` | id, email Unique, phone?, fullName, passwordHash, avatarUrl?, isActive, isSuperAdmin, employeeId?, createdAt/updatedAt | مطابق meetinghub |
| `Role` | id, key Unique, name, description?, isSystem | seed: 7 نقش سند 03 |
| `Permission` | id, key Unique, name, group | seed: ماتریس سند 03 |
| `RolePermission` / `UserRole` | join با Cascade | composite PK |
| `Session` | id, token Unique(hash), userId, expiresAt, ip?, userAgent?, lastSeenAt | index روی expiresAt |

### Org (Phase 3)
| جدول | فیلدهای کل |
|---|---|
| `Department` | id, name Unique, code?, parentId? (tree), managerId?→Employee, description?, isActive |
| `Employee` | id, fullName, personnelCode **Unique**, departmentId?, position?, managerId?(self), email?, phone?, status: ACTIVE/SUSPENDED/TERMINATED, hireDate?, notes?, userId? ↔ User |
| `Location` | id, name, code Unique, type: BUILDING/FLOOR/ROOM/WAREHOUSE/BRANCH, parentId? (tree), address?, isActive |

### Asset core (Phase 2)
| جدول | فیلدهای کل |
|---|---|
| `AssetCategory` | id, name, code (مثل IT/NET/FUR) Unique, parentId?, icon?, defaultWarrantyMonths?, isActive |
| `AssetType` | id, name, code (MOU/MON/LAP/SRV) Unique, categoryId, specTemplate?(Json), isActive |
| `Asset` | id, code **Unique**, name, assetTypeId, brand?, model?, serialNumber? **Unique(nullable)**, purchaseDate?, purchasePrice?(Decimal), currency?, supplierId?, warrantyStart?, warrantyEnd?, locationId?, departmentId?, holderEmployeeId?(denorm), status(enum), condition(enum), lifecycleStage(enum), notes?, qrGeneratedAt?, isDeleted=false, retiredAt?, disposedAt?, createdById, createdAt/updatedAt |
| `AssetDocument` | id, assetId, kind: IMAGE/ATTACHMENT/RECEIPT/WARRANTY, fileName, mimeType, sizeBytes, url(path), uploadedById, createdAt |
| `AssetEvent` | id, assetId, type(enum lifecycle + CREATED/UPDATED/NOTE/QR_GENERATED/CONDITION_CHANGE/IMPORTED), fromStatus?, toStatus?, fromEmployeeId?, toEmployeeId?, fromLocationId?, toLocationId?, actorId?, metadata Json?, note?, occurredAt |
| `CodeSequence` | key (مثل `AST-IT-MOU`) PK, seq BigInt | increment اتمیک در تراکنش |
| `Settings` | key PK, value Json, updatedById?, updatedAt | الگوی کد، پیش‌فرض‌های گارانتی و... |

### Assignment (Phase 3)
| جدول | فیلدهای کل |
|---|---|
| `Assignment` | id, assetId, employeeId, assignedById, assignedAt, dueAt?, returnedAt?, returnedById?, status: ACTIVE/RETURNED, conditionAtAssign?, conditionAtReturn?, deliveredNote?, returnNote? → هر تحویل/عودت/انتقال = رکورد با History کامل |

### Maintenance & Supplier (Phase 6)
| جدول | فیلدهای کل |
|---|---|
| `Supplier` | id, name Unique, contactName?, phone?, email?, address?, taxId?, notes?, isActive |
| `MaintenanceRecord` | id, assetId, problem, description?, technicianName?, technicianId?(Employee), startDate, endDate?, cost Decimal?, status: OPEN/IN_PROGRESS/DONE/CANCELLED, notes?, createdById |
| `MaintenancePart` | id, maintenanceId, name, quantity Int, unitCost Decimal? |
| (attachments) | MaintenanceDocument یا reuse AssetDocument با polymorphic (assetId + maintenanceId?) — تصمیم: جدول `MaintenanceDocument` جدا برای سادگی کوئری |

### Requests (Phase 7)
| جدول | فیلدهای کل |
|---|---|
| `AssetRequest` | id, code Unique (REQ-1405-0001), requesterEmployeeId, departmentId, assetTypeId?, title/freeText, quantity, reason?, urgency: LOW/NORMAL/HIGH, status: PENDING/MANAGER_APPROVED/REJECTED/IT_APPROVED/FULFILLED/CANCELLED, fulfilledById?, fulfilledAt?, createdAt |
| `RequestApproval` | id, requestId, level: MANAGER/IT, approverId, decision: APPROVED/REJECTED, note?, decidedAt |
| (لینک fulfillment) | `AssetRequestItem`: requestId, assetId — کدام دارایی‌ها تأمین شدند |

### Audit / Inventory Count (Phase 8)
| جدول | فیلدهای کل |
|---|---|
| `AuditSession` | id, code Unique (مثل 2026-001), title?, scopeType: ALL/LOCATION/DEPARTMENT/CATEGORY, scopeId?, expectedCount, scannedCount, matchedCount, unexpectedCount, missingCount, mismatchCount, status: OPEN/CLOSED/CANCELLED, openedById, openedAt, closedAt?, notes? |
| `AuditScan` | id, sessionId, codeScanned, assetId?(nullable → unexpected), result: MATCHED/UNEXPECTED/INVALID/DUPLICATE, expectedLocationId?, scannedLocationId?, scannedById, scannedAt, deviceId? |

### Cross-cutting
| جدول | فیلدهای کل |
|---|---|
| `Notification` | id, userId, type, title, body?, data Json?, readAt?, createdAt |
| `AuditLog` | id, actorId?, action(enum سند 02), entity, entityId, oldValue Json?, newValue Json?, ip?, userAgent?, createdAt + indexهای (entity,entityId) و (actorId, createdAt) |

## Enumها (Prisma enums)

```
AssetStatus:      IN_STOCK | AVAILABLE | ASSIGNED | IN_USE | MAINTENANCE | LOST | RETIRED | DISPOSED
LifecycleStage:   PURCHASED | RECEIVED | IN_STOCK | ASSIGNED | IN_USE | MAINTENANCE | REPAIRED | AVAILABLE | TRANSFERRED | RETURNED | LOST | RETIRED | DISPOSED
AssetCondition:   EXCELLENT | GOOD | FAIR | DAMAGED | BROKEN
EmployeeStatus:   ACTIVE | SUSPENDED | TERMINATED
LocationType:     BUILDING | FLOOR | ROOM | WAREHOUSE | BRANCH
AssignmentStatus: ACTIVE | RETURNED
MaintenanceStatus: OPEN | IN_PROGRESS | DONE | CANCELLED
RequestStatus:    PENDING | MANAGER_APPROVED | IT_APPROVED | FULFILLED | REJECTED | CANCELLED
ApprovalLevel:    MANAGER | IT
ApprovalDecision: APPROVED | REJECTED
Urgency:          LOW | NORMAL | HIGH
AuditScopeType:   ALL | LOCATION | DEPARTMENT | CATEGORY
ScanResult:       MATCHED | UNEXPECTED | INVALID | DUPLICATE
AuditAction:      CREATE | UPDATE | DELETE | ASSIGN | RETURN | TRANSFER | MAINTENANCE | STATUS_CHANGE | AUDIT | LOGIN | LOGOUT | EXPORT | IMPORT | BULK
```

## ماشین حالت Status (قوانین گذار — Unit Tested)

```
IN_STOCK   → AVAILABLE, ASSIGNED(خروج مستقیم از انبار), MAINTENANCE, LOST, RETIRED
AVAILABLE  → ASSIGNED, IN_STOCK, MAINTENANCE, LOST, RETIRED
ASSIGNED   → IN_USE, RETURNED→(AVAILABLE|IN_STOCK), MAINTENANCE, LOST, TRANSFER(→ASSIGNED)
IN_USE     → AVAILABLE(عودت), IN_STOCK, MAINTENANCE, LOST, RETIRED
MAINTENANCE→ AVAILABLE, IN_STOCK, RETIRED, MAINTENANCE(ادامه)
LOST       → RETIRED (بستن پرونده), IN_STOCK/AVAILABLE(پیدا شد)
RETIRED    → DISPOSED (نهایی)
DISPOSED   → (ترمینال)
```
- هر گذار خارج از این ماتریس در سرویس‌لایه **reject** می‌شود (`ASSET_INVALID_TRANSITION`).
- گذار مجاز همیشه AssetEvent + AuditLog تولید می‌کند (تراکنش اتمیک).

## Indexهای حیاتی

- `Asset(code)` Unique · `Asset(serialNumber)` Unique-nulls-distinct · `Asset(status, assetTypeId)` · `Asset(holderEmployeeId)` · `Asset(locationId)` · `Asset(warrantyEnd)` (گزارش انقضا) · `Asset(isDeleted, status)`
- `AssetEvent(assetId, occurredAt)` · `Assignment(employeeId, status)` · `Assignment(assetId, status)`
- `AuditScan(sessionId, codeScanned)` · `AuditLog(entity, entityId, createdAt)`
- Full-text search روی Asset (code, name, brand, model, serialNumber) با `pg_trgm` GIN index → Global Search.

## Decimal و پول

`Decimal @db.Decimal(14,2)` برای قیمت/هزینه (نه Float). واحد پیش‌فرض IRR + فیلد currency.
