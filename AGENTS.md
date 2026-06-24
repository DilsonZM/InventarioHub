# AGENTS.md

## Commands

```bash
cd backend && npm install
npm start          # production — http://localhost:3000
npm run dev        # watch mode (node --watch, requires Node 18+)
```

No test, lint, typecheck, or build step exists. No frontend build — Tailwind and Chart.js load via CDN.

## Architecture

Single Express server (`backend/server.js`) serves both the API and the frontend as static files from `../frontend`. There is no separate frontend dev server.

- **Persistence**: Supabase PostgreSQL (`https://zosuleqcmhwoivbjurew.supabase.co`). All CRUD operations use the `@supabase/supabase-js` client with service role key. The legacy `db.json` file has been removed.
- **Auth**: JWT in `Authorization: Bearer <token>`. Passwords use bcrypt (bcryptjs). Middleware in `backend/middleware/auth.js`.
- **Roles**: `admin` (full CRUD on products) and `vendedor` (read products, create sales). Product create/update/delete routes use `adminOnly` middleware.
- **Frontend**: Vanilla JS **ES modules** (no framework, no build step). Single-page app with hash routing (`#dashboard`, `#inventory`, `#sales`, `#entradas`, `#movimientos`, `#dishes`, `#users`, `#config`, `#pos`). The app is organized in 5 layers:
  - `js/core/` — primitives (DOM, store, events, permissions, router, PWA).
  - `js/components/` — reusable UI (filters, calendar, chart, ticket, permissions-grid, table, modal, toast).
  - `js/services/` — data access (products, dishes, sales, purchases, users, config, reports, units).
  - `js/views/` — one file per view (dashboard, inventory, sales, purchases, movements, dishes, users, config, pos).
  - `js/shell/` — persistent chrome (sidebar, header, user).
  - `js/main.js` orchestrates the bootstrap (PWA registration, user bootstrap, event delegation, modal delegation, shell init, permission application, router init, view initializers).
  - `js/compat.js` is a thin shim that re-exposes the public API in `window.*` for the inline `onclick="window.foo()"` HTML handlers and any third-party code that expects globals.
  - Global `API` object in `js/api.js` wraps fetch calls. The `window.*` re-exports of every view keep backward compatibility with HTML inline handlers.
- **Styling**: Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`). Font: DM Sans (body) + Space Mono (monospace) via Google Fonts.
- **Responsive**: Mobile-first design with fluid typography (CSS clamp()), responsive tables (cards on mobile), touch targets 44x44px minimum, dynamic viewport units (dvh), and prefers-reduced-motion support.
- **Design System**: See `.interface-design/system.md` for tokens, patterns, and conventions.

## Database

Schema managed via Supabase CLI migrations in `supabase/migrations/`. Tables:

| Table | Purpose |
|-------|---------|
| `perfiles` | Users (username, bcrypt password_hash, role) |
| `categorias` | Product categories |
| `proveedores` | Suppliers |
| `productos` | Products with stock, pricing, SKU |
| `movimientos_inventario` | Inventory movement audit log |
| `ventas` | Sales headers |
| `venta_detalles` | Sale line items |

Functions: `registrar_movimiento()` for stock operations, `procesar_venta()` for atomic sale creation.
RLS enabled on all tables with permissive `Allow backend access` policies.

## Demo credentials

| User | Password | Role |
|------|----------|------|
| `admin` | `admin123` | admin |
| `vendedor1` | `admin123` | vendedor |

## Conventions

- API responses: `{ success: boolean, data?: any, message?: string }`
- API prefix: `/api` — auth (`/api/auth`), products (`/api/products`), sales (`/api/sales`), stats (`/api/stats`)
- Product delete is soft-delete (sets `activo: false`)
- Sale creation atomically decrements stock via `procesar_venta()` RPC
- UI language is Spanish; keep user-facing strings in Spanish

## Environment

Create `backend/.env` from `backend/.env.example`:

```env
SUPABASE_URL=https://zosuleqcmhwoivbjurew.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
JWT_SECRET=<random-secret>
PORT=3000
```

## Design Skills Installed

Three design skills are installed in `.agents/skills/`:

1. **frontend-design** — Estética visual distintiva, tipografía, colores, animaciones
2. **responsive-design** — Adaptabilidad móvil/desktop, fluid typography, breakpoints
3. **interface-design** — Metodología de diseño para dashboards/apps, patrones de UI/UX

When making UI changes, consult these skills for best practices. The `interface-design` skill includes a critique protocol for evaluating craft quality.

## Key UI Features

- **Login animations**: Fade/scale exit animation when transitioning to dashboard
- **Dashboard animations**: Staggered fade-in for stat cards on load
- **Sale detail modal**: Elegant modal (not alert) with gradient header, itemized list, and total
- **Sales filters**: Date range, payment method, quick periods (today/week/month/quarter/year), with summary stats
- **Responsive tables**: Desktop shows tables, mobile shows card layouts
