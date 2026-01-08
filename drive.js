import { google } from 'googleapis';
import { PassThrough } from 'node:stream';
/**
 * Crea un cliente de Drive API
 */
export function createDriveClient(authClient) {
  return google.drive({ version: 'v3', auth: authClient });
}
/**
 * Sube un archivo de texto simple a Drive
 */
export async function uploadStreamToDrive({
                                            drive,
                                            filename,
                                            mimeType = 'application/octet-stream',
                                            inputStream,
                                            parentFolderId,
                                          }) {
  if (!parentFolderId) throw new Error('Falta parentFolderId');

  const fileMetadata = {
    name: filename,
    parents: [parentFolderId],
  };

  const body = new PassThrough();
  inputStream.pipe(body);

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType, body },
    fields: 'id,name,parents',
  });

  return res.data;
}

