import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration: DB واقعی — هر فایل خودش schema را با migrate deploy اعمال و truncate می‌کند
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false, // فایل‌ها ترتیبی — seed/truncate تداخل نکنند
    env: {
      DATABASE_URL: "postgresql://meetinghub:meetinghub@localhost:5432/assetmanager_test?schema=public",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
