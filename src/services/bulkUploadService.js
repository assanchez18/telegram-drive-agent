import { getCategoryFolderPath } from '../domain/DocumentCategory.js';
import { validateYear } from '../domain/Year.js';
import { uploadBufferToDrive, resolveCategoryFolderId, checkMultipleFilesExist } from '../adapters/driveAdapter.js';
import { downloadTelegramFile } from '../adapters/telegramFileAdapter.js';

export async function checkDuplicateFiles({
  drive,
  files,
  propertyFolderId,
  category,
  year,
}) {
  if (!files || !Array.isArray(files)) {
    throw new Error('Files array is required');
  }
  if (!propertyFolderId) {
    throw new Error('Property folder ID is required');
  }
  if (!category) {
    throw new Error('Category is required');
  }

  const categoryPath = getCategoryFolderPath(category, year);
  const targetFolderId = await resolveCategoryFolderId({
    drive,
    propertyFolderId,
    categoryPath,
  });

  const fileNames = files.map(f => f.fileName);
  const duplicates = await checkMultipleFilesExist({
    drive,
    folderId: targetFolderId,
    fileNames,
  });

  return duplicates;
}

export async function uploadBulkFiles({
  drive,
  bot,
  botToken,
  files,
  propertyFolderId,
  category,
  year,
  onFileStart,
  onFileResult,
}) {
  if (!files || !Array.isArray(files)) {
    throw new Error('Files array is required');
  }
  if (!propertyFolderId) {
    throw new Error('Property folder ID is required');
  }
  if (!category) {
    throw new Error('Category is required');
  }

  const categoryPath = getCategoryFolderPath(category, year);
  const targetFolderId = await resolveCategoryFolderId({
    drive,
    propertyFolderId,
    categoryPath,
  });

  const results = [];

  for (const file of files) {
    if (onFileStart) await onFileStart(file.fileName);

    try {
      const buffer = await downloadTelegramFile(bot, botToken, file.fileId);

      const uploaded = await uploadBufferToDrive({
        drive,
        buffer,
        fileName: file.fileName,
        mimeType: file.mimeType,
        folderId: targetFolderId,
      });

      if (onFileResult) await onFileResult(file.fileName, true, null);

      results.push({
        success: true,
        fileName: file.fileName,
        driveFileId: uploaded.id,
      });
    } catch (error) {
      if (onFileResult) await onFileResult(file.fileName, false, error.message);

      results.push({
        success: false,
        fileName: file.fileName,
        error: error.message,
      });
    }
  }

  return results;
}

export function validateBulkUploadRequest({ propertyFolderId, category, year }) {
  if (!propertyFolderId) {
    return { valid: false, error: 'Property is required' };
  }

  if (!category) {
    return { valid: false, error: 'Category is required' };
  }

  if (year) {
    const yearValidation = validateYear(year);
    if (!yearValidation.valid) {
      return yearValidation;
    }
  }

  return { valid: true };
}
