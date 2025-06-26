/**
 * Type declarations for AWS SDK
 * This file provides minimal type definitions for AWS SDK to resolve linter errors
 * when the @aws-sdk packages are marked as external
 */

declare module '@aws-sdk/client-s3' {
  export interface S3ClientConfig {
    region?: string;
    endpoint?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
    forcePathStyle?: boolean;
    [key: string]: any;
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    send(command: any): Promise<any>;
    destroy(): void;
  }

  export class GetObjectCommand {
    constructor(input: any);
  }

  export class PutObjectCommand {
    constructor(input: any);
  }

  export class DeleteObjectCommand {
    constructor(input: any);
  }

  export class DeleteObjectsCommand {
    constructor(input: any);
  }

  export class HeadObjectCommand {
    constructor(input: any);
  }

  export class ListObjectsV2Command {
    constructor(input: any);
  }

  export class HeadBucketCommand {
    constructor(input: any);
  }

  export class CreateMultipartUploadCommand {
    constructor(input: any);
  }

  export class UploadPartCommand {
    constructor(input: any);
  }

  export class CompleteMultipartUploadCommand {
    constructor(input: any);
  }

  export class AbortMultipartUploadCommand {
    constructor(input: any);
  }
}

declare module '@aws-sdk/lib-storage' {
  import { S3Client } from '@aws-sdk/client-s3';

  export interface UploadOptions {
    client: S3Client;
    params: any;
    queueSize?: number;
    partSize?: number;
    leavePartsOnError?: boolean;
  }

  export class Upload {
    constructor(options: UploadOptions);
    done(): Promise<any>;
    abort(): Promise<void>;
    on(event: string, listener: (event: any) => void): void;
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  import { S3Client } from '@aws-sdk/client-s3';

  export function getSignedUrl(
    client: S3Client,
    command: any,
    options?: { expiresIn?: number }
  ): Promise<string>;
} 