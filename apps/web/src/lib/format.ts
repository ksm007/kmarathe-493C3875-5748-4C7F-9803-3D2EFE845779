import { ApiClientError } from './api-client';

export function formatError(error: unknown) {
  if (!error) {
    return '';
  }

  return error instanceof ApiClientError
    ? error.message
    : 'Unable to load workspace data.';
}

export function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return 'None';
  }

  return JSON.stringify(metadata);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
