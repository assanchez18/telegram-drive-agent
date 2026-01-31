import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSelfTest, generateTestPropertyName } from '../src/services/selfTestService.js';
import * as propertyService from '../src/services/propertyService.js';
import * as driveAdapter from '../src/adapters/driveAdapter.js';
import { readFile } from 'fs/promises';

// Mock dependencies
vi.mock('../src/services/propertyService.js');
vi.mock('../src/adapters/driveAdapter.js');
vi.mock('fs/promises');

// Mock setTimeout para que los delays no esperen realmente en tests
vi.useFakeTimers();

describe('selfTestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock readFile para fixtures
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (path.includes('selftest-photo.jpg')) {
        return Buffer.from('fake-jpeg-data');
      }
      if (path.includes('selftest-doc.pdf')) {
        return Buffer.from('fake-pdf-data');
      }
      throw new Error(`Unexpected file path: ${path}`);
    });
  });

  describe('generateTestPropertyName', () => {
    it('genera nombre con formato correcto', () => {
      vi.useRealTimers();
      const name = generateTestPropertyName();
      expect(name).toMatch(/^Self-Test-\d+$/);
      vi.useFakeTimers();
    });

    it('genera nombres únicos en llamadas sucesivas', async () => {
      // Usar real timers para este test específico ya que no usa la función delay
      vi.useRealTimers();

      const name1 = generateTestPropertyName();
      await new Promise(resolve => setTimeout(resolve, 2));
      const name2 = generateTestPropertyName();

      expect(name1).toMatch(/^Self-Test-\d+$/);
      expect(name2).toMatch(/^Self-Test-\d+$/);
      expect(name1).not.toBe(name2);

      // Volver a fake timers para los siguientes tests
      vi.useFakeTimers();
    });

    it('usa timestamp actual en el nombre', () => {
      vi.useRealTimers();

      const before = Date.now();
      const name = generateTestPropertyName();
      const after = Date.now();

      const timestamp = parseInt(name.replace('Self-Test-', ''), 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);

      vi.useFakeTimers();
    });

    it('incluye prefijo Self-Test', () => {
      vi.useRealTimers();
      const name = generateTestPropertyName();
      expect(name).toContain('Self-Test-');
      vi.useFakeTimers();
    });
  });

  describe('executeSelfTest', () => {
    it('completa los 7 pasos exitosamente', async () => {
      // Setup mocks for all 7 steps

      // Paso 1: Verificar listado
      vi.mocked(propertyService.listProperties).mockResolvedValueOnce({
        properties: [],
      });

      // Paso 2: Crear propiedad
      vi.mocked(propertyService.addProperty).mockResolvedValueOnce({
        success: true,
        normalizedAddress: 'Self-Test-123',
        message: 'Propiedad creada',
      });

      // Paso 3: Primer intento exitoso
      vi.mocked(propertyService.listProperties).mockResolvedValueOnce({
        properties: [
          {
            address: 'Self-Test-123',
            normalizedAddress: 'Self-Test-123',
            propertyFolderId: 'test-folder-id',
          },
        ],
      });

      // Paso 3: Verificar carpetas (resolveCategoryFolderId se llama 8 veces)
      vi.mocked(driveAdapter.resolveCategoryFolderId).mockResolvedValue('category-folder-id');

      // Paso 4: Subir archivos (2 uploads)
      vi.mocked(driveAdapter.uploadBufferToDrive)
        .mockResolvedValueOnce({ id: 'photo-id', name: 'selftest-photo.jpg' })
        .mockResolvedValueOnce({ id: 'doc-id', name: 'selftest-doc.pdf' });

      // Paso 5: Archivar
      vi.mocked(propertyService.archiveProperty).mockResolvedValueOnce({
        success: true,
        message: 'Archivada',
      });

      // Paso 6: Reactivar
      vi.mocked(propertyService.unarchiveProperty).mockResolvedValueOnce({
        success: true,
        message: 'Reactivada',
      });

      // Paso 7: Eliminar
      vi.mocked(propertyService.deleteProperty).mockResolvedValueOnce({
        success: true,
        message: 'Eliminada',
      });

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });

      // Avanzar todos los timers (delays)
      await vi.runAllTimersAsync();

      const report = await reportPromise;

      expect(report.success).toBe(true);
      expect(report.steps).toHaveLength(7);
      expect(report.steps[0].name).toBe('Verificar listado de propiedades');
      expect(report.steps[0].status).toBe('success');
      expect(report.steps[6].name).toBe('Eliminar propiedad de prueba (cleanup)');
      expect(report.steps[6].status).toBe('success');
    });

    it('falla en paso 1 cuando listProperties devuelve mensaje de error', async () => {
      vi.mocked(propertyService.listProperties).mockResolvedValueOnce({
        message: 'Error: No catalog found',
      });

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });
      await vi.runAllTimersAsync();
      const report = await reportPromise;

      expect(report.success).toBe(false);
      expect(report.error).toContain('/list_properties falló');
      expect(report.steps[0].status).toBe('failed');
    });

    it('falla en paso 2 cuando no se puede crear la propiedad', async () => {
      vi.mocked(propertyService.listProperties).mockResolvedValueOnce({
        properties: [],
      });

      vi.mocked(propertyService.addProperty).mockResolvedValueOnce({
        success: false,
        message: 'Error creating property',
      });

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });
      await vi.runAllTimersAsync();
      const report = await reportPromise;

      expect(report.success).toBe(false);
      expect(report.error).toContain('No se pudo crear la propiedad');
      expect(report.steps[1].status).toBe('failed');
    });

    it('intenta cleanup cuando falla después de crear propiedad', async () => {
      vi.mocked(propertyService.listProperties)
        .mockResolvedValueOnce({ properties: [] })
        // Paso 3: 3 reintentos - siempre vacío
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] });

      vi.mocked(propertyService.addProperty).mockResolvedValueOnce({
        success: true,
        normalizedAddress: 'Self-Test-123',
        message: 'Propiedad creada',
      });

      // Falla en verificación de carpetas
      vi.mocked(driveAdapter.resolveCategoryFolderId).mockResolvedValueOnce(null);

      // Cleanup: delete
      vi.mocked(propertyService.deleteProperty).mockResolvedValueOnce({
        success: true,
        message: 'Eliminada',
      });

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });
      await vi.runAllTimersAsync();
      const report = await reportPromise;

      expect(report.success).toBe(false);
      expect(report.cleanupPerformed).toBe(true);
      expect(propertyService.deleteProperty).toHaveBeenCalled();
    });

    it('marca cleanupFailed si el cleanup falla', async () => {
      vi.mocked(propertyService.listProperties)
        .mockResolvedValueOnce({ properties: [] })
        // Paso 3: 3 reintentos - siempre vacío
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] });

      vi.mocked(propertyService.addProperty).mockResolvedValueOnce({
        success: true,
        normalizedAddress: 'Self-Test-123',
        message: 'Propiedad creada',
      });

      // Falla en verificación
      vi.mocked(driveAdapter.resolveCategoryFolderId).mockResolvedValueOnce(null);

      // Cleanup falla
      vi.mocked(propertyService.deleteProperty).mockRejectedValueOnce(
        new Error('Cleanup failed')
      );

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });
      await vi.runAllTimersAsync();
      const report = await reportPromise;

      expect(report.success).toBe(false);
      expect(report.cleanupFailed).toBe(true);
      expect(report.cleanupError).toContain('Cleanup failed');
    });



    it('falla en paso 3 si la propiedad no se encuentra en el catálogo después de reintentos', async () => {
      vi.mocked(propertyService.listProperties)
        .mockResolvedValueOnce({ properties: [] })
        // Paso 3: 3 reintentos - todos vacíos
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] });

      vi.mocked(propertyService.addProperty).mockResolvedValueOnce({
        success: true,
        normalizedAddress: 'Self-Test-123',
        message: 'Propiedad creada',
      });

      // Cleanup
      vi.mocked(propertyService.deleteProperty).mockResolvedValueOnce({
        success: true,
        message: 'Eliminada',
      });

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });
      await vi.runAllTimersAsync();
      const report = await reportPromise;

      expect(report.success).toBe(false);
      expect(report.error).toContain('después de 3 intentos');
      expect(report.steps[2].status).toBe('failed');
      expect(report.cleanupPerformed).toBe(true);
    });

    it('marca cleanupFailed cuando deleteProperty retorna success=false', async () => {
      vi.mocked(propertyService.listProperties)
        .mockResolvedValueOnce({ properties: [] })
        // Paso 3: 3 reintentos - todos vacíos
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] })
        .mockResolvedValueOnce({ properties: [] });

      vi.mocked(propertyService.addProperty).mockResolvedValueOnce({
        success: true,
        normalizedAddress: 'Self-Test-123',
        message: 'Propiedad creada',
      });

      // Falla en verificación
      vi.mocked(driveAdapter.resolveCategoryFolderId).mockResolvedValueOnce(null);

      // Cleanup retorna success=false (no lanza excepción)
      vi.mocked(propertyService.deleteProperty).mockResolvedValueOnce({
        success: false,
        message: 'No se pudo eliminar',
      });

      const mockDrive = {};
      const baseFolderId = 'base-folder-id';

      const reportPromise = executeSelfTest({ drive: mockDrive, baseFolderId });
      await vi.runAllTimersAsync();
      const report = await reportPromise;

      expect(report.success).toBe(false);
      expect(report.cleanupFailed).toBe(true);
      expect(report.cleanupError).toContain('No se pudo eliminar');
    });
  });
});
