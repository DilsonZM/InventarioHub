// lib/phone.js
// Normalizacion y validacion de numeros de WhatsApp (Colombia).
//
// Formatos aceptados:
//   3001234567            -> +573001234567
//   300 123 4567          -> +573001234567
//   +57 300 123 4567      -> +573001234567
//   573001234567          -> +573001234567
//
// Regla: celular colombiano de 10 digitos que empieza por 3.
// Devuelve null si el numero no es valido.

function normalizePhone(raw) {
  var digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.slice(0, 2) === '57') {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 || digits[0] !== '3') return null;
  return '+57' + digits;
}

function isValidPhone(raw) {
  return normalizePhone(raw) !== null;
}

// Formato legible: +57 300 123 4567
function formatPhone(normalized) {
  if (!normalized || normalized.length !== 13) return normalized || '';
  return normalized.slice(0, 3) + ' ' + normalized.slice(3, 6) + ' ' + normalized.slice(6, 9) + ' ' + normalized.slice(9);
}

module.exports = { normalizePhone, isValidPhone, formatPhone };
