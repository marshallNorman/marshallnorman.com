export const prerender = false;
import type { APIRoute } from 'astro';

export type NowPlayingResponse =
  | { isPlaying: false }
  | { isPlaying: true; track: string; artist: string; album: string; albumArt: string };

export const GET: APIRoute = async () => {
  const workerUrl = import.meta.env.NOW_PLAYING_WORKER_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=25, stale-while-revalidate=5',
  };

  if (!workerUrl) {
    return new Response(JSON.stringify({ isPlaying: false }), { headers });
  }

  try {
    const res = await fetch(`${workerUrl}/now-playing`);
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers });
  } catch {
    return new Response(JSON.stringify({ isPlaying: false }), { headers });
  }
};
