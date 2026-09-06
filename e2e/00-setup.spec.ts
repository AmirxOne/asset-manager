import { test as setup } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Global setup — قبل از همه E2E:
 * rate-limit لاگین‌ها را پاک می‌کند (integration tests قبلی 401 ثبت کرده‌اند)
 * تا لاگین اولین تست fail نشود. (pg npm در دسترس نیست — psql داخل docker)
 */
setup("prepare: reset login rate-limit", async () => {
  try {
    execSync(
      `docker exec meetinghub-postgres-1 psql -U meetinghub -d assetmanager_test -c "TRUNCATE \\"LoginAttempt\\";"`,
      { stdio: "pipe" },
    );
  } catch {
    // اگر داکر در دسترس نبود، ادامه — تست ممکن است rate-limit بخورد
  }
});
