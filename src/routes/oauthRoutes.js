import express from 'express';
import { createAuthUrl, handleCallback } from '../services/googleReauthService.js';

export function createOAuthRouter({ oauthClientJson, stateSecret, baseUrl, port, secretName, bot }) {
  const router = express.Router();

  /**
   * GET /oauth/google/start
   * Inicia el flujo de OAuth redirigiendo a Google
   */
  router.get('/google/start', async (req, res) => {
    const { chat_id, user_id } = req.query;

    if (!chat_id || !user_id) {
      return res.status(400).send('Missing chat_id or user_id');
    }

    try {
      const { url } = createAuthUrl({
        chatId: chat_id,
        userId: user_id,
        oauthClientJson,
        stateSecret,
        baseUrl,
        port,
      });

      res.redirect(url);
    } catch (err) {
      console.error('[OAuth] Error creating auth URL:', err);

      // Notificar al chat
      try {
        await bot.sendMessage(chat_id, `❌ Error iniciando autorización: ${err.message}`);
      } catch (notifyErr) {
        console.error('[OAuth] Error notifying user:', notifyErr);
      }

      res.status(500).send('Error starting authorization');
    }
  });

  /**
   * GET /oauth/google/callback
   * Callback de Google OAuth
   */
  router.get('/google/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[OAuth] Google returned error:', error);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Autorización Cancelada</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Autorización Cancelada</h1>
          <p>Has cancelado la autorización o ha ocurrido un error.</p>
          <p>Puedes cerrar esta ventana y volver a Telegram.</p>
        </body>
        </html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    try {
      const result = await handleCallback({
        code,
        state,
        oauthClientJson,
        stateSecret,
        baseUrl,
        port,
        secretName,
      });

      // Notificar al chat
      try {
        await bot.sendMessage(result.chatId, result.message);
      } catch (notifyErr) {
        console.error('[OAuth] Error notifying user:', notifyErr);
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Autorización Completada</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { color: #388e3c; }
            .warning { color: #f57c00; }
          </style>
        </head>
        <body>
          <h1 class="${result.hasRefreshToken ? 'success' : 'warning'}">${result.hasRefreshToken ? '✅' : '⚠️'} Autorización Completada</h1>
          <p>${result.message}</p>
          <p>Puedes cerrar esta ventana y volver a Telegram.</p>
          ${!result.hasRefreshToken ? '<p><small>Nota: Si quieres obtener un refresh_token, revoca el acceso en <a href="https://myaccount.google.com/permissions" target="_blank">tu cuenta de Google</a> y vuelve a autorizar.</small></p>' : ''}
        </body>
        </html>
      `);
    } catch (err) {
      console.error('[OAuth] Error handling callback:', err);

      // Intentar notificar al chat si podemos extraer chatId del state
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (decoded.chatId) {
          await bot.sendMessage(
            decoded.chatId,
            `❌ Error completando autorización: ${err.message}\n\nPuedes volver a intentarlo con /google_login`
          );
        }
      } catch (notifyErr) {
        console.error('[OAuth] Error notifying user:', notifyErr);
      }

      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Error en Autorización</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Error en Autorización</h1>
          <p>${err.message}</p>
          <p>Vuelve a Telegram y prueba de nuevo con /google_login</p>
        </body>
        </html>
      `);
    }
  });

  return router;
}
