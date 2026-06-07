# Commit History - InventarioApp

Este documento registra los cambios principales del proyecto siguiendo **Conventional Commits**.

## Formato

```
<type>(<scope>): <description>

[body]

[footer]
```

## Historial de Cambios

### 2026-06-07

#### `perf(frontend): add caching and lazy rendering optimizations`

**Cambios:**
- Added `utils.js` with LRU cache for `formatCurrency` and `formatDate` functions
- Implemented CSS `content-visibility: auto` for lazy rendering of long tables and card lists
- Versioned localStorage keys with `:v1` suffix to prevent schema conflicts
- Wrapped all localStorage operations in try-catch for incognito/private browsing support
- Extracted shared utilities (debounce, throttle, escapeHtml) to dedicated module

**Impact:**
- Reduced redundant function calls by caching formatted values
- Improved scroll performance with content-visibility for 100+ item lists
- Prevented storage quota errors in private browsing mode

**References:**
- Based on `vercel-react-best-practices` skill (js-cache-function-results, rendering-content-visibility, client-localstorage-schema)

---

#### `chore(deploy): add Vercel configuration`

**Cambios:**
- Added `vercel.json` with Node.js build configuration
- Configured routing to serve Express backend as serverless function
- Set up automatic deployments from GitHub main branch

**Impact:**
- Enabled one-click deployments via Vercel CLI
- Reduced deployment time to ~12 seconds

---

#### `feat(core): initial InventarioApp implementation`

**Características:**
- Backend: Node.js + Express REST API with JWT authentication
- Frontend: Vanilla JS with Tailwind CSS and Chart.js
- Role-based access control (admin/vendedor)
- Dashboard with real-time metrics and category sales chart
- Full CRUD for products with search and category filters
- Point-of-sale system with automatic stock deduction
- Responsive mobile-first design with fluid typography
- Design system with tokens, animations, and component patterns

**Skills instaladas:**
- `frontend-design` - Estética visual y animaciones
- `responsive-design` - Adaptabilidad móvil/desktop
- `interface-design` - Metodología de diseño para dashboards
- `git-commit` - Mensajes de commit estructurados
- `vercel-cli-with-tokens` - Despliegue automatizado
- `vercel-react-best-practices` - Optimización de rendimiento

**Estructura:**
```
inventory-app/
├── backend/          # Express API + JWT auth
├── frontend/         # Vanilla JS SPA
│   ├── js/          # api.js, utils.js, app.js, auth.js
│   └── views/       # login.html
├── docs/            # API contract, agent guidelines
└── .agents/skills/  # 6 skills instaladas
```

---

## Tipos de Commit

| Type | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bugs |
| `perf` | Mejoras de rendimiento |
| `refactor` | Refactorización sin cambios funcionales |
| `docs` | Documentación |
| `style` | Formato, espacios, puntos y comas |
| `test` | Agregar o actualizar tests |
| `chore` | Mantenimiento, dependencias, configuración |
| `ci` | Cambios en CI/CD |
| `build` | Sistema de build o dependencias |

## Scopes del Proyecto

| Scope | Área |
|-------|------|
| `core` | Arquitectura general |
| `backend` | API, rutas, middleware |
| `frontend` | UI, componentes, estilos |
| `auth` | Autenticación y autorización |
| `deploy` | Configuración de despliegue |
| `docs` | Documentación |

## Enlaces

- **GitHub**: https://github.com/DilsonZM/InventarioHub
- **Producción**: https://inventory-app-one-azure.vercel.app
