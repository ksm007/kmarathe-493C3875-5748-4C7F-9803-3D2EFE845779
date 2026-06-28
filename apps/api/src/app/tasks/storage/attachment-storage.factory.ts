import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AttachmentStorageAdapter } from './attachment-storage.adapter';
import {
  CloudinaryAttachmentStorageAdapter,
  CloudinaryPort,
} from './cloudinary-attachment-storage.adapter';
import { LocalDiskAttachmentStorageAdapter } from './local-disk-attachment-storage.adapter';

export type AttachmentStorageProvider = 'local' | 'cloudinary';

/**
 * Select and construct the attachment storage adapter from env config.
 *
 * `ATTACHMENT_STORAGE_PROVIDER` chooses the backend (`local` by default, so
 * development and tests fall back to local disk - the seam's placeholder
 * implementation). `cloudinary` is the cloud/production provider and reads the
 * `CLOUDINARY_*` config validated by {@link validateEnv}.
 */
export function createAttachmentStorageAdapter(
  configService: ConfigService,
): AttachmentStorageAdapter {
  const provider = (
    configService.get<string>('ATTACHMENT_STORAGE_PROVIDER') ?? 'local'
  ).toLowerCase() as AttachmentStorageProvider;

  if (provider === 'cloudinary') {
    return createCloudinaryAdapter(configService);
  }

  const rootDir =
    configService.get<string>('ATTACHMENT_STORAGE_DIR') ??
    join(process.cwd(), 'var', 'attachments');
  return new LocalDiskAttachmentStorageAdapter(rootDir);
}

function createCloudinaryAdapter(
  configService: ConfigService,
): CloudinaryAttachmentStorageAdapter {
  const url = configService.get<string>('CLOUDINARY_URL');
  const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
  const apiKey = configService.get<string>('CLOUDINARY_API_KEY');
  const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET');

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  } else if (url) {
    cloudinary.config({ ...parseCloudinaryUrl(url), secure: true });
  } else {
    throw new Error(
      'Cloudinary attachment storage requires CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET',
    );
  }

  return new CloudinaryAttachmentStorageAdapter(
    cloudinary as unknown as CloudinaryPort,
  );
}

/** Parse a `cloudinary://<api_key>:<api_secret>@<cloud_name>` connection URL. */
function parseCloudinaryUrl(url: string): {
  api_key: string;
  api_secret: string;
  cloud_name: string;
} {
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) {
    throw new Error(
      'Invalid CLOUDINARY_URL: expected cloudinary://<api_key>:<api_secret>@<cloud_name>',
    );
  }
  return { api_key: match[1], api_secret: match[2], cloud_name: match[3] };
}
