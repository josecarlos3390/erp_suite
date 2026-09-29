import 'server-only';

import { cookies } from 'next/headers';

import { currentChannel } from './channels';
import { getCities, type City } from './erp';

/** Nombre de la cookie que guarda la ciudad elegida por el cliente. */
export const CITY_COOKIE = 'storefront_city';

/** Ciudad de respaldo cuando no hay cookie ni configuracion. */
export const FALLBACK_CITY = 'SCZ';

/**
 * Ciudad por defecto de **este** host: la declara el canal (`STOREFRONT_CHANNELS[host].city`) y,
 * si no, `STOREFRONT_CITY`. Con N dominios en un despliegue, una ciudad global seria la de otra
 * tienda.
 */
async function defaultCity(): Promise<string> {
  const channel = await currentChannel();
  return channel.city !== '' ? channel.city : FALLBACK_CITY;
}

/**
 * Ciudades habilitadas + la elegida, resueltas en el servidor.
 *
 * La cookie se valida contra el canal: una cookie manipulada o de una ciudad
 * deshabilitada cae al valor por defecto (`STOREFRONT_CITY`), nunca rompe la
 * pagina. Es la unica forma en que la ciudad entra a la tienda.
 */
export interface CityContext {
  city: City;
  cities: City[];
  selectedCode: string;
}

export async function getCityContext(): Promise<CityContext> {
  const cities = await getCities();
  const requested = cookies().get(CITY_COOKIE)?.value?.trim().toUpperCase();
  const fallback = await defaultCity();

  const selected =
    cities.find((item) => item.code === requested) ??
    cities.find((item) => item.code === fallback) ??
    cities[0];

  if (selected === undefined) {
    throw new Error(
      'El canal no devolvio ninguna ciudad habilitada: revisar la configuracion de la tienda en el ERP.',
    );
  }

  return { city: selected, cities, selectedCode: selected.code };
}

/** Solo el codigo de la ciudad elegida (atajo para el cliente del canal). */
export async function getSelectedCityCode(): Promise<string> {
  const context = await getCityContext();
  return context.selectedCode;
}
