// routes/telegram.js
// Webhook de Telegram: recibe los mensajes del grupo del restaurante y
// responde a los comandos de control de notificaciones:
//   /pausar, /reanudar, /silenciar_pos, /activar_pos, /estado, /ayuda
//
// Seguridad:
//   - Se valida el header X-Telegram-Bot-Api-Secret-Token (si hay secreto).
//   - Solo se procesan comandos enviados desde el chat configurado.

const express = require('express');
const router = express.Router();
const {
  handleTelegramCommand,
  handleTelegramCallback,
  handleGastoFlowText,
  answerCallbackQuery,
  sendTelegramMessage,
  sendTelegramDocument,
  editTelegramMessage,
  getConfiguredChatId
} = require('../lib/telegram');

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

router.post('/webhook', async (req, res) => {
  // Telegram espera un 200 rapido; si devolvemos error reintenta el envio.
  try {
    if (WEBHOOK_SECRET) {
      const got = req.headers['x-telegram-bot-api-secret-token'];
      if (got !== WEBHOOK_SECRET) {
        console.warn('[telegram webhook] secreto invalido');
        return res.sendStatus(401);
      }
    }

    const update = req.body || {};

    // Botones del selector de fechas (callback_query de /rango)
    const cb = update.callback_query;
    if (cb) {
      const cbChatId = cb.message && cb.message.chat ? cb.message.chat.id : null;
      if (!cbChatId || String(cbChatId) !== String(getConfiguredChatId())) {
        return res.sendStatus(200);
      }
      let cbResp = null;
      let cbError = null;
      try {
        cbResp = await handleTelegramCallback(cb.data);
      } catch (cbErr) {
        cbError = cbErr;
        console.error('[telegram webhook] callback error:', cbErr.message);
      }
      // Siempre responder al callback (quita el "pensando..." del boton)
      await answerCallbackQuery(cb.id, cbResp && cbResp.toast);
      if (cbResp) {
        const useMarkdown = cbResp.markdown === true;
        const useHtml = cbResp.html === true;
        // Reportes PDF (solo Productos: la lista larga)
        if (cbResp.document) {
          await sendTelegramDocument(cbResp.document.buffer, cbResp.document.filename, cbResp.document.caption);
        // Los paneles/reportes se editan en el lugar (no llenan el chat)
        } else if (cbResp.edit && cb.message && cb.message.message_id) {
          const edited = await editTelegramMessage(cbResp.text, cb.message.message_id, {
            markdown: useMarkdown,
            html: useHtml,
            replyMarkup: cbResp.replyMarkup
          });
          if (!edited || !edited.ok) {
            await sendTelegramMessage(cbResp.text, { markdown: useMarkdown, html: useHtml, replyMarkup: cbResp.replyMarkup });
          }
        } else {
          await sendTelegramMessage(cbResp.text, { markdown: useMarkdown, html: useHtml, replyMarkup: cbResp.replyMarkup });
        }
      } else if (cbError) {
        await sendTelegramMessage('⚠️ No se pudo procesar la solicitud: ' + cbError.message, { markdown: false });
      }
      // Telegram ignora el body; lo usamos para diagnostico
      return res.status(200).json({
        ok: true,
        handled: cbResp ? (cbResp.document ? 'document' : (cbResp.edit ? 'edit' : 'text')) : 'none',
        error: cbError ? cbError.message : null
      });
    }

    const msg = update.message || update.edited_message || update.channel_post || {};
    const chatId = msg.chat ? msg.chat.id : null;
    const text = msg.text || '';

    // Solo procesar comandos del chat configurado (grupo del restaurante)
    if (!chatId || String(chatId) !== String(getConfiguredChatId())) {
      return res.sendStatus(200);
    }

    let response = await handleTelegramCommand(text);
    // Si no fue un comando, puede ser un paso del formulario de /gasto
    if (!response) response = await handleGastoFlowText(text, chatId);
    if (response) {
      if (typeof response === 'string') {
        await sendTelegramMessage(response, { markdown: false });
      } else {
        await sendTelegramMessage(response.text, {
          markdown: response.markdown === true,
          html: response.html === true,
          replyMarkup: response.replyMarkup
        });
      }
    }
    return res.sendStatus(200);
  } catch (err) {
    console.error('[telegram webhook] error:', err.message);
    return res.sendStatus(200);
  }
});

module.exports = router;
