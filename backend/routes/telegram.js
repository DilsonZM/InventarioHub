// routes/telegram.js
// Webhook de Telegram. Acepta:
//   - Mensajes del grupo configurado (avisos y comandos operativos)
//   - Mensajes privados (DM) de usuarios, donde viven los comandos
//     contables/admin segun el rol (RBAC via perfiles.telegram_user_id)
//
// Seguridad:
//   - Header X-Telegram-Bot-Api-Secret-Token (si hay secreto)
//   - Grupos: solo el chat configurado
//   - Privados: el vinculo Telegram ID <-> perfil resuelve los permisos

const express = require('express');
const router = express.Router();
const {
  handleTelegramCommand,
  handleTelegramCallback,
  handleGastoFlowText,
  getTelegramActor,
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

    // ---------- Botones (callback_query) ----------
    const cb = update.callback_query;
    if (cb) {
      const cbChat = cb.message && cb.message.chat ? cb.message.chat : null;
      const cbChatId = cbChat ? cbChat.id : null;
      const isPrivate = !!(cbChat && cbChat.type === 'private');
      if (!cbChatId) return res.sendStatus(200);
      if (!isPrivate && String(cbChatId) !== String(getConfiguredChatId())) {
        return res.sendStatus(200);
      }

      const fromId = cb.from ? cb.from.id : null;
      const actor = await getTelegramActor(fromId);
      const ctx = { fromId, isPrivate, actor, chatId: cbChatId };

      let cbResp = null;
      let cbError = null;
      try {
        cbResp = await handleTelegramCallback(cb.data, ctx);
      } catch (cbErr) {
        cbError = cbErr;
        console.error('[telegram webhook] callback error:', cbErr.message);
      }
      // Siempre responder al callback (quita el "pensando..." del boton)
      await answerCallbackQuery(cb.id, cbResp && cbResp.toast);
      if (cbResp) {
        const useMarkdown = cbResp.markdown === true;
        const useHtml = cbResp.html === true;
        if (cbResp.document) {
          await sendTelegramDocument(cbResp.document.buffer, cbResp.document.filename, cbResp.document.caption, { chatId: cbChatId });
        } else if (cbResp.edit && cb.message && cb.message.message_id) {
          const edited = await editTelegramMessage(cbResp.text, cb.message.message_id, {
            markdown: useMarkdown,
            html: useHtml,
            replyMarkup: cbResp.replyMarkup,
            chatId: cbChatId
          });
          if (!edited || !edited.ok) {
            await sendTelegramMessage(cbResp.text, { markdown: useMarkdown, html: useHtml, replyMarkup: cbResp.replyMarkup, chatId: cbChatId });
          }
        } else {
          await sendTelegramMessage(cbResp.text, { markdown: useMarkdown, html: useHtml, replyMarkup: cbResp.replyMarkup, chatId: cbChatId });
        }
      } else if (cbError) {
        await sendTelegramMessage('⚠️ No se pudo procesar la solicitud: ' + cbError.message, { markdown: false, chatId: cbChatId });
      }
      return res.status(200).json({
        ok: true,
        handled: cbResp ? (cbResp.document ? 'document' : (cbResp.edit ? 'edit' : 'text')) : 'none',
        error: cbError ? cbError.message : null
      });
    }

    // ---------- Mensajes ----------
    const msg = update.message || update.edited_message || update.channel_post || {};
    const chat = msg.chat || {};
    const chatId = chat.id;
    const isPrivate = chat.type === 'private';
    const fromId = msg.from ? msg.from.id : null;
    const text = msg.text || '';

    // Grupos: solo el chat configurado. Privados: cualquier usuario (el vinculo decide).
    if (!isPrivate && String(chatId) !== String(getConfiguredChatId())) {
      return res.sendStatus(200);
    }
    if (isPrivate && !fromId) return res.sendStatus(200);

    const actor = await getTelegramActor(fromId);
    const ctx = { fromId, isPrivate, actor, chatId };

    let response = await handleTelegramCommand(text, ctx);
    // Si no fue un comando, puede ser un paso del formulario de /gasto
    if (!response) response = await handleGastoFlowText(text, chatId, ctx);
    if (response) {
      if (typeof response === 'string') {
        await sendTelegramMessage(response, { markdown: false, chatId });
      } else {
        await sendTelegramMessage(response.text, {
          markdown: response.markdown === true,
          html: response.html === true,
          replyMarkup: response.replyMarkup,
          chatId
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
