#!/usr/bin/env node
/**
 * Une los reportes de cobertura (json-summary) del backend y del frontend y calcula
 * la cobertura de líneas sobre los 10 módulos críticos del E2.
 * Uso: node qa/scripts/cobertura-criticos.mjs [--min 20]
 * Con --min, termina con código 1 si la cobertura queda por debajo del mínimo.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINEA_BASE = 0; // registrada en la sección 2.4 (fase 1): 0 pruebas, 0 %
const iMin = process.argv.indexOf("--min");
const MIN = iMin > -1 ? Number(process.argv[iMin + 1]) : null;

// Los 10 módulos críticos del E2. Otros archivos medidos (p. ej. utilidades nuevas) no entran al cálculo.
const CRITICOS = new Set([
  "backend/src/controllers/orderController.js",
  "backend/src/utils/audit.js",
  "backend/src/controllers/cartController.js",
  "backend/src/controllers/authController.js",
  "backend/src/middleware/authMiddleware.js",
  "backend/src/utils/token.js",
  "backend/src/middleware/roleMiddleware.js",
  "frontend/src/utils/api.ts",
  "frontend/src/store/slices/authSlice.ts",
  "frontend/src/store/slices/cartSlice.ts",
]);
const filas = [];
for (const app of ["backend", "frontend"]) {
  const archivo = join(RAIZ, app, "coverage", "coverage-summary.json");
  if (!existsSync(archivo)) {
    console.error(`Falta ${relative(RAIZ, archivo)}. Ejecuta "npm run coverage" en ${app}.`);
    process.exit(1);
  }
  const resumen = JSON.parse(readFileSync(archivo, "utf8"));
  for (const [ruta, m] of Object.entries(resumen)) {
    if (ruta === "total") continue;
    const archivo = relative(RAIZ, ruta).replace(/\\/g, "/");
    if (!CRITICOS.has(archivo)) continue;
    filas.push({ archivo, cubiertas: m.lines.covered, total: m.lines.total });
  }
}

const cubiertas = filas.reduce((s, f) => s + f.cubiertas, 0);
const total = filas.reduce((s, f) => s + f.total, 0);
const pct = total ? (cubiertas / total) * 100 : 0;

console.log("\nCobertura de líneas sobre los módulos críticos (E2)\n");
for (const f of filas) {
  const p = f.total ? ((f.cubiertas / f.total) * 100).toFixed(1) : "0.0";
  console.log(`${f.archivo.padEnd(48)} ${String(f.cubiertas).padStart(4)} / ${String(f.total).padEnd(4)} ${p.padStart(6)} %`);
}
console.log("-".repeat(72));
console.log(`${"Total".padEnd(48)} ${String(cubiertas).padStart(4)} / ${String(total).padEnd(4)} ${pct.toFixed(1).padStart(6)} %`);
console.log(`Línea base: ${LINEA_BASE} %  ·  Incremento: ${(pct - LINEA_BASE).toFixed(1)} puntos porcentuales\n`);

writeFileSync(join(RAIZ, "qa", "cobertura-criticos.json"), JSON.stringify({ lineaBase: LINEA_BASE, cubiertas, total, porcentaje: Number(pct.toFixed(1)), archivos: filas }, null, 2));

if (MIN != null && pct - LINEA_BASE < MIN) {
  console.error(`El incremento (${(pct - LINEA_BASE).toFixed(1)} pp) no alcanza el mínimo de ${MIN} pp.`);
  process.exit(1);
}
