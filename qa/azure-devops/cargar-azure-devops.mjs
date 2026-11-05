#!/usr/bin/env node
/**
 * Carga la fase 1 del Proyecto ACS 2026 (Luxora) en Azure DevOps Boards.
 *
 * Crea, sin necesitar Azure Test Plans:
 *   Epic      Luxora E-Commerce — Proyecto ACS 2026
 *   Feature   CU-01 … CU-08 y "Requerimientos no funcionales"
 *   User Story RF-01 … RF-12 y RNF-01 … RNF-06 (hijas de su Feature)
 *   Test Case CP-01 … CP-30 y PNF-01 … PNF-06, cada uno vinculado con la
 *             relación "Tests" a su(s) User Story (la User Story muestra "Tested By").
 *
 * Uso:
 *   node cargar-azure-devops.mjs --dry-run   # muestra lo que haría, sin conectarse
 *   node cargar-azure-devops.mjs             # crea los work items
 *
 * Configuración: archivo .env en esta carpeta (ver .env.example).
 * Se puede ejecutar varias veces: lo que ya existe (mismo tipo y título) no se duplica.
 * Requiere Node.js 18 o superior (usa fetch nativo). No tiene dependencias.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const API = "api-version=7.1";

// ---------- Configuración ----------
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(join(DIR, ".env"));

const ORG = process.env.AZDO_ORG || "";
const PROJECT = process.env.AZDO_PROJECT || "";
const PAT = process.env.AZDO_PAT || "";
const REQ_TYPE = process.env.AZDO_REQUIREMENT_TYPE || "User Story";
const AREA = process.env.AZDO_AREA_PATH || "";
const ITERATION = process.env.AZDO_ITERATION_PATH || "";
const TAG = process.env.AZDO_TAG || "ACS2026-Fase1";

if (!DRY_RUN && (!ORG || !PROJECT || !PAT)) {
  console.error("Faltan variables. Copia .env.example a .env y completa AZDO_ORG, AZDO_PROJECT y AZDO_PAT.");
  process.exit(1);
}

const HOST = (process.env.AZDO_HOST || "https://dev.azure.com").replace(/\/$/, "");
const BASE = `${HOST}/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}`;
const AUTH = "Basic " + Buffer.from(":" + PAT).toString("base64");
const STATE_FILE = join(DIR, ".estado-azure.json");
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const data = JSON.parse(readFileSync(join(DIR, "datos-fase1.json"), "utf8"));

// ---------- Utilidades de formato ----------
const escHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escXml = escHtml;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const p = (label, text) => `<p><b>${escHtml(label)}:</b> ${escHtml(cap(text))}</p>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>`;
const ol = (items) => `<ol>${items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ol>`;
const priority = (txt) => (String(txt).toLowerCase().startsWith("alta") ? 1 : String(txt).toLowerCase().startsWith("media") ? 2 : 3);

// Pasos de un Test Case: el resultado esperado va en el último paso (ValidateStep).
function stepsXml(pasos, esperado) {
  const html = (t) => escXml(`<DIV><P>${escHtml(t)}</P></DIV>`);
  const body = pasos
    .map((accion, i) => {
      const last = i === pasos.length - 1;
      const id = i + 2;
      return (
        `<step id="${id}" type="${last ? "ValidateStep" : "ActionStep"}">` +
        `<parameterizedString isformatted="true">${html(accion)}</parameterizedString>` +
        `<parameterizedString isformatted="true">${last ? html(cap(esperado)) : ""}</parameterizedString>` +
        `<description/></step>`
      );
    })
    .join("");
  return `<steps id="0" last="${pasos.length + 1}">${body}</steps>`;
}

// ---------- Cliente REST ----------
async function http(method, url, body, contentType = "application/json") {
  if (DRY_RUN) throw new Error("http() no debe llamarse en --dry-run");
  for (let intento = 1; intento <= 5; intento++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: AUTH, "Content-Type": contentType, Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || intento * 2000;
      console.warn(`  ${res.status} en ${method} ${url}; reintento en ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 203) {
      throw new Error("Azure DevOps rechazó el token (401). Revisa AZDO_PAT, su organización y el scope Work Items (Read & write).");
    }
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : {};
  }
  throw new Error(`Demasiados reintentos en ${method} ${url}`);
}

async function findByTitle(type, title) {
  const q = title.replace(/'/g, "''");
  const wiql = {
    query:
      `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project ` +
      `AND [System.WorkItemType] = '${type}' AND [System.Title] = '${q}' ORDER BY [System.Id]`,
  };
  const r = await http("POST", `${BASE}/_apis/wit/wiql?${API}`, wiql);
  return r.workItems?.[0]?.id ?? null;
}

const itemUrl = (id) => `${HOST}/${encodeURIComponent(ORG)}/_apis/wit/workItems/${id}`;
const webUrl = (id) => `${BASE}/_workitems/edit/${id}`;

const creados = [];
let contador = 0;

/**
 * Crea (o reutiliza) un work item.
 * @param key       clave estable para el archivo de estado (p. ej. "RF-01")
 * @param type      tipo de work item
 * @param fields    { "System.Title": ..., ... }
 * @param relations [{ rel, id }]
 */
