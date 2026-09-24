'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CheckoutProgress } from '@/components/checkout-progress';
import { ProductImage } from '@/components/product-image';
import { TotalsBreakdown } from '@/components/totals-breakdown';
import { EmptyState } from '@/components/ui/empty-state';
import { BagIcon } from '@/components/ui/icons';
import { Skeleton, SkeletonCheckout } from '@/components/ui/skeleton';
import {
  CHECKOUT_LIMITS,
  CHECKOUT_PAYMENT_METHODS,
  TAX_NOTICE,
  TRACKING_NOTICE,
  buyerErrorsAreClear,
  deliveryTypeLabel,
  paymentMethodInfo,
  validateBuyer,
  type BuyerFieldErrors,
  type CheckoutCustomerInput,
  type CheckoutDeliveryType,
  type CheckoutPaymentMethod,
} from '@/lib/checkout';
import { CheckoutRequestError, requestOrder, requestQuote } from '@/lib/checkout-client';
import { formatMoney } from '@/lib/format';
import type { QuoteView } from '@/lib/order-view';
import { MAX_LINE_QUANTITY, cartItemCount, cartSubtotal, useCartStore } from '@/store/cart';

/**
 * Checkout de invitado, en tres pasos.
 *
 * Reglas que este componente respeta:
 *  - **Nada de precios propios**: la cotizacion y el pedido los calcula el ERP. Lo
 *    que se muestra en el paso 3 sale de `POST /storefront/quote` (via
 *    `/api/pedido`), y el subtotal del carrito solo aparece etiquetado como
 *    *referencia de la tienda* para que se vea si el canal cambio el precio.
 *  - **Una sola `idempotencyKey` por intento de compra**, generada al montar y
 *    conservada aunque el envio falle: reintentar no puede duplicar el pedido.
 *  - **Errores accionables**: el mensaje del ERP se muestra tal cual (sin
 *    existencia, articulo despublicado, ciudad sin envio) y el boton queda
 *    deshabilitado mientras se envia, nunca en un estado ambiguo.
 */

interface BuyerForm {
  email: string;
  name: string;
  phone: string;
  taxId: string;
  street: string;
  district: string;
  reference: string;
}

/**
 * Tasa del impuesto de la cotizacion cuando **todas** las lineas con impuesto comparten
 * la misma (es la unica que se puede rotular sin mentir con tasas mixtas: `null`).
 */
function quoteTaxRate(items: QuoteView['items']): number | null {
  const rates = items.filter((line) => line.taxRate > 0).map((line) => line.taxRate);
  if (rates.length === 0) return null;
  const [first] = rates;
  return rates.every((rate) => rate === first) ? (first ?? null) : null;
}

const EMPTY_BUYER: BuyerForm = {
  email: '',
  name: '',
  phone: '',
  taxId: '',
  street: '',
  district: '',
  reference: '',
};

