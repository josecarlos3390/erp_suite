/**
 * Contrato del checkout de la tienda: formas, limites y validacion.
 *
 * Este modulo es **puro** (no importa `server-only` ni toca el navegador) para que
 * las mismas reglas corran en los dos lados:
 *  - en el componente cliente, para dar el error en el campo antes de enviar;
 *  - en el route handler `/api/pedido`, que es el unico que habla con el ERP y el
 *    que decide de verdad (nada de `as any`: se comprueba tipo y longitud campo a
 *    campo y se **reconstruye** el cuerpo, de modo que lo que no se valida no se
 *    reenvia).
 *
 * Los limites son los del DTO del canal (`create-web-order.dto.ts` del ERP): si
 * cambian alli, cambian aqui, y la validacion del servidor del canal sigue siendo
 * la ultima palabra.
 */

export const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente de confirmacion',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'En preparacion',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Anulado',
  RETURNED: 'Devuelto',
};

export const PAYMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pago pendiente',
  paid: 'Pagado',
  failed: 'Pago rechazado',
  refunded: 'Reembolsado',
};

export const PAYMENT_METHOD_LABELS: Readonly<Record<string, string>> = {
  TRANSFER: 'Transferencia bancaria',
  QR: 'Pago con QR',
  CASH_ON_DELIVERY: 'Pago contra entrega',
  STORE_PICKUP: 'Pago al retirar en tienda',
};

export const DELIVERY_TYPE_LABELS: Readonly<Record<string, string>> = {
  HOME: 'Envio a domicilio',
  STORE: 'Retiro en tienda',
};

/**
 * Limites del canal. `quantity` coincide ademas con el tope del carrito
 * (`MAX_LINE_QUANTITY`), para que el checkout no pueda pedir mas de lo que el
 * carrito deja agregar.
 */
export const CHECKOUT_LIMITS = {
  cityCode: 20,
  idempotencyKey: 80,
  notes: 500,
  items: 50,
  quantity: 20,
  email: 160,
  name: 120,
  phone: 40,
  taxId: 30,
  street: 200,
  district: 80,
  reference: 200,
} as const;

/** Intencion del POST: cotizar (no crea nada) o crear el pedido. */
export type CheckoutIntent = 'quote' | 'order';

export type CheckoutDeliveryType = 'HOME' | 'STORE';

export type CheckoutPaymentMethod = 'TRANSFER' | 'QR' | 'CASH_ON_DELIVERY' | 'STORE_PICKUP';

/** Linea tal como viaja al servidor: solo articulo y cantidad. */
export interface CheckoutItemInput {
  itemId: number;
  quantity: number;
}

/** Datos del comprador invitado (los mismos campos que el DTO del canal). */
export interface CheckoutCustomerInput {
  email?: string;
  name?: string;
  phone?: string;
  taxId?: string;
  street?: string;
  district?: string;
  reference?: string;
}

/** Cuerpo que el navegador envia a `/api/pedido`. */
export interface CheckoutRequestBody {
  intent: CheckoutIntent;
  cityCode: string;
  items: CheckoutItemInput[];
  /**
   * Correo del comprador en la **cotizacion**: el canal lo usa (solo lectura) para
   * resolver el precio del cliente registrado —su tercero, su lista y sus acuerdos—
   * antes de confirmar. Sin el, la cotizacion resuelve como invitado.
   */
  customerEmail?: string;
  idempotencyKey?: string;
  deliveryType?: CheckoutDeliveryType;
  paymentMethod?: CheckoutPaymentMethod;
  customer?: CheckoutCustomerInput;
  notes?: string;
}

/**
 * Cuerpo **ya saneado** que la ruta reenvia al canal. El discriminante `intent`
 * no viaja al ERP: alli solo se usa para elegir endpoint.
 */
export type SanitizedCheckout =
  | {
      intent: 'quote';
      cityCode: string;
      items: CheckoutItemInput[];
      customerEmail?: string;
    }
  | {
      intent: 'order';
      idempotencyKey: string;
      cityCode: string;
      deliveryType: CheckoutDeliveryType;
      paymentMethod: CheckoutPaymentMethod;
      items: CheckoutItemInput[];
      customer: CheckoutCustomerInput;
      notes?: string;
    };

