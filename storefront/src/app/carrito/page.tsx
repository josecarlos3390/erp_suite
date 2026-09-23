import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { CartView } from '@/components/cart-view';

export const metadata: Metadata = {
  title: 'Carrito de compras',
  description:
    'Revisa los productos que agregaste. El precio final lo confirma el ERP al crear el pedido.',
  alternates: { canonical: '/carrito' },
  robots: { index: false, follow: true },
};

export default function CartPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Carrito' }]} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">Carrito de compras</h1>
        <p className="text-sm text-fg-secondary">
          Los importes que ves son una referencia de la tienda.
        </p>
      </header>
      <CartView />
    </div>
  );
}
