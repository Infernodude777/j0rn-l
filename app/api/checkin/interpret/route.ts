import { NextResponse } from 'next/server';
import { interpretCheckinResponses } from '@/lib/ai/blackbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { name?: string; responses?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const responses = body?.responses ?? {};
  if (typeof responses !== 'object' || Array.isArray(responses)) {
    return NextResponse.json({ error: '`responses` must be an object' }, { status: 400 });
  }
  // Drop any non-string / empty values so the LLM sees only real answers.
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(responses)) {
    if (typeof v === 'string' && v.trim().length > 0) cleaned[k] = v.trim();
  }
  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: 'At least one non-empty response is required' }, { status: 400 });
  }

  try {
    const result = await interpretCheckinResponses({
      name: typeof body.name === 'string' ? body.name : '',
      responses: cleaned,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Interpretation failed' },
      { status: 500 },
    );
  }
}
