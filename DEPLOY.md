# Despliegue: Render (backend) + Vercel (frontend)

| Pieza | Servicio | URL de ejemplo |
|---|---|---|
| Frontend (Next.js) | Vercel | `https://luxora-qa.vercel.app` |
| Backend (Express) | Render, plan Free | `https://luxora-api.onrender.com` |
| Base de datos | MongoDB Atlas M0 | `mongodb+srv://…` |
| Archivos subidos | Cloudinary | `https://res.cloudinary.com/…` |

Sustituye `luxora-qa` y `luxora-api` por los nombres reales de tus proyectos en todo este documento.

## Cómo funciona (cookies y CORS)

El navegador **solo habla con Vercel**. Next.js reenvía `/api/*` y `/uploads/*` al backend de Render mediante los `rewrites` de [frontend/next.config.ts](frontend/next.config.ts):

```
Navegador ──► luxora-qa.vercel.app/api/... ──(rewrite)──► luxora-api.onrender.com/api/...
```

- La cookie del refresh token (`rt`, `HttpOnly`, `Secure`, `SameSite=Lax`) queda guardada en el dominio de Vercel, así que es *first-party*. No depende de cookies de terceros, que Safari y Chrome bloquean, y el código de cookies no cambia.
- Vercel reenvía la cabecera `Origin`, así que el backend sigue validando CORS. `CORS_ORIGINS` admite orígenes exactos y `CORS_ORIGIN_REGEX` admite las URLs de preview.
- Hay dos proxies delante de Express (Vercel y el balanceador de Render), por eso `TRUST_PROXY=2`. Así `req.ip` es la IP real del cliente y el rate limit de login no se comparte entre usuarios.

## 1. MongoDB Atlas

1. Crea un cluster **M0** (gratis).
2. En **Database Access**, crea un usuario con contraseña.
3. En **Network Access**, añade `0.0.0.0/0`, porque Render Free no tiene IPs fijas.
4. En **Connect → Drivers**, copia la URI y añade el nombre de la base:
   `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/luxora?retryWrites=true&w=majority`

## 2. Cloudinary

En el Dashboard, copia **Cloud name**, **API key** y **API secret**. El disco de Render se borra en cada despliegue, por eso los uploads van a Cloudinary (`STORAGE_MODE=cloud`).

## 3. Backend en Render

1. **New → Blueprint** y elige este repositorio. Render lee [render.yaml](render.yaml).
2. Rellena las variables que pide:

| Variable | Valor |
|---|---|
| `MONGODB_URI` | URI de Atlas del paso 1 |
| `FRONTEND_URL` | `https://luxora-qa.vercel.app` (se usa en los enlaces de los emails) |
| `CORS_ORIGINS` | `https://luxora-qa.vercel.app` (varios, separados por comas) |
| `CORS_ORIGIN_REGEX` | `^https://luxora-qa(-[a-z0-9-]+)?\.vercel\.app$` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | del paso 2 |
| `BREVO_API_KEY` | vacío (emails desactivados) o tu clave |
| `HCAPTCHA_SECRET` | vacío (captcha desactivado) o tu clave |

   Si aún no conoces la URL de Vercel, pon un valor provisional y cámbialo en el paso 5.

3. El blueprint ya define `NODE_ENV=production`, `TRUST_PROXY=2`, `STORAGE_MODE=cloud` y `EMAIL_DISABLED=true`, y genera `JWT_ACCESS_SECRET` y `JWT_MFA_SECRET` automáticamente.
4. Cuando termine, comprueba: `https://luxora-api.onrender.com/api/health` → `{"status":"ok",...}`

Para enviar emails: pon `EMAIL_DISABLED=false`, `BREVO_API_KEY` y un `EMAIL_FROM` verificado en Brevo.

## 4. Frontend en Vercel

1. **Add New → Project** e importa este repositorio.
2. **Root Directory:** `frontend`. Vercel detecta Next.js y no hace falta `vercel.json`.
3. En **Environment Variables**, marca *Production* y *Preview*:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `/api` |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | `https://luxora-api.onrender.com` |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | vacío o tu site key |

4. Haz clic en **Deploy**.

> Las variables `NEXT_PUBLIC_*` se incrustan al compilar. Si las cambias, vuelve a desplegar (**Deployments → Redeploy**).

## 5. Cerrar el circuito

Con la URL final de Vercel, actualiza `FRONTEND_URL`, `CORS_ORIGINS` y `CORS_ORIGIN_REGEX` en Render. Render reinicia el servicio solo.

## 6. Datos iniciales (opcional)

Desde tu máquina, en `backend/`:

```powershell
$env:MONGO_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/luxora"; node src/scripts/seed.js
```

> ⚠️ El seed **borra todos los usuarios y productos**. Úsalo solo con una base vacía.

Crea `admin@luxora.com`, `seller@luxora.com` y `user@luxora.com`, todos con la contraseña `password123`. Cámbialas después. El admin pide enrolar 2FA (TOTP) en el primer login.

## 7. Plan Free de Render: arranque en frío

El servicio se duerme tras 15 minutos sin tráfico. La primera petición tarda unos 50 segundos y a través del proxy de Vercel puede agotar el tiempo de espera; si pasa, recarga. Para evitarlo, programa un ping a `https://luxora-api.onrender.com/api/health` cada 10 minutos (con cron-job.org, UptimeRobot o similar). Un solo servicio encendido todo el mes cabe en las 750 h gratis.

## Verificación

- [ ] `https://luxora-api.onrender.com/api/health` responde `ok`.
- [ ] `https://luxora-qa.vercel.app/api/health` responde lo mismo, lo que confirma el proxy.
- [ ] Inicia sesión con `user@luxora.com`. En DevTools → Application → Cookies, `rt` aparece en `luxora-qa.vercel.app` con `HttpOnly`, `Secure` y `Lax`.
- [ ] Al recargar la página sigues con la sesión abierta.
- [ ] Admin: el login con 2FA funciona, y al subir una imagen se guarda una URL `res.cloudinary.com/...`.
- [ ] IP real: haz un login fallido desde dos redes distintas (wifi y datos móviles). La cabecera `X-RateLimit-Remaining` de `/api/auth/login` debe llevar un contador independiente en cada red. Si comparten contador, prueba `TRUST_PROXY=3`.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `500` y en los logs `CORS origin not allowed` | Falta el origen en `CORS_ORIGINS` o no encaja con `CORS_ORIGIN_REGEX`. |
| La sesión se pierde al recargar | `NEXT_PUBLIC_API_BASE_URL` no es `/api`, así que el navegador llama directo a Render y la cookie es de terceros. Corrígelo y vuelve a desplegar. |
| `504` en la primera carga | El backend estaba dormido (plan Free). Recarga o configura el ping. |
| Las imágenes subidas desaparecen | `STORAGE_MODE` no es `cloud`. |
| `429 Too many requests` para todos | `TRUST_PROXY` es incorrecto y todos comparten IP. Ver la verificación de IP real. |
