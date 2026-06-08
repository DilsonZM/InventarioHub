# Propuesta Comercial — Sistema de Control de Inventario

> Documento generado el 2026-06-07 · InventarioHub
> Contacto: [Tu nombre / marca] · [tu-correo] · [WhatsApp]

---

## 1. Resumen Ejecutivo

**Sistema de Control de Inventario** es una aplicación web profesional que reemplaza el uso de planillas Excel para llevar el control de materia prima en tiendas de comida rápida.

Está diseñada para:
- Registrar **entradas** (compras, llegadas de proveedor)
- Registrar **salidas** (consumos por cocina)
- Mostrar **dashboard con alertas** de stock bajo en tiempo real
- Funcionar desde **computador, tablet y celular**
- Permitir **múltiples usuarios** con roles diferenciados
- **Respaldar** todos los datos automáticamente en la nube

---

## 2. El Problema

Si hoy usás Excel para llevar el inventario de tu tienda, seguro te pasa alguno de esto:

| # | Problema | Impacto real |
|---|----------|--------------|
| 1 | No sabés el stock real en el momento | Te quedás sin producto a media jornada |
| 2 | Varias personas editan el mismo archivo | Se pisan los datos, se pierde información |
| 3 | No podés ver el inventario desde el celular | Tenés que volver a la tienda para consultar |
| 4 | No hay control de quién modificó qué | Nadie se hace cargo de los errores |
| 5 | Si se daña el computador o se borra el archivo | Perdés todo el histórico |

---

## 3. La Solución

Una **aplicación web moderna** a la que acceden todos los usuarios desde cualquier dispositivo. El inventario se actualiza en tiempo real, queda respaldado en la nube, y cada acción queda registrada con fecha, hora y usuario.

### ¿Por qué web y no Excel?

| Característica | Excel | Esta app |
|---|---|---|
| Varios usuarios al tiempo | ❌ | ✅ |
| Acceso desde celular | ❌ | ✅ |
| Respaldo automático | ❌ | ✅ |
| Control de roles y permisos | ❌ | ✅ |
| Alertas automáticas de stock bajo | ❌ | ✅ |
| Auditoría (quién hizo qué) | ❌ | ✅ |
| Funciona sin internet | ✅ | Parcialmente (PWA) |
| Costo de mantenimiento | Tu tiempo | Incluido |

---

## 4. Features Clave

### 📦 Inventario
- Productos con nombre, categoría, proveedor, SKU
- Stock actual y stock mínimo configurable
- Unidad de medida (kg, litros, unidades, etc.)
- Búsqueda y filtros por categoría
- Alertas visuales de stock bajo

### 📥 Entradas
- Registro de compras/llegadas
- Cantidad, precio, proveedor, fecha
- Actualización automática del stock

### 📤 Salidas
- Registro de consumos
- Selección de cocina (Cocina 1, Cocina 2, Cocina 3…)
- Productos con cantidad
- Descuento automático de stock

### 📊 Dashboard y Alertas
- Estadísticas en tiempo real
- **Alertas de stock bajo** (te avisa antes de que te quedés sin producto)
- Top productos más usados
- Movimientos del día
- Gráficos de distribución

### 👥 Usuarios y Roles
- 5 usuarios configurados (2 admin + 3 atendientes)
- Cada rol con permisos diferenciados
- Login seguro con contraseña encriptada
- Autenticación JWT

### 📱 Acceso Multi-dispositivo
- Computador, tablet, celular
- Tema claro/oscuro
- Diseño responsive

---

## 5. Seguridad y Roles

| Rol | Cantidad | Permisos |
|---|---|---|
| **Administrador** | 2 | Crear/editar/eliminar productos, ver reportes, gestionar usuarios, ver auditoría completa |
| **Atendiente** | 3 | Solo registrar entradas y salidas, consultar inventario (sin edición ni eliminación) |

### Seguridad técnica
- Contraseñas encriptadas con **bcrypt**
- Autenticación con **JWT** (tokens firmados)
- **HTTPS** (candadito verde) en todas las conexiones
- **Auditoría**: cada acción queda registrada con usuario, fecha y hora
- **Backups automáticos** diarios en la nube

---

## 6. Paquetes y Precios

### 🥉 Paquete Inicial — $500.000 (pago único)

Incluye:

- ✅ Web app completa con todas las features listadas
- ✅ 5 usuarios configurados (2 admin + 3 atendientes)
- ✅ Dominio .com a tu nombre, 1 año incluido
- ✅ SSL + despliegue profesional
- ✅ Branding personalizado (logo + colores)
- ✅ Capacitación de 2h por videollamada
- ✅ Soporte para corrección de errores: **3 meses**
- ✅ Reportes básicos
- ✅ Hosting gratuito (Vercel + Supabase free tier)

**Costo de infraestructura para vos: $0/mes** (los free tiers alcanzan para 5 usuarios por 2-3 años).

---

### 🥈 Paquete Profesional — $1.200.000 (pago único)

Todo lo del Inicial **más**:

- ✅ Soporte para corrección de errores: **12 meses** (en vez de 3)
- ✅ 3 reportes personalizados a elección
- ✅ Alertas por email/WhatsApp de stock bajo
- ✅ Módulo de auditoría avanzado (ver quién hizo qué y cuándo)
- ✅ Capacitación presencial de 3h
- ✅ Backups diarios automáticos verificados
- ✅ Prioridad en soporte (respuesta en 24h)

