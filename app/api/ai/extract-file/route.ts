import { NextRequest, NextResponse } from 'next/server';

const MAX_CHARS = 30000;
const SUPPORTED_EXTS = new Set(['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.txt', '.md']);

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = ('.' + (file.name.split('.').pop() ?? '')).toLowerCase();

  if (!SUPPORTED_EXTS.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 415 });
  }

  if (ext === '.txt' || ext === '.md') {
    const text = await file.text();
    return NextResponse.json({ text: text.slice(0, MAX_CHARS) });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = '';

    if (ext === '.pdf') {
      // pdf-parse v1 — loaded externally by Node.js (not bundled by Turbopack)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      text = result.text;
    } else {
      // officeparser for PPTX / DOCX — also loaded externally
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseOffice } = require('officeparser') as { parseOffice: (buf: Buffer) => Promise<string> };
      text = await parseOffice(buffer);
    }

    return NextResponse.json({ text: text.trim().slice(0, MAX_CHARS) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    console.error('extract-file error:', msg);
    return NextResponse.json({ error: `Could not extract text from "${file.name}". ${msg}` }, { status: 422 });
  }
}
