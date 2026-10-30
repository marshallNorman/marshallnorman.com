#!/usr/bin/env node
// Uploads the local Design Studio mirror to the private Blob store that
// backs /showcase/prototypes. Safe to re-run after refreshing the mirror.
//
// Usage (credentials from `vercel env pull .env.local`):
//   bun --env-file=.env.local scripts/upload-showcase-prototypes.mjs ~/agentic-studio-demo/design-studio

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { put } from '@vercel/blob';

const root = process.argv[2];
// The SDK reads BLOB_READ_WRITE_TOKEN, or VERCEL_OIDC_TOKEN + BLOB_STORE_ID, from the env
const hasCreds = process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
if (!root || !hasCreds) {
  console.error('Usage: bun --env-file=.env.local scripts/upload-showcase-prototypes.mjs <mirror dir>');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.wav': 'audio/wav',
};
const TEXT = new Set(['.html', '.js', '.mjs', '.css']);

// The mirror is built for /design-studio/; it's served from /showcase/prototypes/
const FROM_BASE = '/design-studio/';
const TO_BASE = '/showcase/prototypes/';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat();
}

const files = (await walk(root)).filter((f) => !f.endsWith('.DS_Store'));
let done = 0;

async function upload(file) {
  const ext = extname(file).toLowerCase();
  let body = await readFile(file);
  if (TEXT.has(ext)) body = body.toString('utf8').replaceAll(FROM_BASE, TO_BASE);
  // Blob rejects empty bodies; the mirror has an empty stylesheet
  if (body.length === 0) body = '\n';

  await put(`prototypes/${relative(root, file)}`, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: TYPES[ext] ?? 'application/octet-stream',
  });
  done++;
  if (done % 50 === 0 || done === files.length) console.log(`${done}/${files.length}`);
}

// Small worker pool
const queue = [...files];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) await upload(queue.shift());
  }),
);
console.log('Done.');