export interface ValidationResult {
  ok: boolean;
  /** Mensaje accionable en espanol (se muestra tal cual al comprador). */
  error?: string;
  /** Cuerpo saneado: solo existe cuando `ok`. */
  value?: SanitizedCheckout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Texto opcional: `undefined` si no vino, si no es string o si queda vacio.
 * Recorta el valor y lo corta al tope **en vez** de reenviarlo entero: lo que no
 * cabe, no viaja.
 */
function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return trimmed.slice(0, maxLength);
}

function optionalNumber(value: unknown): number | undefined {
  if (isFiniteNumber(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Cantidad: entera, >= 1 y <= el tope del carrito. */
export function readQuantity(value: unknown): number | undefined {
  const parsed = optionalNumber(value);
  if (parsed === undefined) return undefined;
  if (parsed < 1 || parsed > CHECKOUT_LIMITS.quantity) return undefined;
  return parsed;
}

/** Lineas del carrito: se descartan las invalidas y se agrupa por articulo. */
function sanitizeItems(value: unknown): CheckoutItemInput[] {
  if (!Array.isArray(value)) return [];
  const byItem = new Map<number, CheckoutItemInput>();
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const itemId = optionalNumber(raw['itemId']);
    const quantity = readQuantity(raw['quantity']);
    if (itemId === undefined || itemId <= 0 || quantity === undefined) continue;
    const existing = byItem.get(itemId);
    if (existing === undefined) {
      byItem.set(itemId, { itemId, quantity });
      continue;
    }
    const total = existing.quantity + quantity;
    existing.quantity = total > CHECKOUT_LIMITS.quantity ? CHECKOUT_LIMITS.quantity : total;
  }
  const lines = [...byItem.values()];
  return lines.length > CHECKOUT_LIMITS.items ? lines.slice(0, CHECKOUT_LIMITS.items) : lines;
}

/** Cuerpo del comprador: solo los campos del contrato, recortados. */
function sanitizeCustomer(value: unknown): CheckoutCustomerInput {
  if (!isRecord(value)) return {};
  const customer: CheckoutCustomerInput = {};
  const email = optionalText(value['email'], CHECKOUT_LIMITS.email);
  if (email !== undefined) customer.email = email;
  const name = optionalText(value['name'], CHECKOUT_LIMITS.name);
  if (name !== undefined) customer.name = name;
  const phone = optionalText(value['phone'], CHECKOUT_LIMITS.phone);
  if (phone !== undefined) customer.phone = phone;
  const taxId = optionalText(value['taxId'], CHECKOUT_LIMITS.taxId);
  if (taxId !== undefined) customer.taxId = taxId;
  const street = optionalText(value['street'], CHECKOUT_LIMITS.street);
  if (street !== undefined) customer.street = street;
  const district = optionalText(value['district'], CHECKOUT_LIMITS.district);
  if (district !== undefined) customer.district = district;
  const reference = optionalText(value['reference'], CHECKOUT_LIMITS.reference);
  if (reference !== undefined) customer.reference = reference;
  return customer;
}

function readDeliveryType(value: unknown): CheckoutDeliveryType | undefined {
  return value === 'HOME' || value === 'STORE' ? value : undefined;
}

function readPaymentMethod(value: unknown): CheckoutPaymentMethod | undefined {
  switch (value) {
    case 'TRANSFER':
    case 'QR':
    case 'CASH_ON_DELIVERY':
    case 'STORE_PICKUP':
      return value;
    default:
      return undefined;
  }
}

/**
 * Valida y **reconstruye** el cuerpo del checkout.
 *
 * Nunca devuelve el objeto que llego: arma uno nuevo con los campos conocidos, de
 * modo que cualquier propiedad de mas (o con el tipo equivocado) se descarta antes
 * de tocar el canal del ERP.
 */
export function validateCheckoutBody(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: 'El cuerpo de la peticion no es un objeto JSON.' };
  }

  const intent = body['intent'];
  if (intent !== 'quote' && intent !== 'order') {
    return { ok: false, error: 'Falta la intencion del checkout ("quote" u "order").' };
  }

  const cityCode = optionalText(body['cityCode'], CHECKOUT_LIMITS.cityCode);
  if (cityCode === undefined) {
    return { ok: false, error: 'Falta la ciudad de entrega.' };
  }

  const items = sanitizeItems(body['items']);
  if (items.length === 0) {
    return {
      ok: false,
      error: 'El carrito no tiene lineas validas: agrega productos antes de continuar.',
    };
  }

  if (intent === 'quote') {
    // El correo viaja **solo** si es un correo plausible: la cotizacion es de lectura,
    // asi que uno mal escrito no se rechaza —se cotiza como invitado— y el checkout ya
    // no deja confirmar con el campo invalido.
    const rawEmail = optionalText(body['customerEmail'], CHECKOUT_LIMITS.email);
    const customerEmail =
      rawEmail !== undefined && isDeliverableEmail(rawEmail) ? rawEmail : undefined;
    return {
      ok: true,
      value: {
        intent: 'quote',
        cityCode: cityCode.toUpperCase(),
        items,
        ...(customerEmail === undefined ? {} : { customerEmail }),
      },
    };
  }

  const idempotencyKey = optionalText(body['idempotencyKey'], CHECKOUT_LIMITS.idempotencyKey);
  if (idempotencyKey === undefined) {
    return {
      ok: false,
      error: 'Falta la clave de idempotencia del intento de compra: recarga el checkout.',
    };
  }

  const deliveryType = readDeliveryType(body['deliveryType']);
  if (deliveryType === undefined) {
    return { ok: false, error: 'La forma de entrega debe ser HOME o STORE.' };
  }

  const paymentMethod = readPaymentMethod(body['paymentMethod']);
  if (paymentMethod === undefined) {
    return {
      ok: false,
      error: 'Elige un metodo de pago: TRANSFER, QR, CASH_ON_DELIVERY o STORE_PICKUP.',
    };
  }

  const customer = sanitizeCustomer(body['customer']);
  const notes = optionalText(body['notes'], CHECKOUT_LIMITS.notes);

  return {
    ok: true,
    value: {
      intent: 'order',
      idempotencyKey,
      cityCode: cityCode.toUpperCase(),
      deliveryType,
      paymentMethod,
      items,
      customer,
      ...(notes === undefined ? {} : { notes }),
    },
  };
}

