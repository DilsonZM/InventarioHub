// Helpers de timezone para el backend
// La app trabaja en UTC-5 (Bogota/Colombia).
// Cuando el frontend envia 'from=2026-06-07', eso es la fecha en Bogota.
// Para filtrar correctamente en Supabase (que almacena en UTC), hay que
// convertir al rango UTC equivalente:
//   Bogota 2026-06-07 00:00:00 -05:00  =  UTC 2026-06-07 05:00:00
//   Bogota 2026-06-07 23:59:59 -05:00  =  UTC 2026-06-08 04:59:59

const APP_TZ_OFFSET_MINUTES = -5 * 60; // UTC-5 en minutos

function bogotaDateToUtcRange(dateStr, isEnd) {
  if (!dateStr) return null;
  // dateStr viene como 'YYYY-MM-DD' (sin hora)
  // Construimos el inicio (00:00:00) o fin (23:59:59.999) del dia en Bogota
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;

  // El dia en Bogota desde 00:00 hasta 23:59:59
  // Sumamos el offset inverso para obtener el UTC equivalente
  const startBogotaMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endBogotaMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  // Bogota esta en UTC-5, asi que la hora local = UTC - 5h
  // Para obtener el UTC equivalente de un instante local, SUMAMOS 5h
  // Ej: Bogota 2026-06-07 00:00:00 -> UTC 2026-06-07 05:00:00
  const startUtcMs = startBogotaMs - APP_TZ_OFFSET_MINUTES * 60 * 1000;
  const endUtcMs = endBogotaMs - APP_TZ_OFFSET_MINUTES * 60 * 1000;

  return isEnd
    ? new Date(endUtcMs).toISOString()
    : new Date(startUtcMs).toISOString();
}

// Para filtros que el frontend manda como fecha Bogota
function applyBogotaDateFilter(query, dateColumn, fromBogota, toBogota) {
  if (fromBogota) {
    const utcFrom = bogotaDateToUtcRange(fromBogota, false);
    if (utcFrom) query = query.gte(dateColumn, utcFrom);
  }
  if (toBogota) {
    const utcTo = bogotaDateToUtcRange(toBogota, true);
    if (utcTo) query = query.lte(dateColumn, utcTo);
  }
  return query;
}

module.exports = {
  APP_TZ_OFFSET_MINUTES,
  bogotaDateToUtcRange,
  applyBogotaDateFilter,
};
