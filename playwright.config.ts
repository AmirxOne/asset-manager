import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3200",
    headless: true,
    channel: "chrome", // system Chrome — CDN دانلود مرورگر بلاک است
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