export interface BuyerFieldErrors {
  email?: string;
  name?: string;
  phone?: string;
  taxId?: string;
  street?: string;
  district?: string;
  reference?: string;
}

/** Validacion simple de correo: sin `@` o sin punto en el dominio, no vale. */
export function isDeliverableEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > CHECKOUT_LIMITS.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/**
 * Reglas de la **tienda** para el paso 1 (el canal las acepta opcionales).
 *
 * Pedimos los cuatro datos con los que se puede entregar y avisar un pedido; el
 * CI/NIT queda opcional porque la factura se emite en el back office del ERP.
 */
export function validateBuyer(customer: CheckoutCustomerInput): BuyerFieldErrors {
  const errors: BuyerFieldErrors = {};
  const email = customer.email?.trim() ?? '';
  if (email === '') {
    errors.email = 'Escribe un correo para avisarte del pedido.';
  } else if (!isDeliverableEmail(email)) {
    errors.email = 'El correo no parece valido (ejemplo: nombre@dominio.com).';
  }
  if ((customer.name?.trim() ?? '') === '') {
    errors.name = 'Escribe el nombre de quien recibe.';
  }
  if ((customer.phone?.trim() ?? '') === '') {
    errors.phone = 'Escribe un telefono de contacto.';
  }
  if ((customer.street?.trim() ?? '') === '') {
    errors.street = 'Escribe la calle y el numero.';
  }
  if ((customer.district?.trim() ?? '') === '') {
    errors.district = 'Escribe la zona o distrito.';
  }
  const taxId = customer.taxId?.trim();
  if (taxId !== undefined && taxId !== '' && taxId.length > CHECKOUT_LIMITS.taxId) {
    errors.taxId = `El CI/NIT no puede pasar de ${CHECKOUT_LIMITS.taxId} caracteres.`;
  }
  return errors;
}

/** `true` si no hay ningun error de campo. */
export function buyerErrorsAreClear(errors: BuyerFieldErrors): boolean {
  return Object.values(errors).every((value) => value === undefined);
}

