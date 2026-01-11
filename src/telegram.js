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
  const caption = msg.caption?.trim() || null;

  if (msg.document) {
    const originalName = caption || msg.document.file_name || 'documento';
    return {
      fileId: msg.document.file_id,
      originalName,
      mimeType: msg.document.mime_type || 'application/octet-stream',
    };
  }

  if (msg.photo?.length) {
    const best = msg.photo[msg.photo.length - 1];
    const originalName = caption ? `${caption}.jpg` : 'foto.jpg';
    return {
      fileId: best.file_id,
      originalName,
      mimeType: 'image/jpeg',
    };
  }

  if (msg.video) {
    const videoFileName = msg.video.file_name || 'video.mp4';
    const originalName = caption ? `${caption}.mp4` : videoFileName;
    return {
      fileId: msg.video.file_id,
      originalName,
      mimeType: msg.video.mime_type || 'video/mp4',
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