async function ensure(key, type, fields, relations = []) {
  const title = fields["System.Title"];
  contador++;
  if (DRY_RUN) {
    const fake = 10000 + contador;
    state[key] = state[key] ?? fake;
    const rels = relations.map((r) => `${r.rel.split(".").pop()}→${r.key}`).join(", ");
    console.log(`[dry-run] ${type.padEnd(11)} ${title}${rels ? `  (${rels})` : ""}`);
    creados.push({ key, type, id: state[key], title, estado: "simulado" });
    return state[key];
  }

  let id = state[key];
  let estado = "existente";
  if (!id) id = await findByTitle(type, title);
  if (!id) {
    const ops = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => ({ op: "add", path: `/fields/${k}`, value: v }));
    if (AREA) ops.push({ op: "add", path: "/fields/System.AreaPath", value: AREA });
    if (ITERATION) ops.push({ op: "add", path: "/fields/System.IterationPath", value: ITERATION });
    for (const r of relations) {
      ops.push({ op: "add", path: "/relations/-", value: { rel: r.rel, url: itemUrl(r.id) } });
    }
    const res = await http(
      "POST",
      `${BASE}/_apis/wit/workitems/$${encodeURIComponent(type)}?${API}`,
      ops,
      "application/json-patch+json"
    );
    id = res.id;
    estado = "creado";
  } else {
    await ensureRelations(id, relations);
  }
  state[key] = id;
  saveState();
  console.log(`${estado === "creado" ? "+" : "="} ${type.padEnd(11)} #${id} ${title}`);
  creados.push({ key, type, id, title, estado });
  return id;
}

// Si el item ya existía, agrega los vínculos que le falten.
async function ensureRelations(id, relations) {
  if (!relations.length) return;
  const wi = await http("GET", `${BASE}/_apis/wit/workitems/${id}?$expand=relations&${API}`);
  const have = new Set((wi.relations || []).map((r) => `${r.rel}|${String(r.url).split("/").pop()}`));
  const ops = relations
    .filter((r) => !have.has(`${r.rel}|${r.id}`))
    .map((r) => ({ op: "add", path: "/relations/-", value: { rel: r.rel, url: itemUrl(r.id) } }));
  if (ops.length) {
    await http("PATCH", `${BASE}/_apis/wit/workitems/${id}?${API}`, ops, "application/json-patch+json");
    console.log(`  #${id}: ${ops.length} vínculo(s) agregado(s)`);
  }
}

// ---------- Verificación previa ----------
async function preflight() {
  const r = await http("GET", `${BASE}/_apis/wit/workitemtypes?${API}`);
  const tipos = new Set((r.value || []).map((t) => t.name));
  const needed = ["Epic", "Feature", REQ_TYPE, "Test Case"];
  const missing = needed.filter((t) => !tipos.has(t));
  if (missing.length) {
    throw new Error(
      `El proyecto no tiene los tipos: ${missing.join(", ")}. Tipos disponibles: ${[...tipos].join(", ")}.\n` +
        `Si el proyecto usa el proceso Scrum, pon AZDO_REQUIREMENT_TYPE="Product Backlog Item" en .env.`
    );
  }
}

// ---------- Carga ----------
const PARENT = "System.LinkTypes.Hierarchy-Reverse"; // el item nuevo es hijo de ...
const TESTS = "Microsoft.VSTS.Common.TestedBy-Reverse"; // el Test Case "Tests" a la User Story

