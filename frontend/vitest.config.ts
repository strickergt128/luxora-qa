import { defineConfig } from "vitest/config";

// Módulos críticos del frontend definidos en el E2 (fase 1).
export const MODULOS_CRITICOS = [
  "src/utils/api.ts",
  "src/store/slices/authSlice.ts",
  "src/store/slices/cartSlice.ts",
];

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    restoreMocks: true,
    reporters: ["default", "junit"],
    outputFile: { junit: "reports/junit-frontend.xml" },
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
