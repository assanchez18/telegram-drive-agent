import { normalizeAddress } from '../domain/normalizeAddress.js';
import { createFolderStructure } from '../adapters/driveAdapter.js';
import {
  propertyExists,
  addProperty as addPropertyToRepo,
  listProperties as listPropertiesFromRepo,
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

  return { success: true, message: `✅ Vivienda "${address}" creada con éxito` };
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
