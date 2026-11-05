# Estrategia de ramas y control de cambios

## Ramas permanentes y ambientes

| Rama | Ambiente | Despliegue | Quién puede escribir |
| --- | --- | --- | --- |
| `dev` | DEV (integración) | Ninguno: el pipeline compila, prueba y analiza | Solo mediante Pull Request desde `feature/*` o `fix/*` |
| `qa` | QA | Vercel (preview de la rama `qa`) + API `luxora-api-qa` en Render + base `luxora_qa` | Solo mediante Pull Request desde `dev` |
| `main` | PROD | Vercel (producción) + API `luxora-api` en Render + base de producción | Solo mediante Pull Request desde `qa` (o `hotfix/*`) |

## Ramas temporales

- `feature/<tema>`: trabajo nuevo (pruebas, pipeline, configuración). Sale de `dev` y vuelve a `dev`.
- `fix/<tema>`: corrección de defectos o hallazgos de análisis estático. Sale de `dev` y vuelve a `dev`.
- `hotfix/<tema>`: corrección urgente en producción. Sale de `main`, vuelve a `main` y después se integra a `dev`.

## Política de promoción

1. **feature/fix → dev.** Pull Request con descripción del cambio y revisión de código. Se exige el pipeline en verde: compilación, pruebas unitarias, análisis estático con quality gate y pruebas de API.
2. **dev → qa.** Pull Request de promoción cuando `dev` reúne un conjunto de cambios estable. Con el pipeline en verde, el merge despliega al ambiente QA, donde se verifica el funcionamiento.
3. **qa → main.** Pull Request de liberación después de verificar QA. Con el pipeline en verde, el merge despliega a producción.

## Reglas de protección (GitHub → Settings → Rules)

Aplican a `qa` y `main` (y a `dev` como buena práctica):

- No se permite push directo: todo cambio entra por Pull Request.
- El merge queda bloqueado si el pipeline (`CI-CD`) falla.
- No se permite force push ni borrar la rama.

## Revisión de Pull Requests

La revisión verifica, como mínimo: que el cambio corresponde a lo descrito, que las pruebas nuevas comprueban el comportamiento esperado (y no solo ejecutan código), que no se suben secretos y que el pipeline pasa. Los comentarios se dejan sobre las líneas revisadas.

## Convención de commits

`tipo(alcance): descripción` con los tipos `feat`, `fix`, `test`, `ci`, `docs`, `chore` y `refactor`.
