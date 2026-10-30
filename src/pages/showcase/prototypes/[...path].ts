import type { APIRoute } from 'astro';
import { get } from '@vercel/blob';
import { isAuthed, serverEnv } from '../../../lib/showcase-auth';

export const prerender = false;

// Serves the Design Studio mirror from the private Blob store, behind the
// showcase password. Files are uploaded by scripts/upload-showcase-prototypes.mjs.
export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  if (!isAuthed(cookies)) return redirect('/showcase', 302);

  const path = params.path || 'index.html';
  if (path.includes('..') || path.startsWith('/')) {
    return new Response('Not found', { status: 404 });
  }

  // On Vercel the SDK authenticates with the function's OIDC token; locally
  // these come from .env.local (`vercel env pull`).
  const result = await get(`prototypes/${path}`, {
    access: 'private',
    storeId: serverEnv('BLOB_STORE_ID'),
    oidcToken: process.env.VERCEL_OIDC_TOKEN ? undefined : serverEnv('VERCEL_OIDC_TOKEN'),
    // index.html and showcase overrides are small and change on re-upload;
    // skip Blob's CDN cache so updates show up immediately
    useCache: path.startsWith('assets/'),
  }).catch(() => null);

  if (!result || result.statusCode !== 200) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      // Asset filenames are hashed, but the upload script patches some of
      // them in place, so cache for a day rather than forever
      'Cache-Control': path.startsWith('assets/') ? 'private, max-age=86400' : 'private, no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
