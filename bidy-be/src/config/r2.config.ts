/**
 * Centralized Cloudflare R2 configuration
 * R2 speaks the S3 API, so this uses @aws-sdk/client-s3 pointed at the R2 endpoint.
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET_NAME = process.env.BUCKET_NAME;

// Normalize endpoint: strip trailing slash and bucket name if accidentally appended
const normalizedEndpoint = process.env.R2_ENDPOINT
  ? process.env.R2_ENDPOINT.replace(/\/+$/, '').replace(new RegExp(`/${BUCKET_NAME}$`), '')
  : undefined;

const s3 = new S3Client({
  endpoint: normalizedEndpoint,
  region: 'auto',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

/**
 * Upload single file to R2
 *
 * No URL is returned: the bucket is private and every read goes through
 * getPresignedUrl, so a URL has no meaning outside the moment it is signed.
 *
 * @param {Object} file - File object with buffer, originalname, mimetype
 * @param {string} folder - Optional folder prefix (e.g., 'auctions', 'categories')
 * @returns {Promise<Object>} Upload result with the stored object key
 */
const uploadFileToS3 = async (file: any, folder = '') => {
  try {
    // Create a clean filename without spaces and special characters
    const cleanFilename = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .toLowerCase();

    const key = folder
      ? `${folder}/${Date.now()}_${Math.random().toString(36).substring(2)}_${cleanFilename}`
      : `${Date.now()}_${Math.random().toString(36).substring(2)}_${cleanFilename}`;

    const result = await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Note: ACL removed - bucket permissions handle public access
      })
    );

    return {
      key: key,
      bucket: BUCKET_NAME,
      etag: result.ETag,
      size: file.buffer.length,
      mimetype: file.mimetype,
      originalname: file.originalname,
    };
  } catch (error: any) {
    console.error('R2 Upload Error:', error);
    throw new Error(`Failed to upload file to R2: ${error.message}`);
  }
};

/**
 * Upload multiple files to R2
 * @param {Array} files - Array of file objects
 * @param {string} folder - Optional folder prefix
 * @returns {Promise<Array>} Array of upload results
 */
const uploadMultipleFilesToS3 = async (files: any[], folder = '') => {
  try {
    const uploadPromises = files.map((file: any) => uploadFileToS3(file, folder));
    return await Promise.all(uploadPromises);
  } catch (error: any) {
    console.error('R2 Multiple Upload Error:', error);
    throw new Error(`Failed to upload multiple files to R2: ${error.message}`);
  }
};

/**
 * Get presigned URL for R2 object
 * @param {string} key - Object key
 * @param {number} expires - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
const getPresignedUrl = async (key: string, expires = 3600) => {
  try {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      { expiresIn: expires }
    );
  } catch (error: any) {
    console.error('Presigned URL Error:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Delete file from R2
 * @param {string} key - Object key
 * @returns {Promise<Object>} Deletion result
 */
const deleteFileFromS3 = async (key: string) => {
  try {
    return await s3.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
  } catch (error: any) {
    console.error('R2 Delete Error:', error);
    throw new Error(`Failed to delete file from R2: ${error.message}`);
  }
};

/**
 * Check if R2 credentials are valid
 * @returns {Promise<boolean>} True if credentials are valid
 */
const validateS3Connection = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return true;
  } catch (error: any) {
    console.error('R2 Connection Validation Failed:', error);
    return false;
  }
};

export {
  s3,
  uploadFileToS3,
  uploadMultipleFilesToS3,
  getPresignedUrl,
  deleteFileFromS3,
  validateS3Connection,
};
