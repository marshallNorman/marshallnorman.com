interface Env {
  NOW_PLAYING: KVNamespace;
  BRIDGE_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/update') {
      const auth = request.headers.get('Authorization') ?? '';
      if (auth !== `Bearer ${env.BRIDGE_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      const body = await request.json<any>();
      if (body.isPlaying === false) {
        await env.NOW_PLAYING.delete('current');
        return Response.json({ ok: true });
      }
      const { track, artist, album, albumArt, albumUrl } = body;
      await env.NOW_PLAYING.put(
        'current',
        JSON.stringify({ track, artist, album, albumArt, albumUrl }),
        { expirationTtl: 300 }
      );
      return Response.json({ ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/now-playing') {
      const raw = await env.NOW_PLAYING.get('current');
      const cors = { 'Access-Control-Allow-Origin': '*' };
      if (!raw) return Response.json({ isPlaying: false }, { headers: cors });
      const data = JSON.parse(raw);
      return Response.json({ isPlaying: true, ...data }, { headers: cors });
    }

    return new Response('Not found', { status: 404 });
  },
};
