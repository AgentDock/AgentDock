# S3 Storage Adapter

The S3 adapter provides object storage capabilities using AWS S3 or S3-compatible services.

## Features

- ✅ Object storage for any size data
- ✅ S3-compatible services support (MinIO, etc.)
- ✅ Metadata-based TTL
- ✅ Namespace isolation via prefixes
- ✅ Batch operations
- ✅ Presigned URLs for direct access
- ❌ List operations (not supported)
- ❌ Transactions (not applicable)

## Configuration

```typescript
import { S3Adapter } from '@agentdock/core';

// AWS S3
const s3Adapter = new S3Adapter({
  bucket: 'my-bucket',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY',
    secretAccessKey: 'YOUR_SECRET_KEY',
  },
  prefix: 'agentdock', // Optional: prefix all keys
});

// S3-compatible service (e.g., MinIO)
const minioAdapter = new S3Adapter({
  bucket: 'my-bucket',
  endpoint: 'http://localhost:9000',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});
```

## Usage

### Basic Operations

```typescript
// Set a value
await adapter.set('key', { data: 'value' });

// Get a value
const value = await adapter.get('key');

// Delete a key
await adapter.delete('key');

// Check existence
const exists = await adapter.exists('key');
```

### TTL Support

```typescript
// Set with TTL (60 seconds)
await adapter.set('temp-key', 'value', { ttlSeconds: 60 });

// Check remaining TTL
const ttl = await adapter.ttl('temp-key');
```

### Batch Operations

```typescript
// Set multiple values
await adapter.setMany({
  'key1': 'value1',
  'key2': 'value2',
});

// Get multiple values
const values = await adapter.getMany(['key1', 'key2']);

// Delete multiple keys
const deleted = await adapter.deleteMany(['key1', 'key2']);
```

### S3-Specific Features

```typescript
// Get presigned URL for direct download
const downloadUrl = await adapter.getPresignedUrl('document.pdf', 'get', {
  expiresIn: 3600, // 1 hour
});

// Get presigned URL for direct upload
const uploadUrl = await adapter.getPresignedUrl('document.pdf', 'put', {
  expiresIn: 3600,
  contentType: 'application/pdf',
});
```

## Performance Considerations

1. **Batch Operations**: S3 doesn't have native batch get/set, so operations are parallelized
2. **List Operations**: Use pagination for large datasets
3. **TTL**: Implemented via metadata, not native S3 lifecycle policies
4. **Large Objects**: Consider multipart upload for files > 100MB

## Limitations

- No native list data structure support
- No transactions
- TTL is checked on read (not automatically deleted)
- Batch operations are limited by S3 API rate limits

## External Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
``` 