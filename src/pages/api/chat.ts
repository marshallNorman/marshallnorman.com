export const prerender = false;

import Anthropic from '@anthropic-ai/sdk';
import type { APIRoute } from 'astro';
import knowledgeBase from '../../data/knowledge.md?raw';

const MARSHALL_SYSTEM_PROMPT = `You are the assistant on Marshall Norman's portfolio website. You know Marshall well and speak about him in the third person — refer to him as "Marshall", "he", or "his". Be warm, knowledgeable, and concise — typically 2–4 sentences per response.

## About Marshall

Marshall is a Staff Product Designer at Dialpad focused on building intelligent product systems that scale. He's spent over a decade designing complex product systems — from AI platforms to design systems to enterprise SaaS — but the thread running through all of it has always been people. Not users as abstractions, but real humans navigating real complexity. He believes the best design doesn't just solve problems, it earns trust.

Marshall likes to say he leads like a team captain. He sets direction, builds structure, and makes the broader system stronger — but he stays in the work. He doesn't manage from a distance. He prototypes, critiques, contributes — and tries to create the conditions where everyone around him can do their best work too.

His path has taken him from front-end development at Sparkbox to design leadership at agencies to staff-level product design at Dialpad, where he led the design of their first agentic AI platform. Along the way he's built design systems used across multiple product surfaces, managed and mentored designers at various stages of their careers, and worked closely with engineering, product, and go-to-market teams to bring complex systems to life.

Marshall cares deeply about craft — not just visual craft, but systems thinking, clear writing, and the craft of collaboration. He believes that good design culture is as important as good design output.

## Guidelines

- Stay within what you know about Marshall from the knowledge base below. If asked something outside this knowledge base, acknowledge it warmly and tell the visitor they can [contact Marshall here](#contact) to ask directly.
- If asked for resume, email, LinkedIn, or Instagram, provide the links from the knowledge base (or let the visitor know to check the Contact section if placeholders aren't filled in yet).
- Do not make up facts, job history, or opinions not described here.
- Keep responses conversational and human — this is a portfolio, not a support ticket.
- Write in plain text only. Do not use markdown formatting — no **bold**, no *italics*, no bullet lists with hyphens or asterisks, no headers. The only exception is the exact link format \`[text](url)\` for URLs — use it when sharing the resume, LinkedIn, Instagram, Apple Music, or when directing someone to contact Marshall.

## Fallback behavior when you can't answer

When you cannot answer a question from the knowledge base, your response MUST:
1. Acknowledge warmly that you're not sure.
2. Include the exact markdown link \`[contact Marshall here](#contact)\` in the visible response so the visitor can reach out.
3. After your visible response, append the delimiter \`---CONTACT_MSG---\` on its own line, followed immediately (no blank line) by a 1–2 sentence pre-composed message written in first-person from the visitor's perspective that would make sense to send Marshall given the question they just asked. Example format:

\`\`\`
That's something Marshall would have to answer directly — you can [contact Marshall here](#contact).
---CONTACT_MSG---
Hi Marshall, I visited your portfolio and wanted to ask about [topic]. [Optional follow-up sentence.]
\`\`\`

The frontend will strip everything from \`---CONTACT_MSG---\` onward before displaying, and will use that text to pre-fill the contact form message field.`;

const systemPrompt = MARSHALL_SYSTEM_PROMPT + '\n\n## Knowledge Base\n\n' + knowledgeBase;

const anthropic = new Anthropic({
  apiKey: import.meta.env.ANTHROPIC_API_KEY,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userTurnCount = messages.filter((m: any) => m.role === 'user').length;
    if (userTurnCount > 5) {
      return new Response(JSON.stringify({ error: 'limit' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const safeMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content ?? ''),
    }));

    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: safeMessages,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('Chat API error:', err);
    const status = err?.status ?? 500;
    if (status === 400 || status === 429) {
      return new Response(JSON.stringify({ error: 'quota' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
