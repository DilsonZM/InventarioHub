// components/toast.js
// Notificacion toast basada en SweetAlert2 (Swal).
// Usa el mixin recomendado: top-end, 3s, timerProgressBar,
// pausa al hacer hover (mouseenter/mouseleave -> stopTimer/resumeTimer).
//
// Antes: showToast() con DOM custom. Ahora: Swal.mixin() para
// mantener la UX consistente con el resto del sistema y soportar
// pausa en hover.

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

const ICON_MAP = {
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
  warn: 'warning'
};

export function showToast(message, type) {
  if (typeof Swal === 'undefined') {
    // Fallback silencioso si Swal no esta disponible.
    console.log('[toast]', type || 'info', message);
    return;
  }
  var icon = ICON_MAP[(type || 'info').toLowerCase()] || 'info';
  Toast.fire({ icon: icon, title: message });
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
  // Exponer Swal y Toast para vistas que quieran usar el sistema
  // completo de SweetAlert2 (confirmaciones, loading, etc).
  window.Swal = Swal;
  window.SwalToast = Toast;
}
