export class BulkFile {
  constructor({ fileId, fileUniqueId, fileName, mimeType }) {
    if (!fileId) {
      throw new Error('File ID is required');
    }
    if (!fileUniqueId) {
      throw new Error('File unique ID is required');
    }
    if (!mimeType) {
      throw new Error('MIME type is required');
    }

    this.fileId = fileId;
    this.fileUniqueId = fileUniqueId;
    this.mimeType = mimeType;
    this.fileName = fileName || this._generatePhotoName(fileUniqueId, mimeType);
  }

  _generatePhotoName(fileUniqueId, mimeType) {
    if (mimeType.startsWith('video/')) {
      return `video_${fileUniqueId}.mp4`;
    }
    return `photo_${fileUniqueId}.jpg`;
  }
}
