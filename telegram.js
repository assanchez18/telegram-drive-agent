import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import path from 'node:path';

export function createTelegramBot(token) {
  // webHook:true porque vamos a procesar updates entrantes
  const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
  if (!BOT_TOKEN) throw new Error('Falta BOT_TOKEN');

  return  new TelegramBot(BOT_TOKEN, { polling: false });
}

export function extractTelegramFileInfo(msg) {
  if (msg.document) {
    return {
      fileId: msg.document.file_id,
      originalName: msg.document.file_name || 'documento',
      mimeType: msg.document.mime_type || 'application/octet-stream',
    };
  }

  if (msg.photo?.length) {
    const best = msg.photo[msg.photo.length - 1];
    return {
      fileId: best.file_id,
      originalName: 'foto.jpg',
      mimeType: 'image/jpeg',
    };
  }

  return null;
}

export async function getFileDownloadStream(bot, botToken, fileId) {
  const file = await bot.getFile(fileId);
  if (!file?.file_path) throw new Error('No se pudo obtener file_path de Telegram');

  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  const res = await axios.get(url, { responseType: 'stream' });

  return {
    stream: res.data,
    fallbackName: path.basename(file.file_path),
  };
}

