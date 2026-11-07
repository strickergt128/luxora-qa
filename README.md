# Luxora E-Commerce — Evaluación de calidad (ACS 2026)

Repositorio del proyecto final de Aseguramiento de la Calidad de Software. La aplicación bajo evaluación es Luxora E-Commerce (importada de VortexDevX/E-Commerce, licencia ISC); el equipo no la desarrolló, la evalúa.

| Ambiente | Rama | Frontend | API |
| --- | --- | --- | --- |
| Producción | `main` | https://luxora-qa.vercel.app | https://luxora-api-x8g7.onrender.com |
| QA | `qa` | https://luxora-qa-staging.vercel.app | Render (`luxora-api-qa`) |
| Desarrollo | `dev` | Solo pipeline (sin despliegue) | — |

Estrategia de ramas y política de promoción: [docs/ESTRATEGIA-DE-RAMAS.md](docs/ESTRATEGIA-DE-RAMAS.md).

## Instalación

Requisitos: Node.js 22 y una base MongoDB (local o Atlas).

```bash
git clone https://github.com/strickergt128/luxora-qa.git
cd luxora-qa

# Backend
cd backend
cp .env.example .env        # completar MONGODB_URI, JWT_ACCESS_SECRET y JWT_MFA_SECRET
npm ci
MONGO_URI=<uri de MongoDB> npm run seed   # usuarios y productos de prueba
npm run dev                 # http://localhost:8080

# Frontend (otra terminal)
cd frontend
npm ci
npm run dev                 # http://localhost:3000
```

Usuarios del seed: `admin@luxora.com`, `seller@luxora.com` y `user@luxora.com`, todos con la contraseña `password123` (solo para ambientes de prueba).

## Ejecución de pruebas

| Prueba | Comando | Dónde |
| --- | --- | --- |
| Unitarias backend (Vitest) | `npm test` / `npm run coverage` | `backend/` |
| Unitarias frontend (Vitest) | `npm test` / `npm run coverage` | `frontend/` |
| Cobertura de los módulos críticos | `node qa/scripts/cobertura-criticos.mjs --min 20` | raíz (después de `npm run coverage` en ambos) |
| API (Postman + Newman) | ver [qa/postman/README.md](qa/postman/README.md) | raíz, con el backend corriendo sobre una base recién sembrada |
| Carga (k6) | `k6 run qa/k6/carga.js` | raíz; `-e BASE_URL=<url>` para otro ambiente |

Los reportes se generan en `backend/coverage`, `frontend/coverage`, `backend/reports`, `frontend/reports` y `qa/k6/resultado.json` (no se versionan).

## Ejecución del pipeline

El workflow [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) (GitHub Actions, nombre **CI-CD**) ejecuta en orden:

1. Compilación (verificación de sintaxis del backend y `next build` del frontend).
2. Pruebas unitarias con cobertura y verificación de +20 pp sobre los módulos críticos.
3. Análisis estático en SonarCloud con espera del quality gate.
4. Pruebas de API: MongoDB como servicio, seed, backend y Newman.
5. Despliegue: push a `qa` → ambiente QA; push a `main` → producción (deploy hooks de Render y Vercel y prueba de humo).

Se dispara con cada push y Pull Request hacia `dev`, `qa` y `main`. Para ejecutarlo manualmente: **Actions → CI-CD → Run workflow** y elegir la rama. Los merges hacia `dev`, `qa` y `main` quedan bloqueados si alguna de las etapas 1 a 4 falla.

Secretos y variables necesarios (GitHub → Settings): `SONAR_TOKEN` (repositorio) y, en los ambientes `qa` y `production`, los secretos `RENDER_DEPLOY_HOOK` y `VERCEL_DEPLOY_HOOK` y las variables `APP_URL` y `API_URL`.

Análisis estático: https://sonarcloud.io/project/overview?id=strickergt128_luxora-qa

---

## Aplicación original

Full-stack e-commerce app with a Next.js frontend and an Express/MongoDB backend.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Redux Toolkit
- Backend: Node.js, Express 5, MongoDB, Mongoose
- Uploads: local storage or Cloudinary
- Email: Nodemailer with Brevo support

