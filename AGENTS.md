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

- **Persistence**: `backend/db.json` — read/written directly by `backend/models/db.js`. Mutations (product CRUD, sales) modify this file on disk. Reset by restoring from git.
- **Auth**: JWT in `Authorization: Bearer <token>`. Passwords are SHA-256 hex digests (not bcrypt). Middleware in `backend/middleware/auth.js`.
- **Roles**: `admin` (full CRUD on products) and `vendedor` (read products, create sales). Product create/update/delete routes use `adminOnly` middleware.
- **Frontend**: Vanilla JS (no framework). Single-page app with hash routing (`#dashboard`, `#inventory`, `#sales`). All JS files are plain scripts (not ES modules) loaded via `<script>` tags. Global `API` object in `js/api.js` wraps fetch calls.
- **Styling**: Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`). Font: DM Sans (body) + Space Mono (monospace) via Google Fonts.
- **Responsive**: Mobile-first design with fluid typography (CSS clamp()), responsive tables (cards on mobile), touch targets 44x44px minimum, dynamic viewport units (dvh), and prefers-reduced-motion support.
- **Design System**: See `.interface-design/system.md` for tokens, patterns, and conventions.

## Demo credentials

| User | Password | Role |
|------|----------|------|
| `admin` | `admin123` | admin |
| `vendedor1` | `admin123` | vendedor |

## Conventions

- API responses: `{ success: boolean, data?: any, message?: string }`
- API prefix: `/api` — auth (`/api/auth`), products (`/api/products`), sales (`/api/sales`), stats (`/api/stats`)
- Product delete is soft-delete (sets `active: false`)
- Sale creation atomically decrements stock; rejects if any item exceeds available stock
- UI language is Spanish; keep user-facing strings in Spanish

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
