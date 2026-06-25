import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';

@Injectable()
export class AttachmentStorageService {
  private readonly rootDir: string;

  constructor(configService: ConfigService) {
    this.rootDir = resolve(
      configService.get<string>('ATTACHMENT_STORAGE_DIR') ??
        join(process.cwd(), 'var', 'attachments'),
    );
  }

  async save(storageKey: string, buffer: Buffer): Promise<void> {
    const path = this.pathFor(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  createReadStream(storageKey: string) {
    return createReadStream(this.pathFor(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.pathFor(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private pathFor(storageKey: string) {
    const path = resolve(this.rootDir, storageKey);
    if (!path.startsWith(this.rootDir)) {
      throw new Error('Invalid attachment storage key');
    }
    return path;
  }
}