---

### 🥇 Paquete Premium — $2.500.000 (pago único)

Todo lo del Profesional **más**:

- ✅ Multi-sucursal (ilimitadas, factura única por tienda)
- ✅ App móvil nativa optimizada (PWA)
- ✅ Integración con facturación electrónica DIAN
- ✅ Soporte prioritario 24/7
- ✅ Actualizaciones de seguridad de por vida

---

### Mantenimiento mensual (a partir del año 2)

| Concepto | Valor |
|---|---|
| Mensualidad (hosting + backups + soporte + updates) | $150.000/mes |
| Pack anual (20% descuento = 2 meses gratis) | $1.440.000/año |
| **Equivale a** | **$120.000/mes** con el descuento |

> El **primer año** de mantenimiento y soporte para bugs va **incluido** en el Paquete Inicial/Profesional. Desde el año 2 en adelante, se contrata aparte.

---

### Módulos nuevos (a futuro)

| Tipo | Ejemplo | Precio |
|---|---|---|
| Pequeño | Campo extra, reporte nuevo, exportar PDF | $400.000 – $800.000 |
| Mediano | Facturación electrónica, lector de código de barras, integración WhatsApp | $1.500.000 – $3.000.000 |
| Grande | Multi-sucursal, e-commerce, app móvil nativa | $5.000.000+ |

---

## 7. Proyección de Inversión a 3 Años

Ejemplo conservador con el **Paquete Inicial + módulos** + mantenimiento:

| Año | Concepto | Valor |
|---|---|---|
| 1 | Setup Paquete Inicial | $500.000 |
| 1 | 1 módulo pequeño (ej. exportar reportes PDF) | $500.000 |
| 2 | Pack anual mantenimiento (20% off) | $1.440.000 |
| 3 | Pack anual mantenimiento | $1.440.000 |
| 3 | 1 módulo mediano (ej. alertas WhatsApp) | $1.500.000 |
| **Total 3 años** | | **$5.380.000** |

> **Equivale a $150.000/mes** durante 3 años para tener un sistema de inventario profesional con todas las features que vas necesitando.

---

## 8. Comparación con Alternativas

| Solución | Costo | Tiempo | Limitaciones |
|---|---|---|---|
| Excel personalizado | $300k – $800k (pago único al freelancer) | 1-2 semanas | No escalable, no mobile, sin auditoría |
| App inventario pre-hecha (SaaS) | $1.5M – $3M/año | Inmediato | No personalizable, dependiente del proveedor |
| **Esta propuesta (Inicial)** | **$500k setup + $1.4M/año mantenimiento** | **5-7 días** | **Tuyo, escalable, personalizable** |
| App a medida desde cero | $4M – $8M | 2-3 meses | Caro, lento, mismo resultado |

---

## 9. Soporte y Alcance

### ¿Qué es "soporte para bugs"?

Es la corrección de **errores no previstos** de la aplicación. Por ejemplo:
- Un botón que no hace lo que debería
- Un cálculo que da un valor incorrecto
- Un error 500 inesperado
- Problemas de despliegue o hosting

**Tiempo de respuesta**: 24-48h hábiles.

### ¿Qué NO incluye el soporte?

- **Mejoras o features nuevas** (ej: "quiero un campo nuevo", "agregame un reporte")
- **Capacitación adicional** después de la inicial
- **Cambios de configuración** (ej: agregar productos, categorías)
- **Migración de datos** desde otro sistema

Estos servicios se cotizan por separado.

### Canales de soporte
- WhatsApp (respuesta en horario laboral)
- Email
- Videollamada (solo Paquete Profesional/Premium)

---

## 10. Próximos Pasos

1. **Aprobación de la cotización** (50% anticipo, 50% contra entrega)
2. **Despliegue y configuración** (5-7 días hábiles)
   - Registro del dominio
   - Configuración de branding (logo + colores)
   - Alta de los 5 usuarios con sus roles
2. **Capacitación** (2h por videollamada o 3h presencial según paquete)
3. **Go-live** y acompañamiento durante la primera semana
4. **Cierre** con entrega de credenciales y documentación

---

## 11. Forma de Pago

| Concepto | Detalle |
|---|---|
| Setup | 50% al firmar · 50% contra entrega |
| Mantenimiento mensual | Por transferencia o PSE, primeros 5 días del mes |
| Pack anual | Pago único al inicio del año |
| Módulos | 50% al aprobar · 50% al entregar |

---

## 12. Garantías

- ✅ **14 días de garantía** después de la entrega: si no estás conforme con el setup inicial, se devuelve el 100% del anticipo
- ✅ **Código fuente** entregado al cliente al finalizar el contrato (es tuyo, no te quedás atado)
- ✅ **Tus datos son tuyos**: exportación completa disponible en cualquier momento (CSV, JSON)
- ✅ **Cancelación sin penalidad**: podés dar de baja el mantenimiento en cualquier momento, llevándote tus datos

---

*Documento confidencial preparado exclusivamente para [Nombre del Negocio].*
*Validez de la cotización: 30 días.*
