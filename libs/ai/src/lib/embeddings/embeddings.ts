export interface EmbeddingOptions {
  dimensions?: number;
}

export function embedText(text: string, options: EmbeddingOptions = {}): number[] {
  const dimensions = options.dimensions ?? 64;
  const embedding = new Array<number>(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  for (const token of normalized.split(/\s+/).filter(Boolean)) {
    const hash = hashToken(token);
    embedding[hash % dimensions] += 1;
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0)) || 1;
  return embedding.map((value) => Number((value / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return Number((dotProduct / Math.sqrt(leftMagnitude * rightMagnitude)).toFixed(6));
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }

  return hash;
}
