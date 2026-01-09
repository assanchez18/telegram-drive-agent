import { describe, it, expect, vi } from 'vitest';
import { createDriveClient, uploadStreamToDrive } from '../src/drive.js';
import { Readable } from 'node:stream';

describe('createDriveClient', () => {
  it('crea un cliente de Drive API', () => {
    const mockAuth = { mock: 'auth' };
    const client = createDriveClient(mockAuth);

    expect(client).toBeDefined();
    expect(client.files).toBeDefined();
  });
});

describe('uploadStreamToDrive', () => {
  it('sube un archivo a Drive correctamente', async () => {
    const mockDrive = {
      files: {
        create: vi.fn().mockResolvedValue({
          data: {
            id: 'file-id-123',
            name: 'test.txt',
            parents: ['parent-folder-id'],
          },
        }),
      },
    };

    const inputStream = Readable.from(['test content']);

    const result = await uploadStreamToDrive({
      drive: mockDrive,
      filename: 'test.txt',
      mimeType: 'text/plain',
      inputStream,
      parentFolderId: 'parent-folder-id',
    });

    expect(result).toEqual({
      id: 'file-id-123',
      name: 'test.txt',
      parents: ['parent-folder-id'],
    });

    expect(mockDrive.files.create).toHaveBeenCalledWith({
      requestBody: {
        name: 'test.txt',
        parents: ['parent-folder-id'],
      },
      media: {
        mimeType: 'text/plain',
        body: expect.any(Object),
      },
      fields: 'id,name,parents',
    });
  });

  it('usa mimeType por defecto si no se proporciona', async () => {
    const mockDrive = {
      files: {
        create: vi.fn().mockResolvedValue({
          data: { id: 'file-id', name: 'file.bin', parents: [] },
        }),
      },
    };

    const inputStream = Readable.from(['binary data']);

    await uploadStreamToDrive({
      drive: mockDrive,
      filename: 'file.bin',
      inputStream,
      parentFolderId: 'parent-id',
    });

    const call = mockDrive.files.create.mock.calls[0][0];
    expect(call.media.mimeType).toBe('application/octet-stream');
  });

  it('lanza error si falta parentFolderId', async () => {
    const mockDrive = { files: {} };
    const inputStream = Readable.from(['test']);

    await expect(
      uploadStreamToDrive({
        drive: mockDrive,
        filename: 'test.txt',
        inputStream,
        parentFolderId: '',
      })
    ).rejects.toThrow('Falta parentFolderId');
  });
});
