import { NextResponse } from 'next/server';
import { checkLicense } from '@/lib/license';

export async function GET() {
  const result = checkLicense();
  return NextResponse.json(result);
}
