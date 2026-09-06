import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ماتریس سند 03-RBAC-MODEL.md — نقش × permissions
const PERMISSIONS: { key: string; name: string; group: string }[] = [
  { key: "asset:view", name: "دیدن دارایی‌ها", group: "دارایی" },
  { key: "asset:create", name: "ایجاد دارایی", group: "دارایی" },
  { key: "asset:update", name: "ویرایش دارایی", group: "دارایی" },
  { key: "asset:retire", name: "بازنشسته‌سازی دارایی", group: "دارایی" },
  { key: "asset:dispose", name: "اسقاط دارایی", group: "دارایی" },
  { key: "asset:assign", name: "تحویل دارایی", group: "دارایی" },
  { key: "asset:return", name: "عودت دارایی", group: "دارایی" },
  { key: "asset:transfer", name: "انتقال دارایی", group: "دارایی" },
  { key: "asset:bulk", name: "عملیات گروهی دارایی", group: "دارایی" },
  { key: "asset:import", name: "ورود داده دارایی", group: "دارایی" },
  { key: "category:manage", name: "مدیریت دسته‌ها", group: "دارایی" },
  { key: "employee:manage", name: "کارمندان", group: "سازمان" },
  { key: "department:manage", name: "بخش‌ها", group: "سازمان" },
  { key: "location:manage", name: "محل‌ها", group: "سازمان" },
  { key: "supplier:manage", name: "تأمین‌کنندگان", group: "سازمان" },
  { key: "warehouse:manage", name: "مدیریت انبار", group: "انبار" },
  { key: "maintenance:view", name: "دیدن تعمیرات", group: "تعمیرات" },
  { key: "maintenance:manage", name: "ثبت تعمیرات", group: "تعمیرات" },
  { key: "request:create", name: "ثبت درخواست", group: "درخواست‌ها" },
  { key: "request:viewAll", name: "دیدن همه درخواست‌ها", group: "درخواست‌ها" },
  { key: "request:approve:manager", name: "تأیید مدیر بخش", group: "درخواست‌ها" },
  { key: "request:approve:it", name: "تأیید IT", group: "درخواست‌ها" },
  { key: "request:fulfill", name: "تأمین درخواست", group: "درخواست‌ها" },
  { key: "audit:view", name: "دیدن ممیزی‌ها", group: "ممیزی" },
  { key: "audit:manage", name: "مدیریت ممیزی", group: "ممیزی" },
  { key: "audit:scan", name: "اسکن ممیزی", group: "ممیزی" },
  { key: "dashboard:view", name: "داشبورد", group: "گزارش" },
  { key: "report:view", name: "گزارش‌ها", group: "گزارش" },
  { key: "report:export", name: "خروجی گزارش", group: "گزارش" },
  { key: "audit-log:view", name: "لاگ ممیزی", group: "سامانه" },
  { key: "user:manage", name: "مدیریت کاربران", group: "سامانه" },
  { key: "role:manage", name: "مدیریت نقش‌ها", group: "سامانه" },
  { key: "settings:manage", name: "تنظیمات", group: "سامانه" },
];

