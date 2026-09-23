import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { CITY_COOKIE } from '@/lib/city';
import { getCities } from '@/lib/erp';

export const dynamic = 'force-dynamic';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

interface CityPayload {
  city?: unknown;
}

/**
 * Guarda la ciudad elegida en la cookie `storefront_city`.
 *
 * El valor se valida contra el canal: una ciudad que el ERP no tenga habilitada
 * se rechaza con 400. El navegador nunca habla con el ERP (D10): este handler es
 * el unico puente.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const raw =
    typeof payload === 'object' && payload !== null
      ? (payload as CityPayload).city
      : undefined;

  if (typeof raw !== 'string' || raw.trim() === '') {
    return NextResponse.json({ error: 'Falta el codigo de ciudad.' }, { status: 400 });
  }

  const code = raw.trim().toUpperCase();
  const cities = await getCities();
  const match = cities.find((city) => city.code === code);
  if (match === undefined) {
    return NextResponse.json(
      { error: `La ciudad ${code} no esta habilitada en el canal del ERP.` },
      { status: 400 },
    );
  }

  cookies().set({
    name: CITY_COOKIE,
    value: match.code,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  });

  return NextResponse.json({ ok: true, city: match.code, name: match.name });
}
