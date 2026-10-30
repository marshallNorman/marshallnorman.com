#!/usr/bin/env node
// Uploads the local Design Studio mirror to the private Blob store that
// backs /showcase/prototypes. Safe to re-run after refreshing the mirror.
//
// Usage (credentials from `vercel env pull .env.local`):
//   bun --env-file=.env.local scripts/upload-showcase-prototypes.mjs ~/agentic-studio-demo/design-studio [--only <path substring>]

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';

const root = process.argv[2];
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;
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

// The prototype header's back button returns to /showcase instead of the
// Design Studio home
const PATCHES = [
  ['{to:"/",label:"Prototypes"}', '{to:"/",label:"Showcase"}'],
  ['X.$router.push(u.value.to)', 'window.location.assign("/showcase")'],
];

// Showcase-only scripts (scripts/showcase-overrides/), uploaded next to the
// mirror and loaded from its index.html
const OVERRIDES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'showcase-overrides');
const OVERRIDES_PREFIX = 'showcase-overrides';
const HTML_PATCHES = [
  // Use marshallnorman.com's favicon (same links as src/layouts/Layout.astro)
  [
    `<link rel="icon" href="${TO_BASE}favicon.png">`,
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=4">\n    <link rel="icon" href="/favicon.ico">',
  ],
  ['</body>', `  <script type="module" src="${TO_BASE}${OVERRIDES_PREFIX}/playbook-controls.js"></script>\n  </body>`],
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat();
}

// [local file, blob pathname]
const files = [
  ...(await walk(root)).map((f) => [f, relative(root, f)]),
  ...(await walk(OVERRIDES_DIR)).map((f) => [f, `${OVERRIDES_PREFIX}/${relative(OVERRIDES_DIR, f)}`]),
].filter(([f, path]) => !f.endsWith('.DS_Store') && (!only || path.includes(only)));
let done = 0;

async function upload([file, path]) {
  const ext = extname(file).toLowerCase();
  let body = await readFile(file);
  if (TEXT.has(ext)) {
    body = body.toString('utf8').replaceAll(FROM_BASE, TO_BASE);
    for (const [from, to] of PATCHES) body = body.replaceAll(from, to);
    if (path === 'index.html') for (const [from, to] of HTML_PATCHES) body = body.replace(from, to);
  }
  // Blob rejects empty bodies; the mirror has an empty stylesheet
  if (body.length === 0) body = '\n';

  await put(`prototypes/${path}`, body, {
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
