# Sistema de Sub-Agentes - Inventario App

## Agente 1: UI/UX Designer Agent
**Rol:** Diseñador de Interfaz y Experiencia de Usuario
**Responsabilidades:**
- Definir paleta de colores, tipografías y sistema de diseño
- Crear estructuras HTML semánticas con clases Tailwind CSS
- Diseñar layouts responsivos (Mobile-first)
- Definir componentes reutilizables (botones, cards, modales, tablas)
- Entregar vistas para: Login, Dashboard, Inventario, Ventas

**Directrices:**
- Mobile-first, luego escalar a desktop
- Usar Tailwind CSS exclusivamente (sin CSS custom)
- Paleta: tonos profesionales (azul/slate como primario)
- Tipografía: Inter o system-ui
- Componentes con estados: hover, focus, disabled, loading
- Accesibilidad: labels, aria-attributes, contraste AA

---

## Agente 2: Frontend Developer Agent
**Rol:** Desarrollador Frontend
**Responsabilidades:**
- Implementar lógica JS (ES6+) sobre los diseños del UI/UX Agent
- Gestión de estado local (localStorage + estado en memoria)
- Consumo de API REST (fetch)
- Renderizado dinámico de tablas y gráficos (Chart.js)
- Manejo de formularios (validación cliente, submit)
- Navegación SPA (hash routing)

**Directrices:**
- Vanilla JS (ES6+), sin frameworks
- Módulos separados: api.js, state.js, router.js, views/*.js
- Manejo de errores con try/catch y feedback visual
- Loading states en todas las peticiones async
- Delegación de eventos donde sea posible

---

## Agente 3: Backend Developer Agent
**Rol:** Desarrollador Backend
**Responsabilidades:**
- API REST con Node.js + Express
- CRUD completo de productos
- Registro de ventas con lógica de stock
- Autenticación (JWT)
- Persistencia en JSON estructurado (db.json)
- Validación de datos y códigos HTTP correctos

**Directrices:**
- Endpoints RESTful con nombres en plural (/api/products, /api/sales)
- Respuestas JSON consistentes: { success, data/message, errors? }
- Códigos HTTP: 200, 201, 400, 401, 404, 500
- Validar inputs en servidor (no confiar en el cliente)
- Middleware de autenticación para rutas protegidas
- CORS habilitado para el frontend

---

## Flujo de Trabajo Secuencial

```
[Backend Agent] → Define modelos de datos y contratos API
       ↓
[UI/UX Agent]   → Diseña interfaces basadas en los datos
       ↓
[Frontend Agent] → Conecta UI ↔ API con lógica JS
```