async function main() {
  console.log(DRY_RUN ? "Modo --dry-run: no se conecta a Azure DevOps.\n" : `Proyecto: ${ORG}/${PROJECT}\n`);
  if (!DRY_RUN) await preflight();

  const tags = (...extra) => [TAG, ...extra].join("; ");

  // Epic
  const epicId = await ensure("EPIC", "Epic", {
    "System.Title": data.proyecto,
    "System.Description":
      `<p>Evaluación de calidad de Luxora E-Commerce (Aseguramiento de la Calidad de Software, UMG).</p>` +
      `<p>Fase 1: 8 casos de uso, 12 requerimientos funcionales, 6 no funcionales y 36 pruebas.</p>`,
    "System.Tags": tags(),
  });

  // Features: casos de uso
  const featureIds = {};
  for (const cu of data.casos_de_uso) {
    featureIds[cu.id] = await ensure(
      cu.id,
      "Feature",
      {
        "System.Title": `${cu.id} — ${cu.nombre}`,
        "System.Description":
          p("Actor", cu.actor) +
          p("Precondición", cu.precondicion) +
          `<p><b>Flujo principal</b></p>${ol(cu.flujo_principal)}` +
          `<p><b>Flujos alternos</b></p>${ul(cu.flujos_alternos)}` +
          p("Postcondición", cu.postcondicion),
        "System.Tags": tags("Caso de uso"),
      },
      [{ rel: PARENT, id: epicId, key: "EPIC" }]
    );
  }
  featureIds.RNF = await ensure(
    "FEATURE-RNF",
    "Feature",
    {
      "System.Title": "Requerimientos no funcionales",
      "System.Description": "<p>RNF-01 a RNF-06, clasificados según ISO/IEC 25010.</p>",
      "System.Tags": tags("RNF"),
    },
    [{ rel: PARENT, id: epicId, key: "EPIC" }]
  );

  // User Stories: requerimientos
  const reqIds = {};
  for (const r of data.requerimientos) {
    const parentKey = r.tipo === "RF" ? r.cu : "RNF";
    const fields = {
      "System.Title": `${r.id} — ${r.nombre}`,
      "Microsoft.VSTS.Common.Priority": priority(r.prioridad),
      "System.Tags": tags(r.tipo, r.id),
    };
    if (r.tipo === "RF") {
      fields["System.Description"] = p("Requerimiento", r.descripcion) + p("Caso de uso", r.cu);
      fields["Microsoft.VSTS.Common.AcceptanceCriteria"] = `<p>${escHtml(r.descripcion)}</p>`;
    } else {
      fields["System.Description"] =
        p("Característica ISO/IEC 25010", r.caracteristica) + p("Requerimiento", r.descripcion) + p("Cómo se verifica", r.verificacion);
      fields["Microsoft.VSTS.Common.AcceptanceCriteria"] = `<p>${escHtml(r.criterio)}</p>`;
    }
    reqIds[r.id] = await ensure(r.id, REQ_TYPE, fields, [{ rel: PARENT, id: featureIds[parentKey], key: parentKey }]);
  }

  // Test Cases
  for (const c of data.casos_de_prueba) {
    const rels = c.requerimientos.map((rid) => ({ rel: TESTS, id: reqIds[rid], key: rid }));
    await ensure(
      c.id,
      "Test Case",
      {
        "System.Title": `${c.id} — ${c.titulo}`,
        "System.Description":
          p("Requerimiento asociado", c.rf_detalle) +
          p("Técnica", c.tecnica) +
          p("Precondiciones", c.precondiciones) +
          p("Datos de prueba", c.datos) +
          p("Resultado esperado", c.resultado_esperado),
        "Microsoft.VSTS.TCM.Steps": stepsXml(c.pasos, c.resultado_esperado),
        "Microsoft.VSTS.Common.Priority": priority(c.prioridad),
        "System.Tags": tags(c.tipo === "funcional" ? "Funcional" : "No funcional", c.tecnica_corta, ...c.requerimientos),
      },
      rels
    );
  }

  // Resumen
  const csv = ["clave,tipo,id,titulo,url"]
    .concat(creados.map((c) => [c.key, c.type, c.id, `"${c.title.replace(/"/g, '""')}"`, DRY_RUN ? "" : webUrl(c.id)].join(",")))
    .join("\n");
  const out = join(DIR, DRY_RUN ? "resumen-azure-dry-run.csv" : "resumen-azure.csv");
  writeFileSync(out, "﻿" + csv);
  if (DRY_RUN) {
    // No se guarda estado simulado.
    const sample = data.casos_de_prueba[0];
    console.log("\nEjemplo de pasos (Microsoft.VSTS.TCM.Steps) de", sample.id, ":\n", stepsXml(sample.pasos, sample.resultado_esperado));
  }
  const n = (t) => creados.filter((c) => c.type === t).length;
  console.log(
    `\nListo: ${n("Epic")} Epic, ${n("Feature")} Features, ${n(REQ_TYPE)} ${REQ_TYPE}, ${n("Test Case")} Test Cases.` +
      `\nResumen con los IDs: ${out}`
  );
}

main().catch((e) => {
  console.error("\nError:", e.message);
  process.exit(1);
});
