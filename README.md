# Luxora E-Commerce

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
