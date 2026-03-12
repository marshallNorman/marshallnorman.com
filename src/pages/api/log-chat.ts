export const prerender = false;

import { Resend } from 'resend';
import type { APIRoute } from 'astro';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const messages: { role: string; content: string }[] = await request.json();

    const userMessages = messages.filter(m => m.role === 'user');
    if (!Array.isArray(messages) || userMessages.length === 0) {
      return new Response(null, { status: 204 });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' });

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Visitor' : 'Marshall'}: ${m.content}`)
      .join('\n\n---\n\n');

    await resend.emails.send({
      from: 'Portfolio Chat <onboarding@resend.dev>',
      to: 'marshalldeannorman@gmail.com',
      subject: `Chat on marshallnorman.com — ${dateStr} (${userMessages.length} ${userMessages.length === 1 ? 'message' : 'messages'})`,
      text: `Visitor asked ${userMessages.length} ${userMessages.length === 1 ? 'question' : 'questions'} on ${dateStr} at ${timeStr}\n\n---\n\n${transcript}\n\n---`,
    });

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
};
