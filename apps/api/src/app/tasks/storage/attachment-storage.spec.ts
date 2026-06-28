import { ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'http';
import { PassThrough, Readable } from 'stream';
import { createAttachmentStorageAdapter } from './attachment-storage.factory';
import {
  CloudinaryAttachmentStorageAdapter,
  CloudinaryPort,
  fetchWithRedirects,
} from './cloudinary-attachment-storage.adapter';
import { LocalDiskAttachmentStorageAdapter } from './local-disk-attachment-storage.adapter';

function readAll(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

describe('createAttachmentStorageAdapter (selection)', () => {
  it('defaults to the local-disk adapter when no provider is configured', () => {
    const adapter = createAttachmentStorageAdapter(new ConfigService({}));
    expect(adapter).toBeInstanceOf(LocalDiskAttachmentStorageAdapter);
  });

  it('selects the local-disk adapter when provider is "local"', () => {
    const adapter = createAttachmentStorageAdapter(
      new ConfigService({ ATTACHMENT_STORAGE_PROVIDER: 'local' }),
    );
    expect(adapter).toBeInstanceOf(LocalDiskAttachmentStorageAdapter);
  });

  it('selects the Cloudinary adapter from explicit credentials', () => {
    const adapter = createAttachmentStorageAdapter(
      new ConfigService({
        ATTACHMENT_STORAGE_PROVIDER: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
    );
    expect(adapter).toBeInstanceOf(CloudinaryAttachmentStorageAdapter);
  });

  it('selects the Cloudinary adapter from a CLOUDINARY_URL', () => {
    const adapter = createAttachmentStorageAdapter(
      new ConfigService({
        ATTACHMENT_STORAGE_PROVIDER: 'cloudinary',
        CLOUDINARY_URL: 'cloudinary://key:secret@demo',
      }),
    );
    expect(adapter).toBeInstanceOf(CloudinaryAttachmentStorageAdapter);
  });

  it('is case-insensitive about the provider value', () => {
    const adapter = createAttachmentStorageAdapter(
      new ConfigService({
        ATTACHMENT_STORAGE_PROVIDER: 'Cloudinary',
        CLOUDINARY_URL: 'cloudinary://key:secret@demo',
      }),
    );
    expect(adapter).toBeInstanceOf(CloudinaryAttachmentStorageAdapter);
  });

  it('throws when the Cloudinary provider has no credentials', () => {
    expect(() =>
      createAttachmentStorageAdapter(
        new ConfigService({ ATTACHMENT_STORAGE_PROVIDER: 'cloudinary' }),
      ),
    ).toThrow(/CLOUDINARY_URL or/);
  });

  it('throws on an invalid CLOUDINARY_URL', () => {
    expect(() =>
      createAttachmentStorageAdapter(
        new ConfigService({
          ATTACHMENT_STORAGE_PROVIDER: 'cloudinary',
          CLOUDINARY_URL: 'not-a-cloudinary-url',
        }),
      ),
    ).toThrow(/Invalid CLOUDINARY_URL/);
  });
});

describe('CloudinaryAttachmentStorageAdapter (behavior)', () => {
  const storageKey = 'org-1/task-1/uuid-screen.png';
  // public id drops the trailing extension; Cloudinary derives the format.
  const publicId = 'org-1/task-1/uuid-screen';

  let uploadStream: { end: jest.Mock; on: jest.Mock };
  let upload_stream: jest.Mock;
  let destroy: jest.Mock;
  let url: jest.Mock;
  let fetchStream: jest.Mock;
  let cloudinary: CloudinaryPort;
  let adapter: CloudinaryAttachmentStorageAdapter;

  beforeEach(() => {
    uploadStream = { end: jest.fn(), on: jest.fn() };
    upload_stream = jest.fn().mockReturnValue(uploadStream);
    destroy = jest.fn();
    url = jest.fn().mockReturnValue('https://res.cloudinary.com/demo/signed.png');
    fetchStream = jest.fn();
    cloudinary = {
      uploader: { upload_stream, destroy },
      url,
    } as unknown as CloudinaryPort;
    adapter = new CloudinaryAttachmentStorageAdapter(cloudinary, { fetchStream });
  });

  it('save uploads the buffer under the extension-stripped public id', async () => {
    // The SDK invokes the callback with (error, result) on completion.
    upload_stream.mockImplementation((_options, callback) => {
      queueMicrotask(() => callback(undefined, { public_id: publicId }));
      return uploadStream;
    });
    const body = Buffer.from('png-data');

    await adapter.save(storageKey, body);

    expect(upload_stream).toHaveBeenCalledTimes(1);
    expect(upload_stream.mock.calls[0][0]).toMatchObject({
      public_id: publicId,
      resource_type: 'image',
      type: 'authenticated',
      overwrite: true,
    });
    expect(uploadStream.end).toHaveBeenCalledWith(body);
  });

  it('save rejects when the upload reports an error', async () => {
    upload_stream.mockImplementation((_options, callback) => {
      queueMicrotask(() => callback(new Error('upload failed'), undefined));
      return uploadStream;
    });

    await expect(adapter.save(storageKey, Buffer.from('x'))).rejects.toThrow(
      'upload failed',
    );
  });

  it('createReadStream signs a private URL and proxies the bytes through', async () => {
    const source = new PassThrough();
    fetchStream.mockResolvedValueOnce({ stream: source, byteLength: 11 });

    const stream = adapter.createReadStream(storageKey);

    expect(url).toHaveBeenCalledWith(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      secure: true,
      sign_url: true,
    });

    await Promise.resolve();
    source.end('object-bytes');

    await expect(readAll(stream)).resolves.toBe('object-bytes');
    expect(fetchStream).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/signed.png',
    );
  });

  it('createReadStream surfaces fetch failures as a stream error', async () => {
    fetchStream.mockRejectedValueOnce(new Error('cloudinary down'));

    const stream = adapter.createReadStream(storageKey);

    await expect(readAll(stream)).rejects.toThrow('cloudinary down');
  });

  it('openReadStream returns the stream and the upstream byteLength', async () => {
    const source = new PassThrough();
    fetchStream.mockResolvedValueOnce({ stream: source, byteLength: 11 });

    const { stream, byteLength } = await adapter.openReadStream(storageKey);

    expect(byteLength).toBe(11);
    expect(fetchStream).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/signed.png',
    );
    source.end('object-bytes');
    await expect(readAll(stream)).resolves.toBe('object-bytes');
  });

  it('openReadStream returns null byteLength when the upstream omits Content-Length', async () => {
    const source = new PassThrough();
    fetchStream.mockResolvedValueOnce({ stream: source, byteLength: null });

    const { byteLength } = await adapter.openReadStream(storageKey);

    expect(byteLength).toBeNull();
  });

  it('openReadStream rejects when the fetch fails', async () => {
    fetchStream.mockRejectedValueOnce(new Error('cloudinary down'));

    await expect(adapter.openReadStream(storageKey)).rejects.toThrow('cloudinary down');
  });

  it('remove destroys the asset by public id', async () => {
    destroy.mockResolvedValueOnce({ result: 'ok' });

    await adapter.remove(storageKey);

    expect(destroy).toHaveBeenCalledWith(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      invalidate: true,
    });
  });

  it('remove treats a missing asset (not found) as already deleted', async () => {
    destroy.mockResolvedValueOnce({ result: 'not found' });

    await expect(adapter.remove(storageKey)).resolves.toBeUndefined();
  });

  it('remove throws on an unexpected destroy result', async () => {
    destroy.mockResolvedValueOnce({ result: 'error' });

    await expect(adapter.remove(storageKey)).rejects.toThrow(
      /Cloudinary delete failed/,
    );
  });
});

