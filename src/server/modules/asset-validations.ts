import { z } from "zod";
import { ASSET_STATUSES, ASSET_CONDITIONS } from "./asset-lifecycle";

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ نامعتبر است (YYYY-MM-DD)");

export const categorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته حداقل ۲ نویسه است").max(60),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,5}$/, "کد دسته ۲ تا ۵ نویسه لاتین/رقم است"),
  parentId: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  defaultWarrantyMonths: z.number().int().min(0).max(120).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const assetTypeSchema = z.object({
  name: z.string().trim().min(2, "نام نوع حداقل ۲ نویسه است").max(60),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,5}$/, "کد نوع ۲ تا ۵ نویسه لاتین/رقم است"),
  categoryId: z.string().min(1, "دسته الزامی است"),
  description: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

const decimalString = z
  .string()
  .trim()
  .regex(/^\d{1,14}(\.\d{1,2})?$/, "مبلغ نامعتبر است");

export const assetCreateSchema = z.object({
  name: z.string().trim().min(2, "نام دارایی حداقل ۲ نویسه است").max(120),
  assetTypeId: z.string().min(1, "نوع دارایی الزامی است"),
  brand: z.string().trim().max(60).nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  serialNumber: z.string().trim().max(80).nullable().optional(),
  purchaseDate: isoDate.nullable().optional(),
  purchasePrice: decimalString.nullable().optional(),
  currency: z.enum(["IRR", "USD"]).optional(),
  supplierId: z.string().min(1).nullable().optional(),
  warrantyStart: isoDate.nullable().optional(),
  warrantyEnd: isoDate.nullable().optional(),
  locationId: z.string().min(1).nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  condition: z.enum(ASSET_CONDITIONS).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /// None = تولید خودکار کد
  code: z
    .string()
    .trim()
    .regex(/^AST-[A-Za-z0-9]+-[A-Za-z0-9]+-\d{4,6}$/, "قالب کد: AST-XXX-XXX-000000")
    .optional()
    .or(z.literal("")),
  /// وضعیت اولیه — پیش‌فرض IN_STOCK
  status: z.enum(ASSET_STATUSES).optional(),
});

export const assetUpdateSchema = assetCreateSchema.partial().omit({ status: true });

export const assetListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  condition: z.enum(ASSET_CONDITIONS).optional(),
  categoryId: z.string().min(1).optional(),
  assetTypeId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
  brand: z.string().trim().max(60).optional(),
  warrantyExpiringBefore: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["code", "name", "createdAt", "status", "purchasePrice"]).default("code"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;
