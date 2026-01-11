export async function findOrCreateFolder({ drive, name, parentId }) {
  if (!name) {
    throw new Error('Folder name is required');
  }
  if (!parentId) {
    throw new Error('Parent folder ID is required');
  }

  const query = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name',
  });

  return createRes.data;
}

export async function createFolderStructure({ drive, baseFolderId, propertyAddress, year }) {
  if (!baseFolderId) {
    throw new Error('Base folder ID is required');
  }
  if (!propertyAddress) {
    throw new Error('Property address is required');
  }
  if (!year) {
    throw new Error('Year is required');
  }

  const viviendasFolder = await findOrCreateFolder({
    drive,
    name: 'Viviendas',
    parentId: baseFolderId,
  });

  const propertyFolder = await findOrCreateFolder({
    drive,
    name: propertyAddress,
    parentId: viviendasFolder.id,
  });

  const structure = [
    { name: `01_Contratos/${year}`, path: ['01_Contratos', year] },
    { name: '02_Inquilinos_Sensible', path: ['02_Inquilinos_Sensible'] },
    { name: `03_Seguros/${year}`, path: ['03_Seguros', year] },
    { name: `04_Suministros/${year}`, path: ['04_Suministros', year] },
    { name: `05_Comunidad_Impuestos/${year}`, path: ['05_Comunidad_Impuestos', year] },
    { name: `06_Incidencias_Reformas/Facturas/${year}`, path: ['06_Incidencias_Reformas', 'Facturas', year] },
    { name: '07_Fotos_Estado', path: ['07_Fotos_Estado'] },
    { name: '99_Otros', path: ['99_Otros'] },
  ];

  for (const item of structure) {
    let currentParent = propertyFolder.id;
    for (const folderName of item.path) {
      const folder = await findOrCreateFolder({
        drive,
        name: folderName,
        parentId: currentParent,
      });
      currentParent = folder.id;
    }
  }

  return propertyFolder;
}

export async function deleteFolder({ drive, folderId }) {
  if (!folderId) {
    throw new Error('Folder ID is required');
  }

  await drive.files.delete({
    fileId: folderId,
  });
}

export async function moveFolder({ drive, folderId, newParentId }) {
  if (!folderId) {
    throw new Error('Folder ID is required');
  }
  if (!newParentId) {
    throw new Error('New parent ID is required');
  }

  const file = await drive.files.get({
    fileId: folderId,
    fields: 'parents',
  });

  const previousParents = file.data.parents ? file.data.parents.join(',') : '';

  await drive.files.update({
    fileId: folderId,
    addParents: newParentId,
    removeParents: previousParents,
    fields: 'id, parents',
  });
}

export async function uploadBufferToDrive({ drive, buffer, fileName, mimeType, folderId }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!buffer) {
    throw new Error('Buffer is required');
  }
  if (!fileName) {
    throw new Error('File name is required');
  }
  if (!mimeType) {
    throw new Error('MIME type is required');
  }
  if (!folderId) {
    throw new Error('Folder ID is required');
  }

  const { Readable } = await import('node:stream');
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name',
  });

  return response.data;
}

export async function resolveCategoryFolderId({ drive, propertyFolderId, categoryPath }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!propertyFolderId) {
    throw new Error('Property folder ID is required');
  }
  if (!categoryPath || !Array.isArray(categoryPath)) {
    throw new Error('Category path must be an array');
  }

  let currentParentId = propertyFolderId;

  for (const folderName of categoryPath) {
    const folder = await findOrCreateFolder({
      drive,
      name: folderName,
      parentId: currentParentId,
    });
    currentParentId = folder.id;
  }

  return currentParentId;
}

export async function checkFileExists({ drive, folderId, fileName }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!folderId) {
    throw new Error('Folder ID is required');
  }
  if (!fileName) {
    throw new Error('File name is required');
  }

  const query = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  return res.data.files && res.data.files.length > 0;
}

export async function checkMultipleFilesExist({ drive, folderId, fileNames }) {
  if (!drive) {
    throw new Error('Drive client is required');
  }
  if (!folderId) {
    throw new Error('Folder ID is required');
  }
  if (!fileNames || !Array.isArray(fileNames)) {
    throw new Error('File names array is required');
  }

  const existingFiles = [];

  for (const fileName of fileNames) {
    const exists = await checkFileExists({ drive, folderId, fileName });
    if (exists) {
      existingFiles.push(fileName);
    }
  }

  return existingFiles;
}
