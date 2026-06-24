import { $ } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { loadPrinterConfigUI } from '../services/config.js';

// config.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

async function loadConfig() {
  if (!window.can('puedeGestionarUsuarios')) return;
  try {
    var res = await API.config.get();
    $('#modoPublicoCheck').checked = !!res.data.modoPublico;
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
  if (typeof loadPrinterConfigUI === 'function') loadPrinterConfigUI();
}

async function saveConfig() {
  var modoPublico = $('#modoPublicoCheck').checked;
  try {
    await API.config.update({ modoPublico: modoPublico });
    showToast('Configuracion guardada. ' + (modoPublico ? 'Los visitantes ya pueden entrar.' : 'Acceso publico deshabilitado.'), 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}



// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof loadConfig === "function") window.loadConfig = loadConfig;
  if (typeof saveConfig === "function") window.saveConfig = saveConfig;
  if (typeof loadPrinterConfigUI === "function") window.loadPrinterConfigUI = loadPrinterConfigUI;
  if (typeof savePrinterConfigUI === "function") window.savePrinterConfigUI = savePrinterConfigUI;
}
