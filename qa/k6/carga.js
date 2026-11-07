/**
 * Prueba de carga (E14) — k6
 * Endpoints críticos: catálogo (GET /api/products) y detalle (GET /api/products/:id).
 * Escenario: rampa de 0 a 50 usuarios virtuales en 1 minuto, 50 usuarios sostenidos 5 minutos
 * y bajada de 30 segundos. Los umbrales son los criterios de RNF-01 y RNF-03.
 *
 * Uso:  k6 run qa/k6/carga.js
 *       k6 run -e BASE_URL=https://luxora-qa-staging.vercel.app qa/k6/carga.js
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

const BASE_URL = __ENV.BASE_URL || "https://luxora-qa.vercel.app";

export const options = {
  stages: [
    { duration: "1m", target: 50 }, // rampa 0 → 50
    { duration: "5m", target: 50 }, // sostenido
    { duration: "30s", target: 0 }, // bajada
  ],
  thresholds: {
    // RNF-01: percentil 95 ≤ 2 s y promedio ≤ 1 s
    "http_req_duration{endpoint:catalogo}": ["p(95)<=2000", "avg<=1000"],
    "http_req_duration{endpoint:detalle}": ["p(95)<=2000", "avg<=1000"],
    http_req_duration: ["p(95)<=2000", "avg<=1000"],
    // RNF-03: tasa de error < 1 % y throughput ≥ 20 solicitudes por segundo
    http_req_failed: ["rate<0.01"],
    http_reqs: ["rate>=20"],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/products?page=1&limit=20`, { timeout: "90s" });
  const ids = (res.json("items") || []).map((p) => p._id);
  if (ids.length === 0) throw new Error(`El catálogo no devolvió productos (${res.status})`);
  return { ids };
}

export default function (data) {
  group("Catálogo", () => {
    const res = http.get(`${BASE_URL}/api/products?page=1&limit=12`, { tags: { endpoint: "catalogo" }, timeout: "10s" });
    check(res, {
      "catálogo: código 200": (r) => r.status === 200,
      "catálogo: trae productos": (r) => (r.json("items") || []).length > 0,
    });
  });

  group("Detalle de producto", () => {
    const id = data.ids[Math.floor(Math.random() * data.ids.length)];
    const res = http.get(`${BASE_URL}/api/products/${id}`, { tags: { endpoint: "detalle" }, timeout: "10s" });
    check(res, { "detalle: código 200": (r) => r.status === 200 });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "qa/k6/resultado.json": JSON.stringify(data, null, 2),
  };
}
