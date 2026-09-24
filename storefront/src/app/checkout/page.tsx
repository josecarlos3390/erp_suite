import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { CheckoutForm } from '@/components/checkout-form';
import { getCityContext } from '@/lib/city';

export const metadata: Metadata = {
  title: 'Checkout',
  description:
    'Confirma tu pedido como invitado: datos de entrega, metodo de pago offline y resumen con el total que cotiza el ERP.',
  alternates: { canonical: '/checkout' },
  // El checkout no se indexa: es un flujo privado del comprador.
  robots: { index: false, follow: false },
};

/**
 * Checkout de invitado (F3).
 *
 * El servidor resuelve **la ciudad** (cookie `storefront_city`, con el respaldo de
 * `STOREFRONT_CITY`) y se la pasa al formulario; todo lo demas —carrito, cotizacion
 * y alta del pedido— ocurre en el componente cliente contra `/api/pedido`, que es
 * el unico que conoce la clave del canal (D10). La pagina es dinamica porque lee
 * la cookie.
 */
export const dynamic = 'force-dynamic';

export default async function CheckoutPage(): Promise<JSX.Element> {
  const { city } = await getCityContext();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Carrito', href: '/carrito' },
          { label: 'Checkout' },
        ]}
      />
      <header className="flex flex-col gap-1">
        <p className="sf-eyebrow">Tu compra</p>
        <h1 className="sf-h1 text-fg">Checkout</h1>
        <p className="text-sm text-fg-secondary">
          Compra como invitado. Los importes definitivos los calcula el ERP: el carrito solo guarda
          precios de referencia.
        </p>
      </header>
      <CheckoutForm
        cityCode={city.code}
        cityName={city.name}
        cityDeliveryDays={city.deliveryDays}
      />
    </div>
  );
}
