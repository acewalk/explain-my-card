import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

function jsonError(message: string, status = 500, extra?: Record<string, any>) {
  return NextResponse.json(
    {
      error: message,
      ...(extra ? { extra } : {}),
    },
    { status }
  );
}

function safeString(x: any): string {
  if (typeof x === 'string') return x;
  if (x == null) return '';
  return String(x);
}

function compactArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => safeString(x)).map((s) => s.trim()).filter(Boolean);
}

function buildExplainPrompt(card: any) {
  const name = safeString(card?.name);
  const mana_cost = safeString(card?.mana_cost);
  const type_line = safeString(card?.type_line);
  const oracle_text = safeString(card?.oracle_text);
  const keywords = compactArray(card?.keywords);
  const colors = compactArray(card?.colors);
  const color_identity = compactArray(card?.color_identity);
  const produced_mana = compactArray(card?.produced_mana);
  const cmc = card?.cmc ?? null;
  const rarity = safeString(card?.rarity);
  const set_name = safeString(card?.set_name);
  const tags = compactArray(card?.tags);

  return `
You are "Explain My Card", an autism-friendly Magic: The Gathering explainer.
Write in clear, literal language. Avoid sarcasm. Avoid slang. No fluff.
Assume the user is a beginner and often plays Commander.

CARD DATA (from Scryfall):
Name: ${name || '(unknown)'}
Mana cost: ${mana_cost || '(unknown)'}
Type line: ${type_line || '(unknown)'}
CMC: ${cmc ?? '(unknown)'}
Colors: ${colors.join(', ') || '(unknown)'}
Color identity: ${color_identity.join(', ') || '(unknown)'}
Keywords: ${keywords.join(', ') || '(none)'}
Produced mana: ${produced_mana.join(', ') || '(none)'}
Rarity: ${rarity || '(unknown)'}
Set name: ${set_name || '(unknown)'}
Context tags: ${tags.join(', ') || '(none)'}
Oracle text:
${oracle_text || '(no oracle text found)'}

TASK:
Return an explanation with these EXACT section headers (in this order):

1) What this card does
- 2–5 bullet points, plain English, no jargon unless explained.

2) Why people play it (Commander)
- 2–5 bullet points focused on common reasons.

3) Common play patterns
- 2–5 bullet points. Examples like “Cast this, then do X” are good.

4) Rules notes / gotchas
- 2–6 bullet points. Mention timing, “targets”, replacement effects, state-based actions, etc. ONLY if relevant.

5) Quick tips
- 2–6 bullet points that help a beginner use it correctly.

Formatting rules:
- Use bullet points (•).
- Keep each bullet short (1–2 sentences).
- Do not include card prices.
- Do not invent exact combo pieces if you are unsure. When uncertain, speak generally (e.g., “pairs well with sacrifice outlets”).
`.trim();
}

function buildSynergyPrompt(card: any) {
  const name = safeString(card?.name);
  const mana_cost = safeString(card?.mana_cost);
  const type_line = safeString(card?.type_line);
  const oracle_text = safeString(card?.oracle_text);
  const tags = compactArray(card?.tags);
  const colors = compactArray(card?.colors);
  const color_identity = compactArray(card?.color_identity);

  return `
You are "Explain My Card", an autism-friendly Magic: The Gathering helper.
Write in clear, literal language. Avoid sarcasm. Avoid slang. No fluff.
Assume the user is a beginner and often plays Commander.

CARD DATA:
Name: ${name || '(unknown)'}
Mana cost: ${mana_cost || '(unknown)'}
Type line: ${type_line || '(unknown)'}
Colors: ${colors.join(', ') || '(unknown)'}
Color identity: ${color_identity.join(', ') || '(unknown)'}
Context tags: ${tags.join(', ') || '(none)'}
Oracle text:
${oracle_text || '(no oracle text found)'}

TASK:
Return "Synergies & Combos" ideas in this structure:

A) Best deck themes for this card
- 3–6 bullet points.

B) What this card pairs well with
- 6–12 bullet points.
- Prefer TYPES of cards (e.g., “cheap instants”, “mana rocks”, “flicker effects”, “sacrifice outlets”).
- You MAY include 0–4 specific famous staples only if you are confident they fit.

C) If you want to go infinite (optional)
- Either:
  - “No clear infinite combos are typical for this card”
  - OR 2–4 bullet points describing common infinite-style patterns in general terms.
- Do NOT hallucinate obscure named combos.

D) Anti-synergies / what to avoid
- 3–6 bullet points.

Formatting rules:
- Use bullet points (•).
- Keep each bullet short.
- Do not include card prices.
`.trim();
}

/**
 * GET is just for debugging / sanity checks in the browser.
 * Browsers hit URLs with GET by default, so this prevents confusing 405 errors.
 */
export async function GET() {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      route: '/api/explain',
      methods: ['POST'],
      message:
        'This endpoint expects POST JSON. If you see this, the route exists. Use POST from the app UI or PowerShell curl.',
      env: {
        OPENAI_API_KEY_set: hasKey,
        OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
      exampleBody: {
        mode: 'explain',
        card: {
          name: 'Sol Ring',
          mana_cost: '{1}',
          type_line: 'Artifact',
          oracle_text: '{T}: Add {C}{C}.',
          tags: ['artifact', 'ramp'],
        },
      },
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return jsonError(
        'OPENAI_API_KEY is not set. Add it in Vercel Project Settings → Environment Variables, and locally in .env.local.',
        500
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return jsonError('Invalid JSON body sent to /api/explain.', 400);
    }

    const modeRaw = safeString(body?.mode).toLowerCase();
    const mode: 'explain' | 'synergies' = modeRaw === 'synergies' ? 'synergies' : 'explain';

    let card = body?.card;

    if (!card) {
      card = {
        name: body?.cardName ?? body?.name ?? '',
        mana_cost: body?.manaCost ?? body?.mana_cost ?? '',
        type_line: body?.typeLine ?? body?.type_line ?? '',
        oracle_text: body?.oracleText ?? body?.oracle_text ?? body?.text ?? '',
        keywords: body?.keywords ?? [],
        colors: body?.colors ?? [],
        color_identity: body?.color_identity ?? [],
        produced_mana: body?.produced_mana ?? [],
        cmc: body?.cmc ?? null,
        rarity: body?.rarity ?? null,
        set_name: body?.set_name ?? null,
        tags: body?.tags ?? [],
      };
    }

    const cardName = safeString(card?.name).trim();
    if (!cardName) {
      return jsonError(
        'Missing card name. Your request must include card.name (new format) or cardName (old format).',
        400,
        { receivedKeys: Object.keys(body || {}) }
      );
    }

    const prompt = mode === 'synergies' ? buildSynergyPrompt(card) : buildExplainPrompt(card);

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You are a careful, accurate Magic: The Gathering rules explainer. If something is uncertain, say you are unsure rather than guessing.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!text) {
      return jsonError('OpenAI returned an empty response.', 500);
    }

    if (mode === 'synergies') {
      return NextResponse.json({ synergies: text });
    }
    return NextResponse.json({ explanation: text });
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'Unknown server error in /api/explain.';
    return jsonError(msg, 500);
  }
}