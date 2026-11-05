# Carga de la fase 1 en Azure DevOps

Crea en Azure Boards (sin Azure Test Plans) la trazabilidad de la fase 1 de Luxora:

- 1 Epic: Luxora E-Commerce — Proyecto ACS 2026
- 9 Features: CU-01 a CU-08 y "Requerimientos no funcionales"
- 18 User Stories: RF-01 a RF-12 y RNF-01 a RNF-06, hijas de su Feature
- 36 Test Cases: CP-01 a CP-30 y PNF-01 a PNF-06, con pasos y resultado esperado,
  vinculados con la relación **Tests** a su User Story (en la User Story aparece como **Tested By**)

Los datos salen del documento del proyecto (`datos-fase1.json`).

## Requisitos

- Node.js 18 o superior. No hay dependencias que instalar.
- Un token de acceso personal (PAT) de Azure DevOps con el scope **Work Items: Read & write**.

## Uso

```bash
cd qa/azure-devops
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
# edita .env con tu organización, proyecto y token
node cargar-azure-devops.mjs --dry-run   # revisa lo que se va a crear
node cargar-azure-devops.mjs             # crea los work items
```

Al terminar se genera `resumen-azure.csv` con el ID y la URL de cada work item.
El script se puede volver a ejecutar: lo que ya existe (mismo tipo y título) no se duplica
y solo se agregan los vínculos que falten.
