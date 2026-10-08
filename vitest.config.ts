import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
