import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { addProperty, listProperties, archiveProperty, unarchiveProperty, deleteProperty } from './propertyService.js';
import { uploadBufferToDrive, resolveCategoryFolderId } from '../adapters/driveAdapter.js';
import { DOCUMENT_CATEGORIES, getCategoryFolderPath } from '../domain/DocumentCategory.js';
import { getCurrentYear } from '../domain/Year.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_PATH = join(__dirname, '../../test/fixtures');

/**
 * Genera un nombre único para la propiedad de prueba
 */
export function generateTestPropertyName() {
  const timestamp = Date.now();
  return `Self-Test-${timestamp}`;
}

/**
 * Verifica que la estructura de carpetas existe para una propiedad
 */
async function verifyFolderStructure({ drive, propertyFolderId, year }) {
  const expectedFolders = [
    { name: `01_Contratos/${year}`, path: ['01_Contratos', year] },
    { name: '02_Inquilinos_Sensible', path: ['02_Inquilinos_Sensible'] },
    { name: `03_Seguros/${year}`, path: ['03_Seguros', year] },
    { name: `04_Suministros/${year}`, path: ['04_Suministros', year] },
    { name: `05_Comunidad_Impuestos/${year}`, path: ['05_Comunidad_Impuestos', year] },
    { name: `06_Facturas_Reformas/${year}`, path: ['06_Facturas_Reformas', year] },
    { name: '07_Fotos_Estado', path: ['07_Fotos_Estado'] },
    { name: '99_Otros', path: ['99_Otros'] },
  ];

  for (const folder of expectedFolders) {
    const categoryFolderId = await resolveCategoryFolderId({
      drive,
      propertyFolderId,
      categoryPath: folder.path,
    });

    if (!categoryFolderId) {
      throw new Error(`Carpeta "${folder.name}" no encontrada`);
    }
  }

  return true;
}

/**
 * Sube archivos de prueba a diferentes categorías
 */
async function uploadTestFiles({ drive, propertyFolderId }) {
  const year = getCurrentYear();

  // Leer fixtures
  const photoPath = join(FIXTURES_PATH, 'selftest-photo.jpg');
  const docPath = join(FIXTURES_PATH, 'selftest-doc.pdf');

  const photoBuffer = await readFile(photoPath);
  const docBuffer = await readFile(docPath);

  const results = [];

  // Subir foto a Fotos_Estado
  try {
    const fotosCategoryPath = getCategoryFolderPath(DOCUMENT_CATEGORIES.FOTOS_ESTADO);
    const fotosFolderId = await resolveCategoryFolderId({
      drive,
      propertyFolderId,
      categoryPath: fotosCategoryPath,
    });

    const uploadedPhoto = await uploadBufferToDrive({
      drive,
      buffer: photoBuffer,
      fileName: 'selftest-photo.jpg',
      mimeType: 'image/jpeg',
      folderId: fotosFolderId,
    });

    results.push({
      success: true,
      file: 'selftest-photo.jpg',
      category: 'Fotos_Estado',
      fileId: uploadedPhoto.id,
    });
  } catch (error) {
    results.push({
      success: false,
      file: 'selftest-photo.jpg',
      category: 'Fotos_Estado',
      error: error.message,
    });
  }

  // Subir PDF a Contratos
  try {
    const contratosCategoryPath = getCategoryFolderPath(DOCUMENT_CATEGORIES.CONTRATOS, year);
    const contratosFolderId = await resolveCategoryFolderId({
      drive,
      propertyFolderId,
      categoryPath: contratosCategoryPath,
    });

    const uploadedDoc = await uploadBufferToDrive({
      drive,
      buffer: docBuffer,
      fileName: 'selftest-doc.pdf',
      mimeType: 'application/pdf',
      folderId: contratosFolderId,
    });

    results.push({
      success: true,
      file: 'selftest-doc.pdf',
      category: `Contratos/${year}`,
      fileId: uploadedDoc.id,
    });
  } catch (error) {
    results.push({
      success: false,
      file: 'selftest-doc.pdf',
      category: `Contratos/${year}`,
      error: error.message,
    });
  }

  return results;
}

