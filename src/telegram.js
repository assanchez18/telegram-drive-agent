import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import path from 'node:path';
import { extractFileInfo } from './adapters/telegramFileAdapter.js';

export function createTelegramBot(token) {
  // webHook:true porque vamos a procesar updates entrantes
  const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
  if (!BOT_TOKEN) throw new Error('Falta BOT_TOKEN');

  return  new TelegramBot(BOT_TOKEN, { polling: false });
}

export function extractTelegramFileInfo(msg) {
  const fileInfo = extractFileInfo(msg);
  
  if (!fileInfo) {
    return null;
  }

  return {
    fileId: fileInfo.fileId,
    fileUniqueId: fileInfo.fileUniqueId,
    originalName: fileInfo.fileName || (fileInfo.mimeType.startsWith('image/') ? 'foto.jpg' : 
                                        fileInfo.mimeType.startsWith('video/') ? 'video.mp4' : 
                                        'documento'),
    mimeType: fileInfo.mimeType,
  };
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

