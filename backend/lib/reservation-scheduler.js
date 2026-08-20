const supabase = require('./supabase');
const { createOrderFromReservation, reservationIsDue } = require('./reservation-orders');

function todayInBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

async function processDueReservations() {
  var { data, error } = await supabase
    .from('reservas')
    .select('id, nombre, telefono, fecha, hora, notas, estado, tipo_pedido, direccion_entrega, barrio_entrega, costo_domicilio, subtotal_platos, mesa_id, mesa_nombre, numero_venta, reserva_items(id, plato_id, plato_nombre, cantidad, precio_unitario, subtotal, notas)')
    .eq('estado', 'confirmada')
    .is('numero_venta', null)
    .gte('fecha', todayInBogota())
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true })
    .limit(200);
  if (error) throw error;

  var processed = 0;
  for (var i = 0; i < (data || []).length; i++) {
    if (!reservationIsDue(data[i])) continue;
    try {
      var order = await createOrderFromReservation(data[i]);
      if (order) processed++;
    } catch (err) {
      console.error('[reservation-scheduler] No se pudo generar pedido', data[i].id, err.message);
    }
  }
  return processed;
}

function startReservationScheduler() {
  if (process.env.VERCEL) return null;
  var run = function () {
    processDueReservations().catch(function (err) {
      console.error('[reservation-scheduler] Error:', err.message);
    });
  };
  run();
  return setInterval(run, 60 * 1000);
}

module.exports = { processDueReservations, startReservationScheduler };
