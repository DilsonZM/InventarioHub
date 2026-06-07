# InventarioApp — Design System

## Direction & Feel

**Intent:** Dashboard profesional para gestión de inventario y ventas. Sensación de herramienta confiable y eficiente, con toques modernos que transmiten productividad.

**Feel:** Limpio y funcional con profundidad sutil. No es frío ni corporativo — tiene calidez a través de gradientes suaves y micro-interacciones que dan vida.

## Depth Strategy

**Approach:** Layered shadows con borders sutiles

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

--border-subtle: rgba(226, 232, 240, 0.5);
--border-default: rgba(226, 232, 240, 0.8);
--border-strong: rgba(203, 213, 225, 1);
```

## Color Palette

**Base:**
- Background: `#f8fafc` (slate-50)
- Surface: `#ffffff`
- Surface elevated: `#ffffff` con shadow

**Brand:**
- Primary: `#3b82f6` → `#2563eb` (blue-500 → blue-600)
- Success: `#10b981` → `#059669` (emerald-500 → emerald-600)
- Warning: `#f59e0b` (amber-500)
- Danger: `#ef4444` (red-500)

**Accent:**
- Violet: `#8b5cf6` (violet-500) — para métricas de valor

**Text Hierarchy:**
- Primary: `#1e293b` (slate-800)
- Secondary: `#475569` (slate-600)
- Tertiary: `#64748b` (slate-500)
- Muted: `#94a3b8` (slate-400)

## Typography

**Font Family:**
- Body: `DM Sans` (sans-serif moderna, legible)
- Mono: `Space Mono` (monospace para datos, IDs, códigos)

**Fluid Type Scale:**
```css
--text-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.8rem);
--text-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem);
--text-base: clamp(0.9rem, 0.85rem + 0.25vw, 1rem);
--text-lg: clamp(1rem, 0.95rem + 0.25vw, 1.15rem);
--text-xl: clamp(1.1rem, 1rem + 0.5vw, 1.35rem);
--text-2xl: clamp(1.3rem, 1.1rem + 1vw, 1.75rem);
--text-3xl: clamp(1.6rem, 1.3rem + 1.5vw, 2.25rem);
```

## Spacing

**Base Unit:** 4px

**Scale:**
```css
--space-xs: clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem);   /* 4-8px */
--space-sm: clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem);    /* 8-12px */
--space-md: clamp(0.75rem, 0.6rem + 0.75vw, 1.25rem);  /* 12-20px */
--space-lg: clamp(1rem, 0.8rem + 1vw, 1.75rem);        /* 16-28px */
--space-xl: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem);     /* 24-40px */
```

## Border Radius

```css
--radius-sm: 0.5rem;   /* 8px - inputs, buttons pequeños */
--radius-md: 0.75rem;  /* 12px - cards, modales */
--radius-lg: 1rem;     /* 16px - contenedores grandes */
--radius-xl: 1.5rem;   /* 24px - modales grandes */
```

## Component Patterns

### Stat Card
- Background: white
- Border: `border border-slate-100/50`
- Padding: `p-5`
- Icon container: `w-11 h-11 rounded-xl bg-gradient-to-br from-{color}-50 to-{color}-100`
- Hover: `hover:shadow-lg hover:border-{color}-100`
- Animation: stagger fade con delay incremental

### Button Primary
- Background: `linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)`
- Hover: gradient más claro + `translateY(-1px)` + shadow azul
- Active: `scale(0.98)`
- Touch target: `min-height: 44px`

### Button Success
- Background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`
- Mismo patrón que primary con colores esmeralda

### Input
- Background: `bg-white` o `bg-slate-50` en filtros
- Border: `border border-slate-200`
- Focus: `ring-2 ring-blue-500/50 border-blue-500/50`
- Touch target: `min-height: 44px`

### Modal
- Overlay: `bg-black/50 backdrop-blur-sm`
- Container: `bg-white rounded-2xl shadow-2xl`
- Animation: `animate-scale-in` (0.3s ease-out)
- Header: border-bottom sutil
- Footer: bg-slate-50 para acciones

### Table Desktop
- Header: `bg-slate-50/50` con texto uppercase tracking-wider
- Rows: `hover:bg-slate-50 transition-colors`
- Dividers: `divide-y divide-slate-100`

### Cards Mobile
- Reemplazan tablas en < 768px
- Background: white con border
- Padding: `p-4`
- Spacing interno: `space-y-3`

## Animation

**Timing:**
- Micro-interactions: 150ms
- Modals: 250-300ms
- Page transitions: 400ms

**Easing:**
- Standard: `ease-out`
- Deceleration: `cubic-bezier(0.4, 0, 0.2, 1)`

**Patterns:**
- Stagger fade: elementos aparecen con delay incremental (50ms)
- Scale in: modales crecen desde 0.95
- Slide up: contenido sube desde 10px

## Responsive Strategy

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Patterns:**
- Tablas se convierten en cards en móvil
- Sidebar colapsable en tablet/móvil
- Touch targets mínimos de 44x44px
- Fluid typography con clamp()

## Accessibility

- Respetar `prefers-reduced-motion`
- Contraste AA en todos los textos
- Focus visible en todos los elementos interactivos
- Labels en todos los inputs
