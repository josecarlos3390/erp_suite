import { BagIcon, CheckIcon } from './ui/icons';

interface PurchaseStep {
  /** Numero visible del paso y del `data-testid` (`checkout-step-N`). */
  number: number;
  label: string;
}

/**
 * Pasos del checkout. El **carrito** es el paso previo (indice 0) y no lleva
 * numero visible ni `data-testid`: los tres pasos numerados son los del checkout,
 * de modo que el numero que ve el comprador y el del contrato con el E2E
 * (`checkout-step-1..3`) son el mismo.
 */
const CHECKOUT_STEPS: readonly PurchaseStep[] = [
  { number: 1, label: 'Datos del comprador' },
  { number: 2, label: 'Entrega y pago' },
  { number: 3, label: 'Resumen y confirmacion' },
];

interface CheckoutProgressProps {
  /** Paso activo: 0 = carrito (`/carrito`), 1..3 = pasos del checkout. */
  current: 0 | 1 | 2 | 3;
  /**
   * Prefijo de los `data-testid`. El checkout usa `checkout` (contrato del E2E);
   * el carrito usa `cart` para no duplicar los mismos testids en dos paginas.
   */
  testIdPrefix?: string;
}

/**
 * Barra de progreso de la compra (F9.5).
 *
 * Sustituye a la fila de pildoras: los pasos van en una linea con su nodo
 * numerado, la marca de completado y la barra que los une, asi que el comprador
 * ve **donde esta** y **cuanto le queda**. En pantalla estrecha los cuatro nodos
 * se quedan solos (con el nombre del paso actual encima) porque el nombre completo
 * no cabe junto al circulo. Es un componente de servidor (sin estado): el paso
 * activo lo decide la pagina —la misma barra se pinta en el carrito con
 * `current={0}`—.
 *
 * `data-state` (`done` / `current` / `pending`) y `aria-current="step"` son
 * contrato con el E2E de la tienda.
 */
export function CheckoutProgress({
  current,
  testIdPrefix = 'checkout',
}: CheckoutProgressProps): JSX.Element {
  const nodes: readonly PurchaseStep[] = [{ number: 0, label: 'Carrito' }, ...CHECKOUT_STEPS];
  const currentLabel = nodes[current]?.label ?? '';

  return (
    <nav
      aria-label="Pasos de la compra"
      data-testid={`${testIdPrefix}-progress`}
      className="sf-card flex flex-col gap-2 p-3"
    >
      {/* En pantalla estrecha el nombre del paso va en su propia linea: los nodos
          solos no dicen nada y el nombre completo no cabe junto al circulo. */}
      <p className="text-xs font-semibold text-fg sm:hidden">{currentLabel}</p>
      <ol className="flex items-center gap-3">
        {nodes.map((node, index) => {
          const state: 'done' | 'current' | 'pending' =
            index < current ? 'done' : index === current ? 'current' : 'pending';
          const isLast = index === nodes.length - 1;
          return (
            <li key={node.label} className="flex min-w-0 flex-1 items-center gap-3">
              <span
                // El nodo del carrito no lleva testid: los del E2E son los tres del checkout.
                data-testid={index === 0 ? undefined : `${testIdPrefix}-step-${node.number}`}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === 'current'
                      ? 'bg-primary text-primary-fg shadow-cta'
                      : state === 'done'
                        ? 'bg-primary-soft text-fg-accent ring-1 ring-line-accent'
                        : 'bg-surface text-fg-tertiary ring-1 ring-line'
                  }`}
                >
                  {state === 'done' ? (
                    <CheckIcon size={13} />
                  ) : node.number === 0 ? (
                    <BagIcon size={13} />
                  ) : (
                    node.number
                  )}
                </span>
                <span
                  className={`hidden truncate text-xs font-semibold sm:inline ${
                    state === 'current' ? 'text-fg' : 'text-fg-secondary'
                  }`}
                >
                  {node.label}
                </span>
                <span className="sr-only">
                  {node.label}:{' '}
                  {state === 'done'
                    ? 'completado'
                    : state === 'current'
                      ? 'paso actual'
                      : 'pendiente'}
                </span>
              </span>
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className={`h-0.5 min-w-3 flex-1 rounded-full ${state === 'done' ? 'bg-primary' : 'bg-line'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