/** Clave de idempotencia del intento de compra (una por checkout). */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Respaldo para navegadores sin `randomUUID` (la clave solo debe ser unica).
  return `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

type QuoteState =
  | { status: 'loading' }
  | { status: 'ready'; quote: QuoteView }
  | { status: 'error'; message: string };

/**
 * Valor con rebote: devuelve el ultimo valor recibido cuando deja de cambiar durante
 * `delayMs`. Se usa para no pedir una cotizacion por cada tecla del correo.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * Cotiza una vez por combinacion (ciudad + lineas + correo) y expone un `reload` para
 * el reintento manual. `lines` se lee por referencia para no volver a disparar la
 * peticion cuando el array cambia de identidad sin cambiar de contenido.
 */
function useQuote(
  cityCode: string,
  enabled: boolean,
  customerEmail: string,
): {
  state: QuoteState;
  reload: () => void;
} {
  const lines = useCartStore((store) => store.lines);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Firma estable: ciudad + articulos + cantidades (el orden no importa) + correo.
  const signature = useMemo(() => {
    const items = lines
      .map((line) => `${line.itemId}x${line.quantity}`)
      .sort()
      .join(',');
    return `${cityCode}|${items}|${customerEmail}`;
  }, [cityCode, lines, customerEmail]);

  const [state, setState] = useState<QuoteState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled || signature === '') return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const quote = await requestQuote(
          cityCode,
          linesRef.current.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
          customerEmail,
        );
        if (requestRef.current === requestId) setState({ status: 'ready', quote });
      } catch (error) {
        if (requestRef.current !== requestId) return;
        const message =
          error instanceof CheckoutRequestError
            ? error.message
            : 'No se pudo cotizar el carrito con el ERP.';
        setState({ status: 'error', message });
      }
    })();
  }, [enabled, signature, cityCode, customerEmail, attempt]);

  const reload = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { state, reload };
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  testId?: string;
  hint?: string;
}

/** Campo de texto con etiqueta, ayuda y error asociados por `id`. */
function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  type = 'text',
  autoComplete,
  placeholder,
  maxLength,
  testId,
  hint,
}: FieldProps): JSX.Element {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-secondary">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
        className={`sf-field ${error !== undefined ? 'border-line-error' : ''}`}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint !== undefined && error === undefined ? (
        <p id={hintId} className="text-xs text-fg-tertiary">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-xs text-fg-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface CheckoutFormProps {
  cityCode: string;
  cityName: string;
  cityDeliveryDays: number;
}

export function CheckoutForm({
  cityCode,
  cityName,
  cityDeliveryDays,
}: CheckoutFormProps): JSX.Element {
  const router = useRouter();
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [buyer, setBuyer] = useState<BuyerForm>(EMPTY_BUYER);
  const [buyerErrors, setBuyerErrors] = useState<BuyerFieldErrors>({});
  const [deliveryType, setDeliveryType] = useState<CheckoutDeliveryType>('HOME');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('TRANSFER');
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  // Clave del intento de compra: se genera una vez y **no** cambia al reintentar.
  const [idempotencyKey] = useState<string>(newIdempotencyKey);

  // Rehidratacion del carrito: hasta que no termina, `lines` esta vacio.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useCartStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  // Al cambiar de paso el foco viaja al panel del paso nuevo, asi que el lector de
  // pantalla anuncia el cambio en vez de dejar al comprador al final del documento
  // (el panel no es alcanzable con Tab: el anillo se apaga a proposito y la barra de
  // pasos ya marca donde esta). El desplazamiento se hace a mano —`preventScroll`
  // mas `scrollIntoView` sobre la barra— para que el paso quede **debajo** del
  // encabezado pegajoso (`scroll-mt-32`: medido, el encabezado mide 124 px y la
  // barra 54 px, asi que el paso arranca visible y no escondido detras).
  const stepTop = useRef<HTMLDivElement | null>(null);
  const stepPanel = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepPanel.current?.focus({ preventScroll: true });
    // `behavior: instant` a proposito: el documento declara `scroll-behavior: smooth`
    // y aqui el salto tiene que ser inmediato —el paso ya cambio—, no una animacion.
    stepTop.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [step]);

  // La cotizacion sigue al correo (con rebote corto): un cliente registrado tiene su
  // propio tercero, su lista de precios y sus acuerdos, asi que el precio que ve en la
  // revision tiene que ser el suyo. Sin correo, la cotizacion es de invitado.
  const quoteEmail = useDebouncedValue(buyer.email.trim(), 400);
  const { state: quoteState, reload: reloadQuote } = useQuote(
    cityCode,
    hydrated && step >= 3,
    quoteEmail,
  );

  const itemCount = cartItemCount(lines);
  const currency = lines[0]?.currency ?? 'BOB';
  const referenceSubtotal = cartSubtotal(lines);
  const linesByItemId = useMemo(
    () => new Map(lines.map((line) => [line.itemId, line])),
    [lines],
  );

  function setField(field: keyof BuyerForm, value: string): void {
    setBuyer((current) => ({ ...current, [field]: value }));
    setBuyerErrors((current) => ({ ...current, [field]: undefined }));
    setOrderError(null);
  }

  function goToStep2(): void {
    const errors = validateBuyer(buyer);
    setBuyerErrors(errors);
    if (buyerErrorsAreClear(errors)) {
      setStep(2);
      setOrderError(null);
    }
  }

  function goToStep3(): void {
    setStep(3);
    reloadQuote();
  }

  async function confirmOrder(): Promise<void> {
    if (sending) return;
    setSending(true);
    setOrderError(null);

    const customer: CheckoutCustomerInput = {
      email: buyer.email.trim(),
      name: buyer.name.trim(),
      phone: buyer.phone.trim(),
      street: buyer.street.trim(),
      district: buyer.district.trim(),
    };
    if (buyer.taxId.trim() !== '') customer.taxId = buyer.taxId.trim();
    if (buyer.reference.trim() !== '') customer.reference = buyer.reference.trim();

    try {
      const order = await requestOrder({
        idempotencyKey,
        cityCode,
        deliveryType,
        paymentMethod,
        items: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
        customer,
      });
      // El pedido ya existe en el ERP: se vacia el carrito y se va a la
      // confirmacion, que vuelve a leer el pedido del canal.
      clear();
      router.push(`/pedido/${encodeURIComponent(order.orderNumber)}`);
    } catch (error) {
      const message =
        error instanceof CheckoutRequestError
          ? error.message
          : 'No se pudo crear el pedido en el ERP.';
      setOrderError(message);
      // El error puede venir de existencias o precios que cambiaron: se recotiza
      // para que el resumen vuelva a mostrar el estado real del canal.
      reloadQuote();
      setSending(false);
    }
  }

  if (!hydrated) {
    return (
      <div data-testid="checkout-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando tu carrito</span>
        <SkeletonCheckout />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        testId="checkout-empty"
        title="No hay nada que confirmar"
        description="Tu carrito esta vacio, asi que no hay pedido que crear. Agrega productos del catalogo y vuelve al checkout."
        icon={<BagIcon />}
        actions={[
          { href: '/categorias', label: 'Ver categorias', primary: true },
          { href: '/buscar', label: 'Buscar productos' },
        ]}
      />
    );
  }

  const paymentInfo = paymentMethodInfo(paymentMethod);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start" data-testid="checkout-form">
      <div className="flex flex-1 flex-col gap-4">
        <div className="scroll-mt-32" ref={stepTop}>
          <CheckoutProgress current={step} />
        </div>

        {step === 1 ? (
          <section
            ref={stepPanel}
            tabIndex={-1}
            aria-labelledby="paso-datos"
            className="sf-card flex flex-col p-4 focus:outline-none sm:p-5"
          >
            <h2 id="paso-datos" className="sf-h3 text-fg">
              Datos del comprador y direccion
            </h2>
            <p className="mt-1 text-xs text-fg-secondary">
              Compra como invitado: no hace falta crear una cuenta. Usamos estos datos para
              entregarte y avisarte por correo o WhatsApp.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField
                id="checkout-email"
                label="Correo electronico"
                type="email"
                required
                value={buyer.email}
                onChange={(value) => setField('email', value)}
                error={buyerErrors.email}
                autoComplete="email"
                maxLength={CHECKOUT_LIMITS.email}
                placeholder="nombre@dominio.com"
                testId="checkout-email"
                hint="Con este correo consultas el estado del pedido."
              />
              <TextField
                id="checkout-nombre"
                label="Nombre y apellido"
                required
                value={buyer.name}
                onChange={(value) => setField('name', value)}
                error={buyerErrors.name}
                autoComplete="name"
                maxLength={CHECKOUT_LIMITS.name}
                testId="checkout-name"
              />
              <TextField
                id="checkout-telefono"
                label="Telefono o celular"
                required
                value={buyer.phone}
                onChange={(value) => setField('phone', value)}
                error={buyerErrors.phone}
                autoComplete="tel"
                maxLength={CHECKOUT_LIMITS.phone}
                placeholder="700 00000"
                testId="checkout-phone"
              />
              <TextField
                id="checkout-nit"
                label="CI / NIT (opcional)"
                value={buyer.taxId}
                onChange={(value) => setField('taxId', value)}
                error={buyerErrors.taxId}
                maxLength={CHECKOUT_LIMITS.taxId}
                testId="checkout-tax-id"
                hint="Si lo dejas vacio, la factura sale a consumidor final."
              />
              <TextField
                id="checkout-calle"
                label="Calle y numero"
                required
                value={buyer.street}
                onChange={(value) => setField('street', value)}
                error={buyerErrors.street}
                autoComplete="street-address"
                maxLength={CHECKOUT_LIMITS.street}
                placeholder="Av. Principal #123"
                testId="checkout-street"
              />
              <TextField
                id="checkout-zona"
                label="Zona o distrito"
                required
                value={buyer.district}
                onChange={(value) => setField('district', value)}
                error={buyerErrors.district}
                maxLength={CHECKOUT_LIMITS.district}
                placeholder="Equipetrol"
                testId="checkout-district"
              />
              <div className="sm:col-span-2">
                <TextField
                  id="checkout-referencia"
                  label="Referencia (opcional)"
                  value={buyer.reference}
                  onChange={(value) => setField('reference', value)}
                  maxLength={CHECKOUT_LIMITS.reference}
                  placeholder="Porton negro, frente a la plaza"
                  testId="checkout-reference"
                />
              </div>
            </div>

            <div className="sf-panel mt-4" data-testid="checkout-city">
              <h3 className="sf-eyebrow">Ciudad de entrega</h3>
              <p className="mt-1 text-sm font-semibold text-fg" data-testid="checkout-city-name">
                {cityName} ({cityCode})
              </p>
              <p className="mt-1 text-xs text-fg-secondary">
                Precio, existencia y envio se calculan para esta ciudad ({cityDeliveryDays}{' '}
                {cityDeliveryDays === 1 ? 'dia habil' : 'dias habiles'} de entrega). Para cambiarla,
                usa el selector de ciudad del encabezado y vuelve al checkout.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="sf-btn sf-btn-primary" onClick={goToStep2} data-testid="checkout-next-1">
                Continuar a entrega y pago
              </button>
              <a href="/carrito" className="sf-btn sf-btn-secondary">
                Volver al carrito
              </a>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section
            ref={stepPanel}
            tabIndex={-1}
            aria-labelledby="paso-entrega"
            className="sf-card flex flex-col p-4 focus:outline-none sm:p-5"
          >
            <h2 id="paso-entrega" className="sf-h3 text-fg">
              Forma de entrega y metodo de pago
            </h2>

            <fieldset className="mt-4" data-testid="checkout-delivery">
              <legend className="sf-eyebrow">Entrega</legend>
              <div className="mt-2 flex flex-col gap-2">
                <label htmlFor="entrega-home" className="sf-option">
                  <input
                    id="entrega-home"
                    type="radio"
                    name="forma-entrega"
                    value="HOME"
                    checked={deliveryType === 'HOME'}
                    onChange={() => setDeliveryType('HOME')}
                    data-testid="checkout-delivery-home"
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold text-fg">
                      {deliveryTypeLabel('HOME')}
                    </span>
                    <span className="block text-xs text-fg-secondary">
                      Entregamos en la direccion que registraste en {cityName}: {cityDeliveryDays}{' '}
                      {cityDeliveryDays === 1 ? 'dia habil' : 'dias habiles'}.
                    </span>
                  </span>
                </label>
                <label htmlFor="entrega-store" className="sf-option sf-option-soft">
                  <input
                    id="entrega-store"
                    type="radio"
                    name="forma-entrega"
                    value="STORE"
                    checked={deliveryType === 'STORE'}
                    onChange={() => setDeliveryType('STORE')}
                    data-testid="checkout-delivery-store"
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold text-fg">
                      {deliveryTypeLabel('STORE')} · fase 2
                    </span>
                    <span className="block text-xs text-fg-secondary">
                      El retiro en tienda todavia no esta implementado en el ERP: si lo eliges, la
                      tienda te confirma por correo o WhatsApp como se despacha el pedido.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="mt-5" data-testid="checkout-payment">
              <legend className="sf-eyebrow">Metodo de pago (sin tarjeta)</legend>
              <div className="mt-2 flex flex-col gap-2">
                {CHECKOUT_PAYMENT_METHODS.map((code) => {
                  const info = paymentMethodInfo(code);
                  if (info === null) return null;
                  const inputId = `pago-${code.toLowerCase()}`;
                  return (
                    <label key={code} htmlFor={inputId} className="sf-option">
                      <input
                        id={inputId}
                        type="radio"
                        name="metodo-pago"
                        value={code}
                        checked={paymentMethod === code}
                        onChange={() => setPaymentMethod(code)}
                        data-testid={`checkout-payment-${code.toLowerCase()}`}
                        className="mt-0.5 accent-primary"
                      />
                      <span>
                        <span className="block font-semibold text-fg">
                          {info.label}
                          {info.phaseTwo ? ' · fase 2' : ''}
                        </span>
                        <span className="block text-xs text-fg-secondary">{info.instructions}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-fg-tertiary" data-testid="checkout-payment-note">
                La tienda no publica numeros de cuenta ni codigos QR propios: te los envia al
                confirmar el pedido. Nunca te pediremos datos de tarjeta por esta pagina.
              </p>
            </fieldset>

            {orderError !== null ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-line-error bg-danger-soft p-3 text-sm text-fg"
                data-testid="checkout-order-error"
              >
                {orderError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="sf-btn sf-btn-secondary"
                onClick={() => setStep(1)}
                data-testid="checkout-back-1"
              >
                Volver a mis datos
              </button>
              <button
                type="button"
                className="sf-btn sf-btn-primary"
                onClick={goToStep3}
                data-testid="checkout-next-2"
              >
                Ver resumen del pedido
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section
            ref={stepPanel}
            tabIndex={-1}
            aria-labelledby="paso-resumen"
            className="sf-card flex flex-col gap-4 p-4 focus:outline-none sm:p-5"
          >
            <div>
              <h2 id="paso-resumen" className="sf-h3 text-fg">
                Resumen y confirmacion
              </h2>
              <p className="mt-1 text-xs text-fg-secondary">
                Estos importes los calcula el ERP para {cityName} con tu carrito actual. Si
                cambiaste algo en el carrito, vuelve a cotizar antes de confirmar.
              </p>
            </div>

            {quoteState.status === 'loading' ? (
              <div
                role="status"
                className="flex flex-col gap-3"
                data-testid="checkout-quote-loading"
              >
                <span className="sr-only">Cotizando con el ERP</span>
                <Skeleton shape="custom" className="h-20 w-full rounded-card" />
                <Skeleton shape="custom" className="h-36 w-full rounded-card" />
              </div>
            ) : null}

            {quoteState.status === 'error' ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-card border border-line-error bg-danger-soft p-3"
                data-testid="checkout-quote-error"
              >
                <p className="text-sm font-semibold text-fg">{quoteState.message}</p>
                <ul className="list-inside list-disc text-xs text-fg-secondary">
                  <li>Revisa la existencia de la ciudad de entrega o quita esa linea del carrito.</li>
                  <li>Si el articulo se despublico, la tienda no puede venderlo.</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="sf-btn sf-btn-secondary"
                    onClick={reloadQuote}
                    data-testid="checkout-quote-reload"
                  >
                    Volver a cotizar
                  </button>
                  <a href="/carrito" className="sf-btn sf-btn-secondary" data-testid="checkout-quote-cart">
                    Ir al carrito
                  </a>
                </div>
              </div>
            ) : null}

            {quoteState.status === 'ready' ? (
              <>
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line" data-testid="checkout-quote-lines">
                  {quoteState.quote.items.map((line) => {
                    const snapshot = linesByItemId.get(line.itemId);
                    return (
                      <li
                        key={line.itemId}
                        className="flex items-center gap-3 p-3"
                        data-testid="checkout-quote-line"
                        data-item-id={line.itemId}
                      >
                        <ProductImage
                          src={snapshot?.image ?? null}
                          alt={line.name}
                          sizes="64px"
                          className="h-16 w-16 shrink-0 rounded-btn"
                        />
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-semibold text-fg">{line.name}</span>
                          <span className="text-xs text-fg-tertiary">
                            SKU {line.sku} · {line.quantity} ×{' '}
                            {formatMoney(line.price, quoteState.quote.currency)} · disponible{' '}
                            {line.available}
                          </span>
                          {line.offerDiscount > 0 ? (
                            <span
                              className="text-xs font-medium text-ok"
                              data-testid="checkout-quote-line-offer"
                            >
                              Oferta de catalogo {line.offerPct}% · −
                              {formatMoney(line.offerDiscount, quoteState.quote.currency)} · antes{' '}
                              {formatMoney(line.listPrice, quoteState.quote.currency)}
                            </span>
                          ) : null}
                          {line.discount > 0 ? (
                            <span
                              className="text-xs font-medium text-ok"
                              data-testid="checkout-quote-line-discount"
                            >
                              Descuento de la empresa {line.discountPct}% · −
                              {formatMoney(line.discount, quoteState.quote.currency)}
                            </span>
                          ) : null}
                          {line.taxAmount > 0 ? (
                            <span
                              className="text-xs text-fg-tertiary"
                              data-testid="checkout-quote-line-tax"
                            >
                              Incluye {formatMoney(line.taxAmount, quoteState.quote.currency)} de
                              impuesto · sin impuesto{' '}
                              {formatMoney(line.netTotal, quoteState.quote.currency)}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-sm font-semibold text-fg">
                          {formatMoney(line.lineTotal, quoteState.quote.currency)}
                        </span>
                      </li>
                    );
                  })}
                  {quoteState.quote.shippingItem !== null ? (
                    // El flete es una **linea mas** del documento del ERP: se especifica como
                    // envio en la lista (con el articulo de servicio de la ciudad) para que el
                    // comprador vea que esa linea no es un producto.
                    <li
                      className="flex items-center justify-between gap-3 p-3"
                      data-testid="checkout-quote-line-shipping"
                    >
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-fg">
                          Envio · {quoteState.quote.shippingItem.name}
                        </span>
                        <span className="text-xs text-fg-tertiary">
                          Servicio de entrega de la ciudad (SKU{' '}
                          {quoteState.quote.shippingItem.code})
                          {quoteState.quote.freeShippingApplied
                            ? ' · gratis por superar el umbral'
                            : quoteState.quote.shippingCharged
                              ? ''
                              : ' · esta ciudad no lo cobra'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-fg">
                        {formatMoney(quoteState.quote.shipping, quoteState.quote.currency)}
                      </span>
                    </li>
                  ) : null}
                </ul>

                <TotalsBreakdown
                  currency={quoteState.quote.currency}
                  listSubtotal={
                    quoteState.quote.offerDiscount > 0
                      ? quoteState.quote.listSubtotal
                      : null
                  }
                  offerDiscount={quoteState.quote.offerDiscount}
                  offerPct={quoteState.quote.offerPct}
                  subtotal={quoteState.quote.subtotal}
                  companyDiscount={quoteState.quote.discount}
                  companyDiscountPct={quoteState.quote.companyDiscountPct}
                  netSubtotal={quoteState.quote.netSubtotal}
                  taxAmount={quoteState.quote.taxAmount}
                  taxRate={quoteTaxRate(quoteState.quote.items)}
                  taxInclusive={quoteState.quote.items.some(
                    (line) => line.taxAmount > 0 && line.taxInclusive,
                  )}
                  shipping={quoteState.quote.shipping}
                  shippingNote={
                    quoteState.quote.freeShippingApplied
                      ? 'gratis por superar el umbral'
                      : quoteState.quote.shippingCharged
                        ? undefined
                        : 'esta ciudad no lo cobra'
                  }
                  total={quoteState.quote.total}
                  prefix="checkout-quote"
                />

                <p
                  className="rounded-md border border-warn bg-warn-soft p-3 text-xs text-fg"
                  data-testid="checkout-tax-notice"
                >
                  {TAX_NOTICE}
                </p>
              </>
            ) : null}

            <dl className="sf-panel flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Unidades del carrito</dt>
                <dd className="font-medium text-fg" data-testid="checkout-items">
                  {itemCount}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Subtotal de referencia de la tienda</dt>
                <dd className="font-medium text-fg" data-testid="checkout-reference-subtotal">
                  {formatMoney(referenceSubtotal, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Comprador</dt>
                <dd className="font-medium text-fg" data-testid="checkout-buyer">
                  {buyer.name.trim()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Correo</dt>
                <dd className="font-medium text-fg" data-testid="checkout-buyer-email">
                  {buyer.email.trim()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Entrega</dt>
                <dd className="font-medium text-fg" data-testid="checkout-summary-delivery">
                  {deliveryTypeLabel(deliveryType)} · {cityName}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Direccion</dt>
                <dd className="text-right font-medium text-fg" data-testid="checkout-summary-address">
                  {buyer.street.trim()} · {buyer.district.trim()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-fg-secondary">Metodo de pago</dt>
                <dd className="font-medium text-fg" data-testid="checkout-summary-payment">
                  {paymentInfo?.label ?? paymentMethod}
                  {paymentInfo?.phaseTwo === true ? ' · fase 2' : ''}
                </dd>
              </div>
            </dl>

            {orderError !== null ? (
              <div
                role="alert"
                className="rounded-card border border-line-error bg-danger-soft p-3"
                data-testid="checkout-order-error"
              >
                <p className="text-sm font-semibold text-fg">{orderError}</p>
                <p className="mt-1 text-xs text-fg-secondary">
                  El pedido no se creo. Revisa el mensaje, corrige lo que indique y vuelve a
                  intentar: el reintento usa la misma operacion, asi que no puede duplicar el
                  pedido.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="sf-btn sf-btn-secondary"
                onClick={() => setStep(2)}
                disabled={sending}
                data-testid="checkout-back-2"
              >
                Volver a entrega y pago
              </button>
              <button
                type="button"
                className="sf-btn sf-btn-primary sf-btn-lg"
                onClick={() => {
                  void confirmOrder();
                }}
                // Nunca ambiguo: sin cotizacion valida o mientras envia, no se puede pulsar.
                disabled={sending || quoteState.status !== 'ready'}
                aria-busy={sending}
                data-testid="checkout-confirm"
              >
                {sending ? 'Enviando el pedido…' : 'Confirmar pedido'}
              </button>
            </div>

            {sending ? (
              <p role="status" className="text-xs text-fg-secondary" data-testid="checkout-sending">
                Creando el pedido en el ERP. No cierres esta pagina.
              </p>
            ) : null}

            <p className="text-xs text-fg-secondary" data-testid="checkout-tracking-note">
              {TRACKING_NOTICE}
            </p>
          </section>
        ) : null}
      </div>

      <aside
        aria-label="Tu carrito"
        className="sf-card flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-32 lg:w-80"
      >
        <h2 className="sf-h3 text-fg">Tu carrito</h2>
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.itemId} className="flex items-center gap-3" data-testid="checkout-cart-line">
              <ProductImage
                src={line.image}
                alt={line.name}
                sizes="48px"
                className="h-12 w-12 shrink-0 rounded-btn"
              />
              <div className="flex flex-1 flex-col">
                <span className="text-xs font-medium text-fg">{line.name}</span>
                <span className="text-xs text-fg-tertiary">
                  {line.quantity} × {formatMoney(line.price, line.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-fg-tertiary">
          Precios de referencia del carrito (maximo {MAX_LINE_QUANTITY} unidades por articulo). El
          importe que se cobra es el que cotiza el ERP en el resumen.
        </p>
        <a href="/carrito" className="sf-link text-xs">
          Editar el carrito
        </a>
      </aside>
    </div>
  );
}
