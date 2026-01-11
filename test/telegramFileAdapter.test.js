import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadTelegramFile, extractBulkFileInfo } from '../src/adapters/telegramFileAdapter.js';
import axios from 'axios';

vi.mock('axios');

describe('downloadTelegramFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('descarga archivo correctamente', async () => {
    const mockBot = {
      getFile: vi.fn().mockResolvedValue({
        file_path: 'documents/file.pdf',
      }),
    };

    axios.get.mockResolvedValue({
      data: Buffer.from('file content'),
    });

    const result = await downloadTelegramFile(mockBot, 'bot-token-123', 'file-id-456');

    expect(mockBot.getFile).toHaveBeenCalledWith('file-id-456');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('lanza error si falta bot', async () => {
    await expect(downloadTelegramFile(null, 'token', 'file-id')).rejects.toThrow('Bot is required');
  });

  it('lanza error si falta botToken', async () => {
    const mockBot = {};
    await expect(downloadTelegramFile(mockBot, null, 'file-id')).rejects.toThrow('Bot token is required');
  });

  it('lanza error si falta fileId', async () => {
    const mockBot = {};
    await expect(downloadTelegramFile(mockBot, 'token', null)).rejects.toThrow('File ID is required');
  });

  it('lanza error si no se obtiene file_path', async () => {
    const mockBot = {
      getFile: vi.fn().mockResolvedValue({}),
    };

    await expect(downloadTelegramFile(mockBot, 'token', 'file-id')).rejects.toThrow('Could not retrieve file_path from Telegram');
  });
});

describe('extractBulkFileInfo', () => {
  it('extrae info de documento', () => {
    const msg = {
      document: {
        file_id: 'doc-123',
        file_unique_id: 'unique-doc-123',
        file_name: 'contract.pdf',
        mime_type: 'application/pdf',
      },
    };

    const result = extractBulkFileInfo(msg);

    expect(result).toEqual({
      fileId: 'doc-123',
      fileUniqueId: 'unique-doc-123',
      fileName: 'contract.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('extrae info de documento sin nombre', () => {
    const msg = {
      document: {
        file_id: 'doc-456',
        file_unique_id: 'unique-doc-456',
        mime_type: 'application/pdf',
      },
    };

    const result = extractBulkFileInfo(msg);

    expect(result).toEqual({
      fileId: 'doc-456',
      fileUniqueId: 'unique-doc-456',
      fileName: null,
      mimeType: 'application/pdf',
    });
  });

  it('extrae info de foto', () => {
    const msg = {
      photo: [
        { file_id: 'photo-small', file_unique_id: 'unique-small' },
        { file_id: 'photo-large', file_unique_id: 'unique-large' },
      ],
    };

    const result = extractBulkFileInfo(msg);

    expect(result).toEqual({
      fileId: 'photo-large',
      fileUniqueId: 'unique-large',
      fileName: null,
      mimeType: 'image/jpeg',
    });
  });

  it('devuelve null si no hay archivo', () => {
    const msg = { text: 'hello' };
    const result = extractBulkFileInfo(msg);
    expect(result).toBeNull();
  });

  it('usa mime type por defecto si no está presente', () => {
    const msg = {
      document: {
        file_id: 'doc-789',
        file_unique_id: 'unique-doc-789',
        file_name: 'unknown.xyz',
      },
    };

    const result = extractBulkFileInfo(msg);
    expect(result.mimeType).toBe('application/octet-stream');
  });

  it('usa caption como fileName para documento si está presente', () => {
    const msg = {
      caption: 'Mi Contrato',
      document: {
        file_id: 'doc-101',
        file_unique_id: 'unique-doc-101',
        file_name: 'original.pdf',
        mime_type: 'application/pdf',
      },
    };

    const result = extractBulkFileInfo(msg);
    expect(result.fileName).toBe('Mi Contrato');
  });

  it('usa caption como fileName para foto si está presente', () => {
    const msg = {
      caption: 'Estado Inicial',
      photo: [
        { file_id: 'photo-large', file_unique_id: 'unique-large' },
      ],
    };

    const result = extractBulkFileInfo(msg);
    expect(result.fileName).toBe('Estado Inicial.jpg');
  });

  it('usa caption como fileName para video si está presente', () => {
    const msg = {
      caption: 'Tour Virtual',
      video: {
        file_id: 'video-123',
        file_unique_id: 'unique-video-123',
        mime_type: 'video/mp4',
      },
    };

    const result = extractBulkFileInfo(msg);
    expect(result.fileName).toBe('Tour Virtual.mp4');
  });

  it('ignora caption vacio o solo espacios', () => {
    const msg = {
      caption: '   ',
      photo: [
        { file_id: 'photo-large', file_unique_id: 'unique-large' },
      ],
    };

    const result = extractBulkFileInfo(msg);
    expect(result.fileName).toBeNull();
  });

  it('extrae info de video', () => {
    const msg = {
      video: {
        file_id: 'video-456',
        file_unique_id: 'unique-video-456',
        file_name: 'tour.mp4',
        mime_type: 'video/mp4',
      },
    };

    const result = extractBulkFileInfo(msg);

    expect(result).toEqual({
      fileId: 'video-456',
      fileUniqueId: 'unique-video-456',
      fileName: 'tour.mp4',
      mimeType: 'video/mp4',
    });
  });

  it('extrae info de video sin nombre', () => {
    const msg = {
      video: {
        file_id: 'video-789',
        file_unique_id: 'unique-video-789',
        mime_type: 'video/mp4',
      },
    };

    const result = extractBulkFileInfo(msg);

    expect(result).toEqual({
      fileId: 'video-789',
      fileUniqueId: 'unique-video-789',
      fileName: null,
      mimeType: 'video/mp4',
    });
  });
});
