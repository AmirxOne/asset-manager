import { defineConfig } from "vitest/config";
import path from "node:path";
import react from "@vitejs/plugin-react";

// Component: jsdom + RTL
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/component/**/*.test.{ts,tsx}"],
    globals: true,
    testTimeout: 30000,
    setupFiles: ["./tests/component/setup.ts"],
    css: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