const ROLES: { key: string; name: string; description: string; perms: string[] }[] = [
  {
    key: "super_admin",
    name: "مدیر کل سامانه",
    description: "دسترسی کامل به همه بخش‌ها",
    perms: ["*"],
  },
  {
    key: "asset_manager",
    name: "مدیر دارایی",
    description: "چرخه عمر دارایی، انبار، ممیزی، گزارش",
    perms: [
      "asset:view", "asset:create", "asset:update", "asset:retire", "asset:dispose",
      "asset:assign", "asset:return", "asset:transfer", "asset:bulk", "asset:import",
      "category:manage", "employee:manage", "department:manage", "location:manage",
      "supplier:manage", "warehouse:manage", "maintenance:view", "maintenance:manage",
      "request:create", "request:viewAll", "request:approve:it", "request:fulfill",
      "audit:view", "audit:manage", "audit:scan", "dashboard:view", "report:view",
      "report:export", "audit-log:view",
    ],
  },
  {
    key: "it_manager",
    name: "مدیر IT",
    description: "دارایی‌های IT + تأیید درخواست سطح IT",
    perms: [
      "asset:view", "asset:create", "asset:update", "asset:assign", "asset:return",
      "asset:transfer", "asset:bulk", "category:manage", "maintenance:view",
      "maintenance:manage", "request:create", "request:viewAll", "request:approve:it",
      "request:fulfill", "audit:view", "dashboard:view", "report:view", "report:export",
    ],
  },
  {
    key: "it_staff",
    name: "کارشناس IT",
    description: "عملیات روزمره دارایی، تعمیر، اسکن",
    perms: [
      "asset:view", "asset:create", "asset:update", "asset:assign", "asset:return",
      "asset:transfer", "maintenance:view", "maintenance:manage", "request:create",
      "request:fulfill", "audit:view", "dashboard:view",
    ],
  },
  {
    key: "warehouse_manager",
    name: "مدیر انبار",
    description: "انبار، ورود/خروج، ممیزی و برچسب",
    perms: [
      "asset:view", "asset:bulk", "location:manage", "warehouse:manage",
      "maintenance:view", "request:create", "audit:view", "audit:manage", "audit:scan",
      "dashboard:view", "report:view",
    ],
  },
  {
    key: "dept_manager",
    name: "مدیر بخش",
    description: "تأیید درخواست‌های بخش + گزارش بخش",
    perms: [
      "asset:view", "request:create", "request:viewAll", "request:approve:manager",
      "dashboard:view", "report:view",
    ],
  },
  {
    key: "employee",
    name: "کارمند",
    description: "درخواست دارایی و دیدن دارایی‌های خود",
    perms: ["request:create"],
  },
];

