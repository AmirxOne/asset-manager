import { test as setup } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Global setup — قبل از همه E2E:
 * ۱) پاک‌سازی rate-limit لاگین (integration tests قبلی 401 ثبت کرده‌اند)
 * ۲) warmup: کامپیل routeهای اصلی سرور dev تا تست‌ها روی سرور گرم اجرا شوند
 */
setup("prepare: reset rate-limit + warmup server", async ({ request }) => {
  try {
    execSync(
      `docker exec meetinghub-postgres-1 psql -U meetinghub -d assetmanager_test -c "TRUNCATE \\"LoginAttempt\\";"`,
      { stdio: "pipe" },
    );
  } catch {
    // داکر در دسترس نبود — ادامه
  }

  // warmup — کامپایل صفحات/APIهای پرمصرف (خطاها مهم نیست، فقط کامپایل)
  const paths = [
    "/api/health", "/login", "/api/auth/login",
    "/dashboard", "/assets", "/assets/new", "/api/assets?page=1&pageSize=1",
    "/api/categories", "/api/asset-types", "/api/employees?options=1",
    "/departments", "/employees", "/suppliers", "/requests", "/maintenance",
    "/audits", "/warehouse", "/reports", "/scan",
    "/api/warehouse/summary", "/api/dashboard", "/api/notifications",
  ];
  await Promise.all(
    paths.map((p) =>
      request.get(p).catch(() => {}),
    ),
  );
});
