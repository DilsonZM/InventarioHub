// routes/print.js
// Endpoint de impresion ESC/POS via red LAN.
// Recibe el JSON del pedido y la IP/puerto de la impresora termica,
// luego envia los comandos ESC/POS directamente al dispositivo.
//
// POST /api/print
// Body:
//   {
//     sale:   { id, numero_venta, createdAt, paymentMethod, items, total, ... },
//     kind:   'kitchen' | 'ticket'   (comanda o factura completa)
//     printer: { host, port }  (opcional; si no, lee de app_config)
//   }

const express = require('express');
const router = express.Router();
const net = require('net');
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const configRoutes = require('./config'); // Para acceder a memoryCache

// ============================================================
// Generador de comandos ESC/POS
// Replica exacta de la logica del frontend (pos.view.js > buildPrintDocument)
// pero produciendo bytes ESC/POS en lugar de HTML.
// ============================================================

function pad(str, len, align = 'left') {
  str = String(str);
  if (str.length >= len) return str.substring(0, len);
  const fill = ' '.repeat(len - str.length);
  return align === 'right' ? fill + str : str + fill;
}

function padLine(left, right, width) {
  const space = width - left.length - right.length;
  if (space < 1) return left.substring(0, width - right.length - 1) + ' ' + right;
  return left + ' '.repeat(space) + right;
}

function splitLongItem(name, qty, price, width) {
  const right = qty + ' ' + price;
  if ((name.length + right.length + 1) <= width) {
    return [padLine(name, right, width)];
  }
  return [name, ' '.repeat(Math.max(1, width - right.length)) + right];
}

function formatCurrency(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

function buildTicketCommands(sale, kind) {
  const LINE_WIDTH = 32;
  const cmds = [];
  const push = (s) => cmds.push(s);
  const pushBytes = (b) => cmds.push(b);

  // 1. Inicializar impresora
  pushBytes('\x1B\x40');

  // 2. Encabezado centrado
  pushBytes('\x1B\x61\x01'); // align center
  if (kind === 'kitchen') {
    push('COMANDA\n');
    push((sale.paymentMethod || 'cocina') + '\n');
  } else {
    push('CORNER HOUSE\n');
    push('Sabores que unen\n');
    push('NIT 900.000.000-1\n');
  }
  push('\n');

  // 3. Info pedido (izquierda)
  pushBytes('\x1B\x61\x00'); // align left
  push('-'.repeat(LINE_WIDTH) + '\n');

  const numero = sale.numero_venta || (sale.id ? sale.id.slice(-6) : '');
  push('Pedido: ' + numero + '\n');
  const fecha = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const fechaStr = fecha.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  push('Fecha: ' + fechaStr + '\n');
  var mesaLabel = sale.mesaNombre || sale.mesa_nombre || '';
  if (mesaLabel) push('Mesa: ' + mesaLabel + '\n');
  if (kind !== 'kitchen') {
    push('Cliente: ' + (sale.cliente_nombre || 'Consumidor final') + '\n');
    if (sale.usuario_nombre) push('Cajero: ' + sale.usuario_nombre + '\n');
  }
  push('-'.repeat(LINE_WIDTH) + '\n');

  // 4. Items
  const items = sale.items || [];
  let subtotal = 0;
  items.forEach((it) => {
    const qty = (it.cantidadPresentacion && it.factorConversion !== 1)
      ? it.cantidadPresentacion : it.quantity;
    const unit = it.unidadPresentacion || '';
    const unitPrice = Number(it.unitPrice) || 0;
    const sub = it.subtotal != null ? Number(it.subtotal) : (unitPrice * (Number(it.quantity) || 0));
    subtotal += sub;
    const name = it.productName || '';
    const etiqueta = (it.esPlato ? '*' : '') + (unit ? ' (' + unit + ')' : '');
    const fullName = name + etiqueta;
    const line = kind === 'kitchen'
      ? qty + 'x ' + name
      : padLine(fullName, formatCurrency(sub), LINE_WIDTH);
    // Si el nombre es largo, lo partimos en 2 lineas
    if (kind === 'kitchen') {
      // Comanda: nombre grande, ingredientes en linea aparte
      pushBytes('\x1B\x45\x01'); // bold on
      push(line + '\n');
      pushBytes('\x1B\x45\x00');
      if (it.nota) push('   Nota: ' + it.nota + '\n');
      if (it.ingredientesConsumidos && it.ingredientesConsumidos.length > 0) {
        it.ingredientesConsumidos.forEach((ing) => {
          push('   - ' + ing.nombre + ' ' + ing.cantidad + ' ' + (ing.unidad || '') + '\n');
        });
      }
    } else {
      const lines = splitLongItem(fullName, qty, formatCurrency(unitPrice), LINE_WIDTH);
      lines.forEach((l) => push(l + '\n'));
    }
  });

  // 5. Totales
  push('-'.repeat(LINE_WIDTH) + '\n');
  if (kind === 'kitchen') {
    // Comanda: solo resumen
    pushBytes('\x1B\x45\x01');
    push(padLine('TOTAL', formatCurrency(subtotal), LINE_WIDTH) + '\n');
    pushBytes('\x1B\x45\x00');
  } else {
    // Factura: subtotal, propina, totales
    push(padLine('Subtotal:', formatCurrency(subtotal), LINE_WIDTH) + '\n');
    const tip = Math.round(subtotal * 0.1);
    push(padLine('Propina Vol. (10%):', formatCurrency(tip), LINE_WIDTH) + '\n');
    push('='.repeat(LINE_WIDTH) + '\n');
    push(padLine('TOTAL (Sin propina):', formatCurrency(subtotal), LINE_WIDTH) + '\n');
    push(padLine('TOTAL (Con propina):', formatCurrency(subtotal + tip), LINE_WIDTH) + '\n');
    push('='.repeat(LINE_WIDTH) + '\n');
    push('\n');
    push('* La propina es voluntaria y sugerida. *\n');
    push('* Usted decide el valor a pagar.      *\n');
    push('\n');
    push('Forma de pago: ' + (sale.paymentMethod || 'efectivo') + '\n');
    push('Res. DIAN 18760000000001\n');
    push('Prefijo CH  Rango 1-999999\n');
  }
  push('\n');

  // 6. Corte de papel
  pushBytes('\x0A\x0A\x0A');
  pushBytes('\x1D\x56\x00'); // GS V 0 = full cut

  return cmds.join('');
}

// ============================================================
// Envio via TCP raw (sin libreria escpos para evitar dependencias nativas)
// Compatible con impresoras ESC/POS estandar que escuchan en puerto 9100.
// ============================================================

function sendToPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(10000);

    const onError = (err) => {
      socket.destroy();
      reject(err);
    };

    socket.once('error', onError);
    socket.once('timeout', () => onError(new Error('Timeout conectando a ' + host + ':' + port)));

    socket.connect(port, host, () => {
      socket.write(data, 'binary', (err) => {
        if (err) { onError(err); return; }
        // Esperar un poco para que la impresora procese
        setTimeout(() => {
          socket.end();
          resolve({ success: true, bytes: data.length });
        }, 500);
      });
    });
  });
}