## What It Covers

- Product catalog with search, filters, categories, reviews, banners, and sponsored products
- User auth with JWT, refresh tokens, password reset, optional hCaptcha, and admin 2FA
- Cart, coupons, checkout, orders, returns, wishlist, and profile addresses
- Seller area for products, orders, and analytics
- Admin area for users, products, orders, returns, categories, coupons, media, banners, sponsored placements, email templates, and logs
- Contact form and analytics routes

## Project Structure

```text
backend/    Express API, MongoDB models, routes, services
frontend/   Next.js app, pages, components, Redux store
```

## Frontend Modules

- Public storefront: home, product listing, product details, policies, contact
- Shopper flows: auth, cart, checkout, orders, wishlist, profile
- Seller workspace: dashboard, analytics, product CRUD, order handling
- Admin workspace: operations dashboard + management pages

## Backend Modules

- Auth and security: login/register, refresh, password reset, role checks, 2FA
- Catalog: products, categories, search, reviews, sponsored placements
- Commerce: cart, coupons, orders, returns
- User data: profile and addresses
- Operations: analytics, logs, contact, banners, email templates, media

## API Route Groups

- `/api/auth`
- `/api/products`
- `/api/categories`
- `/api/search`
- `/api/reviews`
- `/api/cart`
- `/api/orders`
- `/api/wishlist`
- `/api/users`
- `/api/seller`
- `/api/admin`
- `/api/admin/emails`
- `/api/admin/media`
- `/api/admin/coupons`
- `/api/admin/banners`
- `/api/admin/sponsored`
- `/api/banners`
- `/api/sponsored`
- `/api/contact`
- `/api/analytics`
- `/api/health`

## Requirements

- Node.js
- MongoDB connection string
- Optional: Cloudinary account for cloud uploads
- Optional: Brevo API key for email sending
- Optional: hCaptcha keys for CAPTCHA

## Deployment

See [DEPLOY.md](DEPLOY.md) for Render (backend) + Vercel (frontend) setup, environment variables, CORS and cookies.

## Setup

Install backend dependencies:

```bash
cd backend
npm install
```

Create backend env:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=8080
NODE_ENV=development
MONGODB_URI=your_mongodb_uri
JWT_ACCESS_SECRET=replace_with_strong_secret
JWT_MFA_SECRET=replace_with_strong_secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
MFA_CHALLENGE_TTL=5m
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
STORAGE_MODE=local
MAX_UPLOAD_BYTES=20971520
EMAIL_PROVIDER=brevo
EMAIL_FROM=no-reply@example.com
EMAIL_FROM_NAME=Luxora
EMAIL_REPLY_TO=support@example.com
EMAIL_DISABLED=false
BREVO_API_KEY=
HCAPTCHA_SECRET=
ENABLE_TEST_EMAIL_ROUTE=false
TAX_RATE=0.05
RETURN_WINDOW_DAYS=7
```

Start backend:

```bash
npm run dev
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

Create frontend env:

```bash
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8080
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=
```

Start frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

Backend:

```bash
npm run dev
npm start
```

Frontend:

```bash
npm run dev
npm run build
npm start
npm run lint
```

## API Base

Backend runs on:

```text
http://localhost:8080/api
```

Health check:

```text
GET /api/health
```

## Auth Model

- Access token + refresh token flow
- Role-aware access for shopper/seller/admin/subadmin
- Optional hCaptcha check in login flow
- Admin/subadmin two-factor flow supported

## Upload and Email Modes

- Upload mode:
  - `STORAGE_MODE=local` uses local uploads
  - Cloudinary keys enable cloud upload flow
- Email mode:
  - `EMAIL_DISABLED=true` disables sending
  - Brevo key enables Brevo-backed email delivery

## Notes

- `backend/.env` and `frontend/.env.local` are local config files. Do not commit secrets.
- Set `STORAGE_MODE=local` for local uploads.
- Fill Cloudinary variables only when using Cloudinary uploads.
- Set `EMAIL_DISABLED=true` if email sending should be disabled locally.
- Set `ENABLE_TEST_EMAIL_ROUTE=true` only in non-production environments.

## License

ISC
