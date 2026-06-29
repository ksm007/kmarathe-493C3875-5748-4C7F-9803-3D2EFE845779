'use strict';

const { transformSync } = require('@swc/core');
const crypto = require('crypto');

// Strip import.meta.env.X → undefined and import.meta.env → {} so that
// Vite-specific environment references compile cleanly in Jest's CJS context.
function stripImportMetaEnv(src) {
  return src
    .replace(/import\.meta\.env\.[\w]+/g, 'undefined')
    .replace(/import\.meta\.env/g, '({})');
}

module.exports = {
  process(src, filename) {
    const isTSX = /\.[tj]sx$/.test(filename);
    const isTS = /\.[tj]sx?$/.test(filename);

    if (!isTS) {
      return { code: src };
    }

    const preprocessed = stripImportMetaEnv(src);

    const result = transformSync(preprocessed, {
      filename,
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: isTSX,
          decorators: true,
        },
        transform: isTSX
          ? { react: { runtime: 'automatic' } }
          : undefined,
        target: 'es2022',
      },
      module: { type: 'commonjs' },
      sourceMaps: 'inline',
    });

    return { code: result.code };
  },

  getCacheKey(src, filename, options) {
    return crypto
      .createHash('md5')
      .update(src)
      .update(filename)
      .update(JSON.stringify(options))
      .digest('hex');
  },
};
