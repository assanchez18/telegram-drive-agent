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
