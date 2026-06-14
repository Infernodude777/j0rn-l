import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NIM_API_URL = process.env.NVIDIA_NIM_API_URL ?? 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY ?? '';
const NIM_STT_MODEL = process.env.NVIDIA_NIM_STT_MODEL ?? 'nvidia/whisper-large-v3';

export async function POST(req: Request) {
  if (!NIM_API_KEY.trim()) {
    return NextResponse.json({ error: 'NVIDIA_NIM_API_KEY is not configured' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const audio = formData.get('audio');
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append('model', NIM_STT_MODEL);
  upstream.append('file', audio, audio.name || 'audio.webm');

  const response = await fetch(`${NIM_API_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NIM_API_KEY}`,
    },
    body: upstream,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error?.message ?? payload?.error ?? `Transcription failed (${response.status})` },
      { status: response.status },
    );
  }

  return NextResponse.json({
    text: String(payload?.text ?? '').trim(),
  });
}