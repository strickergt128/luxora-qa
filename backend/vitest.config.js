import { defineConfig } from "vitest/config";

// Módulos críticos definidos en el E2 (fase 1). La cobertura se mide solo sobre ellos.
export const MODULOS_CRITICOS = [
  "src/controllers/orderController.js",
  "src/utils/audit.js",
  "src/controllers/cartController.js",
  "src/controllers/authController.js",
  "src/middleware/authMiddleware.js",
  "src/utils/token.js",
  "src/middleware/roleMiddleware.js",
];

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.js"],
    setupFiles: ["tests/setup.js"],
    restoreMocks: true,
    reporters: ["default", "junit"],
    outputFile: { junit: "reports/junit-backend.xml" },
    coverage: {
      provider: "v8",
      include: MODULOS_CRITICOS,
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      // Falla la ejecución si la cobertura de líneas de los módulos críticos baja del mínimo exigido (20 %).
      thresholds: { lines: 20 },
    },
  },
});
