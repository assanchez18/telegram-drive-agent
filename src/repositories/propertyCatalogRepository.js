import { Readable } from 'node:stream';
import { uploadStreamToDrive } from '../drive.js';

const CATALOG_FILE_NAME = '.properties.json';
const CATALOG_VERSION = 1;

function createEmptyCatalog() {
  return {
    version: CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    properties: [],
  };
}

export async function findCatalogFile({ drive, folderId }) {
  const query = `name='${CATALOG_FILE_NAME}' and '${folderId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }

  return null;
}

export async function readCatalog({ drive, folderId }) {
  const catalogFile = await findCatalogFile({ drive, folderId });

  if (!catalogFile) {
    return createEmptyCatalog();
  }

  const res = await drive.files.get(
    { fileId: catalogFile.id, alt: 'media' },
    { responseType: 'text' }
  );

  let catalog;
  try {
    catalog = JSON.parse(res.data);
  } catch (err) {
    throw new Error(`Catalog JSON is corrupted: ${err.message}`);
  }

  if (!catalog.version || !Array.isArray(catalog.properties)) {
    throw new Error('Catalog JSON has invalid structure');
  }

  return catalog;
}

export async function writeCatalog({ drive, folderId, catalog }) {
  const catalogFile = await findCatalogFile({ drive, folderId });

  catalog.updatedAt = new Date().toISOString();

  const jsonContent = JSON.stringify(catalog, null, 2);
  const stream = Readable.from([jsonContent]);

  if (catalogFile) {
    await drive.files.update({
      fileId: catalogFile.id,
      media: {
        mimeType: 'application/json',
        body: stream,
      },
    });
  } else {
    await uploadStreamToDrive({
      drive,
      filename: CATALOG_FILE_NAME,
      mimeType: 'application/json',
      inputStream: stream,
      parentFolderId: folderId,
    });
  }
}

export async function propertyExists({ drive, folderId, normalizedAddress }) {
  const catalog = await readCatalog({ drive, folderId });
  return catalog.properties.some(
    (p) => p.normalizedAddress === normalizedAddress
  );
}

export async function addProperty({ drive, folderId, property }) {
  const catalog = await readCatalog({ drive, folderId });

  const exists = catalog.properties.some(
    (p) => p.normalizedAddress === property.normalizedAddress && p.status !== 'deleted'
  );

  if (exists) {
    throw new Error('Property already exists');
  }

  catalog.properties.push({
    address: property.address,
    normalizedAddress: property.normalizedAddress,
    propertyFolderId: property.propertyFolderId,
    createdAt: property.createdAt || new Date().toISOString(),
    status: 'active',
  });

  await writeCatalog({ drive, folderId, catalog });
}

export async function listProperties({ drive, folderId }) {
  const catalog = await readCatalog({ drive, folderId });
  return catalog.properties
    .filter((p) => p.status === 'active' || !p.status)
    .sort((a, b) => a.address.localeCompare(b.address));
}

export async function listArchivedProperties({ drive, folderId }) {
  const catalog = await readCatalog({ drive, folderId });
  return catalog.properties
    .filter((p) => p.status === 'archived')
    .sort((a, b) => a.address.localeCompare(b.address));
}

export async function deleteProperty({ drive, folderId, normalizedAddress }) {
  const catalog = await readCatalog({ drive, folderId });

  const propertyIndex = catalog.properties.findIndex(
    (p) => p.normalizedAddress === normalizedAddress && p.status !== 'deleted'
  );

  if (propertyIndex === -1) {
    throw new Error('Property not found');
  }

  const property = catalog.properties[propertyIndex];
  const updatedProperty = {
    ...property,
    status: 'deleted',
    deletedAt: new Date().toISOString(),
  };
  catalog.properties[propertyIndex] = updatedProperty;

  await writeCatalog({ drive, folderId, catalog });

  return updatedProperty;
}

export async function archiveProperty({ drive, folderId, normalizedAddress }) {
  const catalog = await readCatalog({ drive, folderId });

  const propertyIndex = catalog.properties.findIndex(
    (p) => p.normalizedAddress === normalizedAddress && p.status === 'active'
  );

  if (propertyIndex === -1) {
    throw new Error('Property not found');
  }

  const property = catalog.properties[propertyIndex];
  const updatedProperty = {
    ...property,
    status: 'archived',
    archivedAt: new Date().toISOString(),
  };
  catalog.properties[propertyIndex] = updatedProperty;

  await writeCatalog({ drive, folderId, catalog });

  return updatedProperty;
}

export async function unarchiveProperty({ drive, folderId, normalizedAddress }) {
  const catalog = await readCatalog({ drive, folderId });

  const propertyIndex = catalog.properties.findIndex(
    (p) => p.normalizedAddress === normalizedAddress && p.status === 'archived'
  );

  if (propertyIndex === -1) {
    throw new Error('Archived property not found');
  }

  const property = catalog.properties[propertyIndex];
  const updatedProperty = {
    ...property,
    status: 'active',
    unarchivedAt: new Date().toISOString(),
  };
  catalog.properties[propertyIndex] = updatedProperty;

  await writeCatalog({ drive, folderId, catalog });

  return updatedProperty;
}
