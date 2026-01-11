import axios from 'axios';

export async function downloadTelegramFile(bot, botToken, fileId) {
  if (!bot) {
    throw new Error('Bot is required');
  }
  if (!botToken) {
    throw new Error('Bot token is required');
  }
  if (!fileId) {
    throw new Error('File ID is required');
  }

  const file = await bot.getFile(fileId);
  if (!file?.file_path) {
    throw new Error('Could not retrieve file_path from Telegram');
  }

  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });

  return Buffer.from(response.data);
}

export function extractBulkFileInfo(msg) {
  const caption = msg.caption?.trim() || null;

  if (msg.document) {
    const fileName = caption || msg.document.file_name || null;
    return {
      fileId: msg.document.file_id,
      fileUniqueId: msg.document.file_unique_id,
      fileName,
      mimeType: msg.document.mime_type || 'application/octet-stream',
    };
  }

  if (msg.photo?.length) {
    const best = msg.photo[msg.photo.length - 1];
    const fileName = caption ? `${caption}.jpg` : null;
    return {
      fileId: best.file_id,
      fileUniqueId: best.file_unique_id,
      fileName,
      mimeType: 'image/jpeg',
    };
  }

  if (msg.video) {
    const videoFileName = msg.video.file_name || null;
    const fileName = caption ? `${caption}.mp4` : videoFileName;
    return {
      fileId: msg.video.file_id,
      fileUniqueId: msg.video.file_unique_id,
      fileName,
      mimeType: msg.video.mime_type || 'video/mp4',
    };
  }

  return null;
}