/**
 * Delay helper para dar tiempo a que las operaciones de Drive se sincronicen
 */
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ejecuta el self-test completo
 */
export async function executeSelfTest({ drive, baseFolderId }) {
  const report = {
    steps: [],
    success: true,
    testPropertyAddress: null,
    testPropertyNormalizedAddress: null,
    testPropertyFolderId: null,
  };

  let currentStep = 0;
  const totalSteps = 7;

  try {
    // Paso 1: Verificar /list_properties
    currentStep++;
    report.steps.push({
      step: currentStep,
      total: totalSteps,
      name: 'Verificar listado de propiedades',
      status: 'running',
    });

    const listResult = await listProperties({ drive, baseFolderId });
    if (listResult.message && !listResult.properties) {
      throw new Error(`/list_properties falló: ${listResult.message}`);
    }

    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = `${listResult.properties?.length || 0} propiedades encontradas`;

    // Paso 2: Crear propiedad de prueba
    currentStep++;
    const testAddress = generateTestPropertyName();
    report.testPropertyAddress = testAddress;

    report.steps.push({
      step: currentStep,
      total: totalSteps,
      name: 'Crear propiedad de prueba',
      status: 'running',
      address: testAddress,
    });

    const createResult = await addProperty({
      drive,
      baseFolderId,
      address: testAddress,
    });

    if (!createResult.success) {
      throw new Error(`No se pudo crear la propiedad: ${createResult.message}`);
    }

    report.testPropertyNormalizedAddress = createResult.normalizedAddress;
    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = `Propiedad "${testAddress}" creada`;

    console.log(`[SelfTest] Propiedad creada con normalizedAddress: ${report.testPropertyNormalizedAddress}`);

    // Esperar a que Drive sincronice el catálogo y reintentar hasta 3 veces
    const year = getCurrentYear();
    let testProperty = null;
    let retries = 0;
    const maxRetries = 3;

    while (!testProperty && retries < maxRetries) {
      if (retries > 0) {
        console.log(`[SelfTest] Reintento ${retries}/${maxRetries} - esperando 3 segundos...`);
        await delay(3000);
      } else {
        console.log(`[SelfTest] Esperando 2 segundos para que Drive sincronice...`);
        await delay(2000);
      }

      // Paso 3: Verificar estructura de carpetas
      if (retries === 0) {
        currentStep++;
        report.steps.push({
          step: currentStep,
          total: totalSteps,
          name: 'Verificar estructura de carpetas',
          status: 'running',
        });
      }
      const listResult = await listProperties({ drive, baseFolderId });
      const properties = listResult.properties || [];

      console.log(`[SelfTest] Propiedades en catálogo (${properties.length}):`);
      properties.forEach(p => {
        console.log(`  - ${p.normalizedAddress} (original: ${p.address})`);
      });

      testProperty = properties.find(p => p.normalizedAddress === report.testPropertyNormalizedAddress);

      if (!testProperty) {
        console.log(`[SelfTest] No se encontró propiedad con normalizedAddress: ${report.testPropertyNormalizedAddress}`);
        retries++;
      } else {
        console.log(`[SelfTest] Propiedad encontrada: ${testProperty.normalizedAddress}`);
      }
    }

    if (!testProperty) {
      throw new Error(`Propiedad de prueba no encontrada en el catálogo después de ${maxRetries} intentos. Buscando: "${report.testPropertyNormalizedAddress}"`);
    }

    // Guardar el folderId para cleanup si es necesario
    report.testPropertyFolderId = testProperty.propertyFolderId;

    await verifyFolderStructure({
      drive,
      propertyFolderId: testProperty.propertyFolderId,
      year,
    });

    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = '8 carpetas verificadas correctamente';

    // Paso 4: Subir archivos de prueba
    currentStep++;
    report.steps.push({
      step: currentStep,
      total: totalSteps,
      name: 'Subir archivos de prueba',
      status: 'running',
    });

    const uploadResults = await uploadTestFiles({
      drive,
      propertyFolderId: testProperty.propertyFolderId,
    });

    const uploadFailed = uploadResults.filter(r => !r.success);
    if (uploadFailed.length > 0) {
      throw new Error(`Fallo al subir archivos: ${uploadFailed.map(r => r.error).join(', ')}`);
    }

    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = `${uploadResults.length} archivos subidos correctamente`;
    report.steps[report.steps.length - 1].files = uploadResults;

    // Paso 5: Archivar propiedad
    currentStep++;
    report.steps.push({
      step: currentStep,
      total: totalSteps,
      name: 'Archivar propiedad',
      status: 'running',
    });

    const archiveResult = await archiveProperty({
      drive,
      baseFolderId,
      normalizedAddress: report.testPropertyNormalizedAddress,
    });

    if (!archiveResult.success) {
      throw new Error(`No se pudo archivar: ${archiveResult.message}`);
    }

    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = 'Propiedad archivada correctamente';

    // Esperar a que Drive sincronice
    await delay(1000);

    // Paso 6: Reactivar propiedad
    currentStep++;
    report.steps.push({
      step: currentStep,
      total: totalSteps,
      name: 'Reactivar propiedad',
      status: 'running',
    });

    const unarchiveResult = await unarchiveProperty({
      drive,
      baseFolderId,
      normalizedAddress: report.testPropertyNormalizedAddress,
    });

    if (!unarchiveResult.success) {
      throw new Error(`No se pudo reactivar: ${unarchiveResult.message}`);
    }

    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = 'Propiedad reactivada correctamente';

    // Esperar a que Drive sincronice
    await delay(1000);

    // Paso 7: Eliminar propiedad (cleanup)
    currentStep++;
    report.steps.push({
      step: currentStep,
      total: totalSteps,
      name: 'Eliminar propiedad de prueba (cleanup)',
      status: 'running',
    });

    const deleteResult = await deleteProperty({
      drive,
      baseFolderId,
      normalizedAddress: report.testPropertyNormalizedAddress,
    });

    if (!deleteResult.success) {
      throw new Error(`No se pudo eliminar: ${deleteResult.message}`);
    }

    report.steps[report.steps.length - 1].status = 'success';
    report.steps[report.steps.length - 1].result = 'Propiedad eliminada correctamente';

  } catch (error) {
    report.success = false;
    report.error = error.message;

    // Marcar paso actual como fallido
    if (report.steps.length > 0) {
      const currentStepIdx = report.steps.length - 1;
      report.steps[currentStepIdx].status = 'failed';
      report.steps[currentStepIdx].error = error.message;
    }

    // Intentar cleanup (best-effort) - solo si se creó la propiedad
    if (report.testPropertyNormalizedAddress) {
      console.log(`[SelfTest] Intentando cleanup de propiedad: ${report.testPropertyNormalizedAddress}`);

      try {
        // Esperar un poco antes de intentar cleanup para asegurar consistencia
        await delay(1000);

        const deleteResult = await deleteProperty({
          drive,
          baseFolderId,
          normalizedAddress: report.testPropertyNormalizedAddress,
        });

        if (deleteResult.success) {
          report.cleanupPerformed = true;
          console.log(`[SelfTest] Cleanup exitoso`);
        } else {
          report.cleanupFailed = true;
          report.cleanupError = deleteResult.message || 'deleteProperty retornó success=false';
          console.error(`[SelfTest] Cleanup falló: ${report.cleanupError}`);
        }
      } catch (cleanupError) {
        report.cleanupFailed = true;
        report.cleanupError = cleanupError.message;
        console.error(`[SelfTest] Cleanup lanzó excepción: ${cleanupError.message}`);
      }
    } else {
      console.log(`[SelfTest] No hay propiedad para cleanup (testPropertyNormalizedAddress no definido)`);
    }
  }

  return report;
}