// ============================================================
// Lectura de configuracion de impresora desde app_config
// ============================================================

async function getPrinterConfigFromDB() {
  // Primero usar la cache en memoria del modulo de config
  const mem = configRoutes.memoryCache;
  if (mem && mem.hasDbColumns) {
    return {
      host: mem.printerHost,
      port: mem.printerPort,
      enabled: mem.printerEnabled,
      comandaEnabled: mem.comandaEnabled
    };
  }
  // Intentar leer de BD
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('printer_host, printer_port, printer_enabled, comanda_enabled')
      .eq('id', 1)
      .single();
    if (error || !data) {
      return {
        host: mem ? mem.printerHost : '127.0.0.1',
        port: mem ? mem.printerPort : 9100,
        enabled: mem ? mem.printerEnabled : false,
        comandaEnabled: mem ? mem.comandaEnabled : false
      };
    }
    return {
      host: data.printer_host || (mem && mem.printerHost) || '127.0.0.1',
      port: parseInt(data.printer_port) || (mem && mem.printerPort) || 9100,
      enabled: !!(data.printer_enabled || (mem && mem.printerEnabled)),
      comandaEnabled: !!(data.comanda_enabled || (mem && mem.comandaEnabled))
    };
  } catch (err) {
    console.warn('print: error leyendo config de BD, usando cache en memoria:', err.message);
    return {
      host: (mem && mem.printerHost) || '127.0.0.1',
      port: (mem && mem.printerPort) || 9100,
      enabled: !!(mem && mem.printerEnabled),
      comandaEnabled: !!(mem && mem.comandaEnabled)
    };
  }
}

// ============================================================
// ENDPOINT POST /api/print
// ============================================================

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { sale, kind = 'ticket', printer } = req.body;

    if (!sale || !sale.items || !Array.isArray(sale.items)) {
      return res.status(400).json({
        success: false,
        message: 'Falta el campo "sale" o "sale.items" en el body'
      });
    }
    if (!['ticket', 'kitchen'].includes(kind)) {
      return res.status(400).json({
        success: false,
        message: 'kind debe ser "ticket" o "kitchen"'
      });
    }

    // Resolver host/port: del body, o de la BD
    let host, port;
    if (printer && printer.host && printer.port) {
      host = printer.host;
      port = parseInt(printer.port);
    } else {
      const cfg = await getPrinterConfigFromDB();
      host = cfg.host;
      port = cfg.port;
    }

    // Generar comandos ESC/POS
    const data = buildTicketCommands(sale, kind);

    // Enviar por TCP
    const result = await sendToPrinter(host, port, data);

    return res.json({
      success: true,
      data: {
        host: host,
        port: port,
        bytes: result.bytes,
        kind: kind,
        message: kind === 'kitchen' ? 'Comanda enviada a cocina' : 'Factura enviada a impresora'
      }
    });
  } catch (err) {
    console.error('print error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al imprimir: ' + (err.message || 'desconocido'),
      hint: 'Verifica que la IP de la impresora sea correcta, que la impresora este encendida y que el puerto ' + (req.body && req.body.printer && req.body.printer.port || 9100) + ' este abierto.'
    });
  }
});

// GET /api/print/test - prueba conexion sin imprimir
router.get('/test', authMiddleware, async (req, res) => {
  try {
    const cfg = await getPrinterConfigFromDB();
    const host = (req.query.host || cfg.host);
    const port = parseInt(req.query.port || cfg.port);

    const result = await new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('Timeout')));
      socket.connect(port, host, () => {
        socket.end();
        resolve(true);
      });
    });

    return res.json({ success: true, data: { host, port, reachable: result } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'No se puede conectar a ' + req.query.host + ':' + req.query.port + ' - ' + err.message
    });
  }
});

module.exports = router;
