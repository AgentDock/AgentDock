/**
 * S3-specific types and interfaces
 */

import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export interface S3Config {
  bucket: string;
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  forcePathStyle?: boolean;
  prefix?: string;
  clientConfig?: S3ClientConfig;
}

export interface S3Connection {
  client: S3Client;
  bucket: string;
  prefix?: string;
}

export interface S3Object {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
  ttl?: number;
  size?: number;
  lastModified?: Date;
  etag?: string;
}

export interface S3ListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
  delimiter?: string;
}

export interface S3ListResult {
  keys: string[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface S3UploadOptions {
  partSize?: number;
  queueSize?: number;
  leavePartsOnError?: boolean;
}

export interface S3PresignedUrlOptions {
  expiresIn?: number;
  contentType?: string;
  contentDisposition?: string;
}

export interface S3MultipartUpload {
  uploadId: string;
  key: string;
  upload: Upload;
}

export interface S3Metadata {
  'x-amz-meta-namespace'?: string;
  'x-amz-meta-ttl'?: string;
  'x-amz-meta-created-at'?: string;
  'x-amz-meta-content-type'?: string;
  [key: string]: string | undefined;
}
