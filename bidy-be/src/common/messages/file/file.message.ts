export const FILE_MESSAGE = {
  UPLOAD_SUCCESS: 'File uploaded successfully',
  URL_SUCCESS: 'File URL generated successfully',

  NO_FILE_PROVIDED: 'No file provided',
  INVALID_PURPOSE:
    'purpose must be one of: product, auction, category, review (avatars go through POST /api/v1/users/avatar)',
  FILE_NOT_FOUND: 'File not found',
  UPLOAD_FAILED: 'Failed to upload file',
  URL_FAILED: 'Failed to generate file URL',

  // Service error keys
  FILE_NOT_REGISTERED: 'FILE_NOT_REGISTERED',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
};