describe('fetchWithRedirects (https redirect logic)', () => {
  type GetFn = (
    url: string,
    cb: (res: IncomingMessage) => void,
  ) => { on(event: string, cb: (e: Error) => void): unknown };

  function fakeResponse(opts: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: string;
  }): IncomingMessage {
    const pt = new PassThrough();
    Object.assign(pt, {
      statusCode: opts.statusCode,
      headers: opts.headers ?? {},
    });
    process.nextTick(() => {
      if (opts.body !== undefined) {
        pt.push(Buffer.from(opts.body));
      }
      pt.push(null);
    });
    return pt as unknown as IncomingMessage;
  }

  function makeGetFn(responses: IncomingMessage[]): GetFn {
    let i = 0;
    return (_url, cb) => {
      const resp = responses[i++];
      process.nextTick(() => cb(resp));
      return { on: (_e: string, _cb: (e: Error) => void) => ({}) };
    };
  }

  it('returns stream and byteLength on a direct 200', async () => {
    const r = fakeResponse({ statusCode: 200, headers: { 'content-length': '42' }, body: 'hello' });
    const { stream, byteLength } = await fetchWithRedirects('https://res.cloudinary.com/img.jpg', 0, makeGetFn([r]));
    expect(byteLength).toBe(42);
    await expect(readAll(stream)).resolves.toBe('hello');
  });

  it('follows a single safe redirect within cloudinary.com', async () => {
    const redirect = fakeResponse({ statusCode: 302, headers: { location: 'https://res.cloudinary.com/img2.jpg' } });
    const body = fakeResponse({ statusCode: 200, headers: { 'content-length': '10' }, body: 'bytes-here' });
    const { stream, byteLength } = await fetchWithRedirects('https://cdn.cloudinary.com/img.jpg', 0, makeGetFn([redirect, body]));
    expect(byteLength).toBe(10);
    await expect(readAll(stream)).resolves.toBe('bytes-here');
  });

  it('rejects a redirect to an off-domain host', async () => {
    const r = fakeResponse({ statusCode: 302, headers: { location: 'https://evil.com/steal.jpg' } });
    await expect(
      fetchWithRedirects('https://res.cloudinary.com/img.jpg', 0, makeGetFn([r])),
    ).rejects.toThrow(/off-domain host/);
  });

  it('rejects a redirect to a non-https URL', async () => {
    const r = fakeResponse({ statusCode: 302, headers: { location: 'http://res.cloudinary.com/img.jpg' } });
    await expect(
      fetchWithRedirects('https://res.cloudinary.com/img.jpg', 0, makeGetFn([r])),
    ).rejects.toThrow(/non-https scheme/);
  });

  it('rejects when the redirect hop cap is exceeded', async () => {
    const redirects = Array.from({ length: 6 }, () =>
      fakeResponse({ statusCode: 302, headers: { location: 'https://res.cloudinary.com/img.jpg' } }),
    );
    await expect(
      fetchWithRedirects('https://res.cloudinary.com/img.jpg', 0, makeGetFn(redirects)),
    ).rejects.toThrow(/exceeded.*redirect/);
  });

  it('returns null byteLength when Content-Length is malformed', async () => {
    const r = fakeResponse({ statusCode: 200, headers: { 'content-length': 'chunked' }, body: 'data' });
    const { byteLength } = await fetchWithRedirects('https://res.cloudinary.com/img.jpg', 0, makeGetFn([r]));
    expect(byteLength).toBeNull();
  });

  it('returns null byteLength when Content-Length is absent', async () => {
    const r = fakeResponse({ statusCode: 200, body: 'data' });
    const { byteLength } = await fetchWithRedirects('https://res.cloudinary.com/img.jpg', 0, makeGetFn([r]));
    expect(byteLength).toBeNull();
  });
});
