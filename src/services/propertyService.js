import { normalizeAddress } from '../domain/normalizeAddress.js';
import { createFolderStructure, deleteFolder, moveFolder, findOrCreateFolder } from '../adapters/driveAdapter.js';
import {
  propertyExists,
  addProperty as addPropertyToRepo,
  listProperties as listPropertiesFromRepo,
  deleteProperty as deletePropertyFromRepo,
  archiveProperty as archivePropertyInRepo,
  listArchivedProperties as listArchivedPropertiesFromRepo,
  unarchiveProperty as unarchivePropertyInRepo,
} from '../repositories/propertyCatalogRepository.js';

export async function addProperty({ drive, baseFolderId, address }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }
  if (!address) {
    throw new Error('Address is required');
  }

  const normalizedAddress = normalizeAddress(address);

  if (!normalizedAddress) {
    throw new Error('Address cannot be empty after normalization');
  }

  const exists = await propertyExists({ drive, folderId: baseFolderId, normalizedAddress });

  if (exists) {
    return { success: false, message: 'La vivienda ya existe' };
  }

  const year = String(new Date().getFullYear());

  const propertyFolder = await createFolderStructure({
    drive,
    baseFolderId,
    propertyAddress: address,
    year,
  });

  await addPropertyToRepo({
    drive,
    folderId: baseFolderId,
    property: {
      address,
      normalizedAddress,
      propertyFolderId: propertyFolder.id,
      createdAt: new Date().toISOString(),
    },
  });

  return { success: true, message: `✅ Vivienda "${address}" creada con éxito`, normalizedAddress };
}

export async function listProperties({ drive, baseFolderId }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }

  const properties = await listPropertiesFromRepo({ drive, folderId: baseFolderId });

  if (properties.length === 0) {
    return {
      properties: [],
      message: 'No hay viviendas registradas. Usa /add_property para añadir una.',
    };
  }

  return { properties, message: null };
}

export async function deleteProperty({ drive, baseFolderId, normalizedAddress }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }
  if (!normalizedAddress) {
    throw new Error('Normalized address is required');
  }

  const deletedProperty = await deletePropertyFromRepo({
    drive,
    folderId: baseFolderId,
    normalizedAddress,
  });

  await deleteFolder({ drive, folderId: deletedProperty.propertyFolderId });

  return {
    success: true,
    message: `🗑️ Vivienda "${deletedProperty.address}" eliminada del catálogo y de Drive`,
    property: deletedProperty,
  };
}

export async function archiveProperty({ drive, baseFolderId, normalizedAddress }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }
  if (!normalizedAddress) {
    throw new Error('Normalized address is required');
  }

  const archivoFolder = await findOrCreateFolder({
    drive,
    name: 'Archivo',
    parentId: baseFolderId,
  });

  const archivedProperty = await archivePropertyInRepo({
    drive,
    folderId: baseFolderId,
    normalizedAddress,
  });

  await moveFolder({
    drive,
    folderId: archivedProperty.propertyFolderId,
    newParentId: archivoFolder.id,
  });

  return {
    success: true,
    message: `📦 Vivienda "${archivedProperty.address}" archivada correctamente`,
    property: archivedProperty,
  };
}

export async function listArchivedProperties({ drive, baseFolderId }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }

  const properties = await listArchivedPropertiesFromRepo({ drive, folderId: baseFolderId });

  if (properties.length === 0) {
    return {
      properties: [],
      message: 'No hay viviendas archivadas.',
    };
  }

  return { properties, message: null };
}

export async function unarchiveProperty({ drive, baseFolderId, normalizedAddress }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }
  if (!normalizedAddress) {
    throw new Error('Normalized address is required');
  }

  const viviendasFolder = await findOrCreateFolder({
    drive,
    name: 'Viviendas',
    parentId: baseFolderId,
  });

  const unarchivedProperty = await unarchivePropertyInRepo({
    drive,
    folderId: baseFolderId,
    normalizedAddress,
  });

  await moveFolder({
    drive,
    folderId: unarchivedProperty.propertyFolderId,
    newParentId: viviendasFolder.id,
  });

  return {
    success: true,
    message: `♻️ Vivienda "${unarchivedProperty.address}" reactivada correctamente`,
    property: unarchivedProperty,
  };
}
