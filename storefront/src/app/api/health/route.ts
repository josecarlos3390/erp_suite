import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Sonda de vida que usa el arnes E2E para saber que `next start` ya responde. */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, service: 'erp-storefront' });
}