async function main() {
  console.log("Seeding permissions...");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { name: p.name, group: p.group },
      create: p,
    });
  }

  console.log("Seeding roles...");
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p]));
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permKeys = r.perms.includes("*") ? allPerms.map((p) => p.key) : r.perms;
    const missing = permKeys.filter((k) => !permByKey.has(k));
    if (missing.length) console.warn(`  WARN role ${r.key} missing perms: ${missing.join(", ")}`);
    await prisma.rolePermission.createMany({
      data: permKeys
        .map((k) => permByKey.get(k))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
    console.log(`  role ${r.key}: ${permKeys.length} perms`);
  }

  console.log("Seeding asset categories & types...");
  // دسته‌ها و انواع پیش‌فرض — کدها در asset code استفاده می‌شوند
  const CATS: { name: string; code: string; types: { name: string; code: string }[] }[] = [
    {
      name: "تجهیزات کامپیوتر",
      code: "IT",
      types: [
        { name: "موس", code: "MOU" },
        { name: "کیبورد", code: "KBD" },
        { name: "مانیتور", code: "MON" },
        { name: "لپ‌تاپ", code: "LAP" },
        { name: "کیس رومیزی", code: "DTP" },
        { name: "پرینتر", code: "PRN" },
        { name: "اسکنر", code: "SCN" },
      ],
    },
    {
      name: "شبکه و سرور",
      code: "NET",
      types: [
        { name: "سرور", code: "SRV" },
        { name: "سوئیچ", code: "SWI" },
        { name: "روتر", code: "RTR" },
        { name: "یو‌پی‌اس", code: "UPS" },
        { name: "تجهیزات شبکه", code: "NET" },
      ],
    },
    {
      name: "موبایل و تبلت",
      code: "MOB",
      types: [
        { name: "موبایل", code: "PHN" },
        { name: "تبلت", code: "TAB" },
      ],
    },
    {
      name: "مبلمان اداری",
      code: "FUR",
      types: [
        { name: "میز", code: "DSK" },
        { name: "صندلی", code: "CHR" },
        { name: "کمد", code: "CAB" },
      ],
    },
    {
      name: "تجهیزات اتاق جلسات",
      code: "MTG",
      types: [
        { name: "ویدئو وال", code: "VWL" },
        { name: "ویدئو کنفرانس", code: "VCF" },
        { name: "پروژکتور", code: "PRJ" },
      ],
    },
    {
      name: "عمومی",
      code: "GEN",
      types: [{ name: "سایر", code: "ETC" }],
    },
  ];

  for (const c of CATS) {
    const cat = await prisma.assetCategory.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { name: c.name, code: c.code },
    });
    for (const t of c.types) {
      await prisma.assetType.upsert({
        where: { code: t.code },
        update: { name: t.name, categoryId: cat.id },
        create: { name: t.name, code: t.code, categoryId: cat.id },
      });
    }
  }
  console.log(`  ${CATS.length} categories, ${CATS.reduce((a, c) => a + c.types.length, 0)} types`);

  console.log("Seeding org data (departments, locations, employees)...");
  await prisma.supplier.upsert({
    where: { name: "رایان سیستم" },
    update: {},
    create: { name: "رایان سیستم", contactName: "مهندس رضایی", phone: "021-88110022" },
  });
  await prisma.supplier.upsert({
    where: { name: "تجهیز گستر پارس" },
    update: {},
    create: { name: "تجهیز گستر پارس", contactName: "خانم موسوی", phone: "021-44556677" },
  });
  const DEPTS = ["مدیریت", "فناوری اطلاعات", "منابع انسانی", "مالی", "فروش", "بازاریابی"];
  for (const [i, name] of DEPTS.entries()) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name, code: ["MGT", "IT", "HR", "FIN", "SLS", "MKT"][i] },
    });
  }

  const warehouse = await prisma.location.upsert({
    where: { code: "WH-M" },
    update: {},
    create: { name: "انبار مرکزی", code: "WH-M", type: "WAREHOUSE" },
  });
  const hq = await prisma.location.upsert({
    where: { code: "HQ" },
    update: {},
    create: { name: "ساختمان مرکزی", code: "HQ", type: "BUILDING" },
  });
  await prisma.location.upsert({
    where: { code: "FL2" },
    update: {},
    create: { name: "طبقه دوم", code: "FL2", type: "FLOOR", parentId: hq.id },
  });
  void warehouse;

  const itDept =
    (await prisma.department.findUnique({ where: { code: "IT" } })) ??
    (await prisma.department.findUnique({ where: { name: "فناوری اطلاعات" } }));
  if (!itDept) throw new Error("IT department missing");

  const EMPS = [
    { fullName: "علی رضایی", personnelCode: "EMP-001", position: "کارشناس شبکه" },
    { fullName: "سارا محمدی", personnelCode: "EMP-002", position: "کارشناس پشتیبانی" },
    { fullName: "رضا کریمی", personnelCode: "EMP-003", position: "مدیر مالی" },
    { fullName: "مریم احمدی", personnelCode: "EMP-004", position: "کارشناس فروش" },
  ];
  for (const e of EMPS) {
    await prisma.employee.upsert({
      where: { personnelCode: e.personnelCode },
      update: {},
      create: { ...e, departmentId: itDept.id },
    });
  }
  console.log(`  ${DEPTS.length} departments, 3 locations, ${EMPS.length} employees`);

  console.log("Seeding admin user...");
  const adminHash = await bcrypt.hash("Admin@123", 12);
  await prisma.user.upsert({
    where: { email: "admin@ams.local" },
    update: {},
    create: {
      email: "admin@ams.local",
      fullName: "مدیر سامانه",
      passwordHash: adminHash,
      isSuperAdmin: true,
      jobTitle: "مدیر کل",
      roles: { create: [{ role: { connect: { key: "super_admin" } } }] },
    },
  });

  // کاربران آزمایشی هر نقش برای تست‌های RBAC
  const testUsers: { email: string; fullName: string; role: string }[] = [
    { email: "assetmgr@ams.local", fullName: "مدیر دارایی", role: "asset_manager" },
    { email: "itmgr@ams.local", fullName: "مدیر IT", role: "it_manager" },
    { email: "itstaff@ams.local", fullName: "کارشناس IT", role: "it_staff" },
    { email: "whmgr@ams.local", fullName: "مدیر انبار", role: "warehouse_manager" },
    { email: "deptmgr@ams.local", fullName: "مدیر بخش", role: "dept_manager" },
    { email: "employee@ams.local", fullName: "کارمند نمونه", role: "employee" },
  ];
  const testHash = await bcrypt.hash("Test@1234", 12);
  for (const u of testUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash: testHash,
        roles: { create: [{ role: { connect: { key: u.role } } }] },
      },
    });
  }

  console.log(
    "Seed done: " + PERMISSIONS.length + " permissions, " + ROLES.length + " roles, admin + 6 test users",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
