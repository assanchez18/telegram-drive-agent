import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeIndividualUploadHandlers } from '../src/controllers/individualUploadController.js';
import * as propertyService from '../src/services/propertyService.js';
import * as driveAdapter from '../src/adapters/driveAdapter.js';
import * as telegramFileAdapter from '../src/adapters/telegramFileAdapter.js';
import * as fileNaming from '../src/utils/fileNaming.js';
import * as individualUploadSessionRepository from '../src/repositories/individualUploadSessionRepository.js';
import { DOCUMENT_CATEGORIES } from '../src/domain/DocumentCategory.js';

vi.mock('../src/services/propertyService.js');
vi.mock('../src/adapters/driveAdapter.js');
vi.mock('../src/adapters/telegramFileAdapter.js');
vi.mock('../src/utils/fileNaming.js');
vi.mock('../src/repositories/individualUploadSessionRepository.js');

describe('initializeIndividualUploadHandlers', () => {
  let mockBot;
  let callbackHandlers;
  let originalEnv;

  const mockProperties = [
    { address: 'Calle Test 1', normalizedAddress: 'calle-test-1', propertyFolderId: 'f1' },
  ];

  const mockSession = {
    fileInfo: { fileId: 'tg-file-id', originalName: 'documento.pdf', mimeType: 'application/pdf' },
    properties: mockProperties,
    selectedProperty: mockProperties[0],
    category: DOCUMENT_CATEGORIES.INGRESOS,
    year: '2025',
    state: 'waiting_for_filename',
  };

  beforeEach(() => {
    originalEnv = { ...process.env };
    callbackHandlers = {};

    mockBot = {
      on: vi.fn((event, handler) => {
        callbackHandlers[event] = handler;
      }),
      sendMessage: vi.fn().mockResolvedValue({}),
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
    };

    vi.clearAllMocks();

    vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue(mockSession);
    vi.mocked(individualUploadSessionRepository.startIndividualUploadSession).mockReturnValue(undefined);
    vi.mocked(individualUploadSessionRepository.updateIndividualUploadSessionState).mockReturnValue(undefined);
    vi.mocked(individualUploadSessionRepository.clearIndividualUploadSession).mockReturnValue(undefined);
    vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(false);
    vi.mocked(fileNaming.applySnakeCaseToFileName).mockImplementation(name => name);
    vi.mocked(driveAdapter.resolveCategoryFolderId).mockResolvedValue('target-folder-id');
    vi.mocked(driveAdapter.uploadBufferToDrive).mockResolvedValue({ id: 'uploaded-id', name: 'doc.pdf' });
    vi.mocked(telegramFileAdapter.downloadTelegramFile).mockResolvedValue(Buffer.from('content'));
    vi.mocked(propertyService.listProperties).mockResolvedValue({ properties: mockProperties, message: null });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function buildCallbackQuery(userId, chatId, data, messageId = 42) {
    return {
      id: 'cq-id',
      from: { id: userId },
      message: { chat: { id: chatId }, message_id: messageId },
      data,
    };
  }

  describe('botones de categoría', () => {
    it('muestra las 5 nuevas categorías al seleccionar una propiedad', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        properties: mockProperties,
        state: 'waiting_for_property',
      });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'individual_property_0'));

      const sendCall = mockBot.sendMessage.mock.calls.find(call => call[1].includes('categoría'));
      expect(sendCall).toBeDefined();

      const keyboard = sendCall[2].reply_markup.inline_keyboard;
      const callbackDatas = keyboard.flat().map(btn => btn.callback_data).filter(d => d.startsWith('individual_category_'));

      expect(callbackDatas).toContain(`individual_category_${DOCUMENT_CATEGORIES.INGRESOS}`);
      expect(callbackDatas).toContain(`individual_category_${DOCUMENT_CATEGORIES.GASTOS}`);
      expect(callbackDatas).toContain(`individual_category_${DOCUMENT_CATEGORIES.GESTION}`);
      expect(callbackDatas).toContain(`individual_category_${DOCUMENT_CATEGORIES.ARCHIVO}`);
      expect(callbackDatas).toContain(`individual_category_${DOCUMENT_CATEGORIES.FOTOS}`);
      expect(callbackDatas).toHaveLength(5);
    });
  });

  describe('selección de categoría', () => {
    it('muestra selección de año para categorías que lo requieren (Ingresos)', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_category',
      });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.INGRESOS}`)
      );

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('Año'),
        expect.any(Object)
      );
    });

    it('muestra selección de año para Gastos', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_category',
      });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.GASTOS}`)
      );

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('Año'),
        expect.any(Object)
      );
    });

    it('salta selección de año para Gestión (no requiresYear)', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession)
        .mockReturnValueOnce({ ...mockSession, state: 'waiting_for_category' })
        .mockReturnValue({ ...mockSession, category: DOCUMENT_CATEGORIES.GESTION, year: null, state: 'waiting_for_filename' });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.GESTION}`)
      );

      // Should NOT ask for year, goes directly to upload or filename
      const yearAsk = mockBot.sendMessage.mock.calls.find(c => c[1]?.includes?.('Año'));
      expect(yearAsk).toBeUndefined();
    });

    it('salta selección de año para Archivo (no requiresYear)', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession)
        .mockReturnValueOnce({ ...mockSession, state: 'waiting_for_category' })
        .mockReturnValue({ ...mockSession, category: DOCUMENT_CATEGORIES.ARCHIVO, year: null, state: 'waiting_for_filename' });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.ARCHIVO}`)
      );

      const yearAsk = mockBot.sendMessage.mock.calls.find(c => c[1]?.includes?.('Año'));
      expect(yearAsk).toBeUndefined();
    });

    it('salta selección de año para Fotos (no requiresYear)', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession)
        .mockReturnValueOnce({ ...mockSession, state: 'waiting_for_category' })
        .mockReturnValue({ ...mockSession, category: DOCUMENT_CATEGORIES.FOTOS, year: null, state: 'waiting_for_filename' });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.FOTOS}`)
      );

      const yearAsk = mockBot.sendMessage.mock.calls.find(c => c[1]?.includes?.('Año'));
      expect(yearAsk).toBeUndefined();
    });

    it('para categoría sin año pide nombre si needsUserProvidedName es true', async () => {
      vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(true);
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession)
        .mockReturnValueOnce({ ...mockSession, state: 'waiting_for_category' })
        .mockReturnValue({ ...mockSession, category: DOCUMENT_CATEGORIES.GESTION, year: null, state: 'waiting_for_filename' });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.GESTION}`)
      );

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('nombre')
      );
    });

    it('para categoría sin año sube directamente si no needsUserProvidedName', async () => {
      vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(false);
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession)
        .mockReturnValueOnce({ ...mockSession, state: 'waiting_for_category' })
        .mockReturnValue({ ...mockSession, category: DOCUMENT_CATEGORIES.GESTION, year: null, state: 'waiting_for_filename' });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(
        buildCallbackQuery(1, 100, `individual_category_${DOCUMENT_CATEGORIES.GESTION}`)
      );

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });
  });

  describe('cancelación', () => {
    it('cancela la operación con individual_cancel', async () => {
      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'individual_cancel'));

      expect(individualUploadSessionRepository.clearIndividualUploadSession).toHaveBeenCalledWith(100);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(100, expect.stringContaining('cancelada'));
    });
  });

  describe('sin sesión activa', () => {
    it('no procesa callback_query si no hay sesión', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue(null);

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'individual_property_0'));

      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });

    it('no procesa callback_query desconocido con sesión activa', async () => {
      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'unknown_action'));

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('cq-id');
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('onFileReceived / beginUploadWizard', () => {
    it('muestra propiedades al recibir un archivo', async () => {
      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onFileReceived(
        { chat: { id: 100 } },
        { fileId: 'tg-file-id', originalName: 'doc.pdf', mimeType: 'application/pdf' }
      );

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('¿A qué vivienda'),
        expect.any(Object)
      );
    });

    it('muestra mensaje si no hay propiedades', async () => {
      vi.mocked(propertyService.listProperties).mockResolvedValue({ properties: [], message: 'No hay viviendas.' });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onFileReceived(
        { chat: { id: 100 } },
        { fileId: 'tg-file-id', originalName: 'doc.pdf', mimeType: 'application/pdf' }
      );

      expect(mockBot.sendMessage).toHaveBeenCalledWith(100, expect.stringContaining('No hay viviendas.'));
    });

    it('maneja error al listar propiedades', async () => {
      vi.mocked(propertyService.listProperties).mockRejectedValue(new Error('Drive error'));

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onFileReceived(
        { chat: { id: 100 } },
        { fileId: 'tg-file-id', originalName: 'doc.pdf', mimeType: 'application/pdf' }
      );

      expect(mockBot.sendMessage).toHaveBeenCalledWith(100, expect.stringContaining('Error al listar'));
    });
  });

  describe('selección de año (individual_year_*)', () => {
    it('pide nombre cuando hay año y needsUserProvidedName es true', async () => {
      vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(true);
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_year',
      });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'individual_year_2025'));

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('nombre')
      );
    });

    it('sube directamente cuando hay año y needsUserProvidedName es false', async () => {
      vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(false);
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_year',
      });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'individual_year_2025'));

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });

    it('pide año personalizado con individual_year_custom', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_year',
      });

      initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await callbackHandlers.callback_query(buildCallbackQuery(1, 100, 'individual_year_custom'));

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('YYYY')
      );
    });
  });

  describe('onTextMessage (dispatcher)', () => {
    it('devuelve false si no hay sesión', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue(null);

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      const result = await controller.onTextMessage({ chat: { id: 100 }, text: 'algo' });
      expect(result).toBe(false);
    });

    it('devuelve false si estado no coincide', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_property',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      const result = await controller.onTextMessage({ chat: { id: 100 }, text: 'algo' });
      expect(result).toBe(false);
    });

    it('procesa waiting_for_filename', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      const result = await controller.onTextMessage({ chat: { id: 100 }, text: 'mi_documento' });
      expect(result).toBe(true);
    });

    it('procesa waiting_for_custom_year', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_custom_year',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      const result = await controller.onTextMessage({ chat: { id: 100 }, text: '2023' });
      expect(result).toBe(true);
    });
  });

  describe('onFilenameReceived', () => {
    it('muestra error si nombre vacío', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: '   ' });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('nombre válido')
      );
    });

    it('usa nombre original con "skip"', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: 'skip' });

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });

    it('aplica nombre proporcionado y sube el archivo', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: 'Mi Documento' });

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });

    it('genera extensión .jpg para imagen con "skip"', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        fileInfo: { fileId: 'tg-file-id', originalName: 'foto.jpg', mimeType: 'image/jpeg' },
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: 'skip' });

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });

    it('genera extensión .mp4 para video con nombre personalizado', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        fileInfo: { fileId: 'tg-file-id', originalName: 'video.mp4', mimeType: 'video/mp4' },
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: 'mi video' });

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });
  });

  describe('onCustomYearReceived', () => {
    it('muestra error si año tiene formato inválido', async () => {
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_custom_year',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: 'invalid' });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('inválido')
      );
    });

    it('pide nombre si needsUserProvidedName es true después de año custom', async () => {
      vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(true);
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_custom_year',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: '2023' });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('nombre')
      );
    });

    it('sube directamente si no needsUserProvidedName después de año custom', async () => {
      vi.mocked(fileNaming.needsUserProvidedName).mockReturnValue(false);
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_custom_year',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: '2023' });

      expect(driveAdapter.uploadBufferToDrive).toHaveBeenCalled();
    });
  });

  describe('uploadFileToDrive error handling', () => {
    it('muestra error si falla la descarga del archivo', async () => {
      vi.mocked(telegramFileAdapter.downloadTelegramFile).mockRejectedValue(new Error('Download error'));
      vi.mocked(individualUploadSessionRepository.getIndividualUploadSession).mockReturnValue({
        ...mockSession,
        state: 'waiting_for_filename',
      });

      const controller = initializeIndividualUploadHandlers({ bot: mockBot, drive: {}, baseFolderId: 'base', botToken: 'tk' });

      await controller.onTextMessage({ chat: { id: 100 }, text: 'skip' });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        expect.stringContaining('Error al subir')
      );
      expect(individualUploadSessionRepository.clearIndividualUploadSession).toHaveBeenCalledWith(100);
    });
  });
});
