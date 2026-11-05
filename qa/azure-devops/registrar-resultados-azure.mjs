#!/usr/bin/env node
/**
 * Registra en Azure DevOps (sin Test Plans) la ejecución de la fase 1:
 *   - Cada Test Case recibe la etiqueta "Aprobado" o "Fallido" y un comentario
 *     en su historial con la fecha, el ambiente y el resultado obtenido.
 *   - Cada defecto de resultados-fase1.json se crea como Bug con pasos de
 *     reproducción, resultado esperado, resultado obtenido, severidad y prioridad,
 *     vinculado (Related) a su Test Case y a su(s) User Story.
 *
 * Requiere haber corrido antes cargar-azure-devops.mjs (usa .estado-azure.json).
 * Uso:  node registrar-resultados-azure.mjs --dry-run
 *       node registrar-resultados-azure.mjs
 *   - Adjunta como evidencia las imágenes de qa/evidencias cuyo nombre empieza con
 *     la clave del work item (p. ej. DEF-03-registro.png, DEF-03-ui.png, PNF-04-atlas.png).
 *     Las de un DEF-xx se adjuntan al Bug y también a su Test Case.
 * Se puede ejecutar varias veces: no duplica bugs, etiquetas, comentarios ni adjuntos.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const API = "api-version=7.1";

for (const raw of existsSync(join(DIR, ".env")) ? readFileSync(join(DIR, ".env"), "utf8").split(/\r?\n/) : []) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!(k in process.env)) process.env[k] = v;
}
const ORG = process.env.AZDO_ORG || "";
const PROJECT = process.env.AZDO_PROJECT || "";
const PAT = process.env.AZDO_PAT || "";
const TAG = process.env.AZDO_TAG || "ACS2026-Fase1";
const HOST = (process.env.AZDO_HOST || "https://dev.azure.com").replace(/\/$/, "");
const BASE = `${HOST}/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}`;
const AUTH = "Basic " + Buffer.from(":" + PAT).toString("base64");

if (!DRY_RUN && (!ORG || !PROJECT || !PAT)) {
  console.error("Faltan AZDO_ORG, AZDO_PROJECT o AZDO_PAT en .env");
  process.exit(1);
}
const STATE_FILE = join(DIR, ".estado-azure.json");
if (!existsSync(STATE_FILE)) {
  console.error("No existe .estado-azure.json. Ejecuta primero: node cargar-azure-devops.mjs");
  process.exit(1);
}
const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const R = JSON.parse(readFileSync(join(DIR, "resultados-fase1.json"), "utf8"));

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const itemUrl = (id) => `${HOST}/${encodeURIComponent(ORG)}/_apis/wit/workItems/${id}`;

async function http(method, url, body, contentType = "application/json") {
  for (let intento = 1; intento <= 5; intento++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: AUTH, "Content-Type": contentType, Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, intento * 2000));
      continue;
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 203) throw new Error("Token rechazado (401). Revisa AZDO_PAT.");
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : {};
  }
  throw new Error(`Demasiados reintentos en ${method} ${url}`);
}
const patch = (id, ops) => http("PATCH", `${BASE}/_apis/wit/workitems/${id}?${API}`, ops, "application/json-patch+json");

async function registrarResultado(caseId, r) {
  const id = state[caseId];
  if (!id) return console.warn(`! ${caseId}: no está en .estado-azure.json, se omite`);
  const marca = `[Ejecución ${R.fecha}]`;
  const html =
    `<p><b>${esc(marca)} Resultado: ${esc(r.resultado)}</b>${r.defecto ? ` — defecto ${esc(r.defecto)}` : ""}</p>` +
    `<p><b>Ambiente:</b> ${esc(R.ambiente)}</p><p><b>Obtenido:</b> ${esc(r.obtenido)}</p>` +
    `<p><b>Ejecutor:</b> ${esc(R.ejecutor)}</p>`;
  if (DRY_RUN) return console.log(`[dry-run] Test Case #${id} ${caseId}: ${r.resultado}`);
  const wi = await http("GET", `${BASE}/_apis/wit/workitems/${id}?${API}`);
  const tags = String(wi.fields["System.Tags"] || "").split(";").map((t) => t.trim()).filter(Boolean)
    .filter((t) => t !== "Aprobado" && t !== "Fallido");
  tags.push(r.resultado);
  const ops = [{ op: "add", path: "/fields/System.Tags", value: tags.join("; ") }];
  const comments = await http("GET", `${BASE}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.4`);
  const yaEsta = (comments.comments || []).some((c) => String(c.text).includes(marca));
  if (!yaEsta) ops.push({ op: "add", path: "/fields/System.History", value: html });
  await patch(id, ops);
  console.log(`= Test Case #${id} ${caseId}: ${r.resultado}${yaEsta ? " (comentario ya existía)" : ""}`);
}

async function crearBug(d) {
  const key = d.id;
  const rels = [];
  if (state[d.caso]) rels.push({ id: state[d.caso], key: d.caso });
  for (const rq of d.requerimientos) if (state[rq]) rels.push({ id: state[rq], key: rq });
  if (!rels.length && state.EPIC) rels.push({ id: state.EPIC, key: "EPIC" });
  if (DRY_RUN) {
    console.log(`[dry-run] Bug ${d.id} — ${d.titulo}  (${d.severidad}; Related→${rels.map((r) => r.key).join(", ")})`);
    return;
  }
  let id = state[key];
  if (!id) {
    const repro =
      `<p><b>Caso de prueba:</b> ${esc(d.caso)} · <b>Requerimiento:</b> ${esc(d.inciso)} · <b>Módulo:</b> ${esc(d.modulo)}</p>` +
      `<p><b>Pasos para reproducir</b></p><ol>${d.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>` +
      `<p><b>Resultado esperado:</b> ${esc(d.esperado)}</p><p><b>Resultado obtenido:</b> ${esc(d.obtenido)}</p>` +
      `<p><b>Evidencia:</b> solicitud y respuesta registradas en qa/azure-devops/resultados-fase1.json y capturas adjuntas.</p>`;
    const ops = [
      { op: "add", path: "/fields/System.Title", value: `${d.id} — ${d.titulo}` },
      { op: "add", path: "/fields/Microsoft.VSTS.TCM.ReproSteps", value: repro },
      { op: "add", path: "/fields/Microsoft.VSTS.TCM.SystemInfo", value: `<p>${esc(R.ambiente)}. Ejecutado el ${esc(R.fecha)}.</p>` },
      { op: "add", path: "/fields/Microsoft.VSTS.Common.Severity", value: d.severidad },
      { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: d.prioridad },
      { op: "add", path: "/fields/System.Tags", value: [TAG, "Defecto", d.modulo, ...d.requerimientos].join("; ") },
      ...rels.map((r) => ({ op: "add", path: "/relations/-", value: { rel: "System.LinkTypes.Related", url: itemUrl(r.id) } })),
    ];
    const res = await http("POST", `${BASE}/_apis/wit/workitems/$Bug?${API}`, ops, "application/json-patch+json");
    id = res.id;
    state[key] = id;
    saveState();
    console.log(`+ Bug #${id} ${d.id} — ${d.titulo}`);
  } else {
    console.log(`= Bug #${id} ${d.id} ya existía`);
  }
}


// ---------- Evidencias (capturas) ----------
const EVID_DIR = join(DIR, "..", "evidencias");
async function adjuntar(wiId, file, comment) {
  const wi = await http("GET", `${BASE}/_apis/wit/workitems/${wiId}?$expand=relations&${API}`);
  const ya = (wi.relations || []).some((r) => r.rel === "AttachedFile" && r.attributes?.name === file);
  if (ya) return false;
  const bytes = readFileSync(join(EVID_DIR, file));
  const up = await fetch(`${BASE}/_apis/wit/attachments?fileName=${encodeURIComponent(file)}&${API}`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/octet-stream" },
    body: bytes,
  });
  if (!up.ok) throw new Error(`Subida de ${file} → ${up.status}: ${(await up.text()).slice(0, 300)}`);
  const { url } = await up.json();
  await patch(wiId, [{ op: "add", path: "/relations/-", value: { rel: "AttachedFile", url, attributes: { comment } } }]);
  return true;
}
async function subirEvidencias() {
  if (!existsSync(EVID_DIR)) return console.log("(sin carpeta qa/evidencias)");
  const files = readdirSync(EVID_DIR).filter((f) => /\.(png|jpe?g|gif|webp|html|pdf|mp4|webm)$/i.test(f)).sort();
  const casoDeDefecto = Object.fromEntries(R.defectos.map((d) => [d.id, d.caso]));
  for (const f of files) {
    const m = f.match(/^((?:CP|PNF|DEF)-\d\d)/i);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const destinos = [key];
    if (key.startsWith("DEF-") && state[casoDeDefecto[key]]) destinos.push(casoDeDefecto[key]);
    for (const k of destinos) {
      if (!state[k]) { console.warn(`! ${f}: ${k} no está en .estado-azure.json`); continue; }
      if (DRY_RUN) { console.log(`[dry-run] adjuntar ${f} → ${k} #${state[k]}`); continue; }
      const nuevo = await adjuntar(state[k], f, `Evidencia de ejecución ${R.fecha}`);
      console.log(`${nuevo ? "+" : "="} adjunto ${f} → ${k} #${state[k]}`);
    }
  }
}

async function main() {
  console.log(DRY_RUN ? "Modo --dry-run\n" : `Proyecto: ${ORG}/${PROJECT}\n`);
  for (const d of R.defectos) await crearBug(d);
  for (const [caseId, r] of Object.entries(R.resultados)) await registrarResultado(caseId, r);
  await subirEvidencias();
  const total = Object.values(R.resultados);
  const cps = Object.entries(R.resultados).filter(([k]) => k.startsWith("CP-")).map(([, v]) => v);
  const aprob = cps.filter((r) => r.resultado === "Aprobado").length;
  console.log(`\nCasos funcionales: ${cps.length} ejecutados, ${aprob} aprobados (${Math.round((aprob / cps.length) * 100)} %).`);
  console.log(`Pruebas no funcionales registradas: ${total.length - cps.length}. Bugs: ${R.defectos.length}.`);
}
main().catch((e) => {
  console.error("\nError:", e.message);
  process.exit(1);
});