/** Etiqueta legible de un estado que el canal publique (o el codigo crudo). */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Etiqueta legible del estado del pago (o el codigo crudo). */
export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

/** Etiqueta legible del metodo de pago (o el codigo crudo). */
export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Etiqueta legible de la forma de entrega (o el codigo crudo). */
export function deliveryTypeLabel(delivery: string): string {
  return DELIVERY_TYPE_LABELS[delivery] ?? delivery;
}

/**
 * Instrucciones **honestas** por metodo de pago (decision D4: offline primero).
 *
 * La tienda no publica numeros de cuenta ni QR propios: no los tiene —el canal no
 * los expone— y inventarlos seria un dato falso. Lo que se promete es lo unico
 * cierto: la tienda confirma los datos de pago por correo/WhatsApp con el
 * comprador. El **retiro en tienda** esta declarado como **fase 2** (el ERP ya
 * tiene los campos de sucursal, pero el flujo de retiro no existe todavia).
 */
export interface PaymentMethodInfo {
  code: CheckoutPaymentMethod;
  label: string;
  instructions: string;
  /** `true` cuando el metodo depende de una fase aun no implementada. */
  phaseTwo: boolean;
}

export const PAYMENT_METHOD_INFO: readonly PaymentMethodInfo[] = [
  {
    code: 'TRANSFER',
    label: PAYMENT_METHOD_LABELS['TRANSFER'] ?? 'Transferencia bancaria',
    instructions:
      'Confirmas el pedido y la tienda te envia por correo o WhatsApp los datos de la cuenta para la transferencia, junto con el numero de pedido. El pedido queda con el pago pendiente hasta que la tienda lo concilie.',
    phaseTwo: false,
  },
  {
    code: 'QR',
    label: PAYMENT_METHOD_LABELS['QR'] ?? 'Pago con QR',
    instructions:
      'Confirmas el pedido y la tienda te envia por correo o WhatsApp el QR de cobro con el importe exacto y el numero de pedido como referencia. El pedido queda con el pago pendiente hasta que la tienda lo concilie.',
    phaseTwo: false,
  },
  {
    code: 'CASH_ON_DELIVERY',
    label: PAYMENT_METHOD_LABELS['CASH_ON_DELIVERY'] ?? 'Pago contra entrega',
    instructions:
      'Pagas en efectivo al recibir el pedido, en la direccion que registraste. El repartidor confirma el cobro y la tienda lo concilia despues; el pedido queda con el pago pendiente hasta entonces.',
    phaseTwo: false,
  },
  {
    code: 'STORE_PICKUP',
    label: PAYMENT_METHOD_LABELS['STORE_PICKUP'] ?? 'Pago al retirar en tienda',
    instructions:
      'Pago y retiro en la sucursal de tu ciudad. El flujo de retiro en tienda esta declarado como fase 2: puedes elegirlo, pero la tienda te confirmara por correo o WhatsApp si el pedido se despacha o se retira mientras esa fase llega.',
    phaseTwo: true,
  },
];

/** Metodos de pago ofrecidos en el paso 2, en el orden del canal. */
export const CHECKOUT_PAYMENT_METHODS: readonly CheckoutPaymentMethod[] =
  PAYMENT_METHOD_INFO.map((info) => info.code);

/** Instrucciones de un metodo (o `null` si el codigo no es del contrato). */
export function paymentMethodInfo(code: string): PaymentMethodInfo | null {
  return PAYMENT_METHOD_INFO.find((info) => info.code === code) ?? null;
}

/**
 * Aviso obligatorio del checkout: la cotizacion **no** incluye impuestos.
 * El impuesto lo aplica el ERP al confirmar y se ve en la confirmacion.
 */
export const TAX_NOTICE =
  'El total de la cotizacion no incluye impuestos: el ERP aplica el impuesto de la empresa al confirmar el pedido y el desglose real aparece en la confirmacion.';

/** Aviso de donde se sigue el pedido despues de confirmarlo. */
export const TRACKING_NOTICE =
  'El estado del pedido se consulta en cualquier momento en /seguimiento con el numero de pedido y tu correo.';
