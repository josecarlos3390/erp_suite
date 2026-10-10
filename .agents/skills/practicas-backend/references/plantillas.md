# Plantillas (backend NestJS + Prisma)

Plantillas mínimas y **genéricas**. Sustituye `orders`/`Order` por tu recurso antes de copiar. Si el
proyecto tiene una guía canónica, manda ella.

---

## Estructura de carpetas

```
src/orders/
├── dto/
│   ├── create-order.dto.ts
│   └── update-order.dto.ts
├── orders.module.ts
├── orders.controller.ts
├── orders.service.ts
├── orders.service.spec.ts
└── orders.controller.spec.ts
```

`kebab-case` en carpetas, rutas y decoradores; `PascalCase` en clases. Las pruebas **al lado** del
código.

---

## 1. Módulo

```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule], // solo si necesitas SUS SERVICIOS
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
```

El cliente del ORM vive en un módulo global: **no** se importa en cada módulo. Importa otros módulos
solo cuando necesites sus servicios.

---

## 2. DTO de creación

```typescript
import {
  IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString,
  Min, ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Convierte lo que llegue (habitualmente texto) a número, sin coerción implícita. */
const toNumber = ({ value }: { value: unknown }) =>
  value != null ? Number(value) : value;

export const ORDER_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

class CreateOrderLineDto {
  @ApiProperty({ description: 'Identificador del artículo' })
  @IsInt()
  itemId!: number;

  @ApiProperty({ description: 'Cantidad' })
  @Transform(toNumber)
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Descuento por línea, en porcentaje' })
  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  warehouseId?: number | null;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Identificador del tercero' })
  @IsInt()
  partnerId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Fecha del documento (ISO)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @ApiProperty({ type: [CreateOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  items!: CreateOrderLineDto[];
}
```

Reglas que no se ven en el ejemplo:

- **Toda** propiedad tiene decorador de validación. Una propiedad sin validar es una puerta abierta.
- El **inquilino** y el **autor** no están en el DTO: se resuelven en el borde desde el token.
- Los campos numéricos se transforman explícitamente: `"2"` y `2` llegan del mismo formulario.
- El vocabulario de estados se declara **una vez** y se exporta (`ORDER_STATUSES`), para que el `@IsIn`
  y el tipo del dominio no puedan divergir.

### DTO de actualización

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
```

Si la actualización tiene que distinguir **líneas existentes** de **líneas nuevas**, no uses
`PartialType`: escribe el DTO a mano con `id?: number` en la línea y documenta qué significa su
ausencia.

---

## 3. Controlador (traduce y delega)

```typescript
import {
  Body, Controller, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.sub, user.tenantId);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search || undefined,
        status: status || undefined,
      },
      user.tenantId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(Number(id), user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(Number(id), dto, user.sub, user.tenantId);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.close(Number(id), user.sub, user.tenantId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.cancel(Number(id), user.sub, user.tenantId);
  }
}
```

Lo que hace que este controlador esté bien: **no decide nada**. Convierte los query params a número,
firma la llamada con el autor y el inquilino, y devuelve lo que el servicio devolvió.

---

## 4. Servicio (esqueleto con el orden correcto)

```typescript
import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  PaginatedResult, PaginationParams, parsePagination,
} from '../common/paginated-result';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async create(dto: CreateOrderDto, createdById: number, tenantId: number) {
    return this.db.$transaction(async (tx) => {
      const code = await this.nextCode(tx, tenantId);
      const { useInclusiveTax } = await this.settings.getAll(tenantId);

      // 1) validar catálogos ANTES de escribir
      const partner = await tx.partner.findFirst({
        where: { id: dto.partnerId, tenantId },
      });
      if (!partner) throw new BadRequestException('El tercero no existe');

      const itemIds = [...new Set(dto.items.map((i) => i.itemId))];
      const items = await tx.item.findMany({
        where: { id: { in: itemIds }, tenantId },
      });
      if (items.length !== itemIds.length) {
        throw new BadRequestException('Alguno de los artículos no existe');
      }

      // 2) construir líneas (misma función en create y update)
      const lines = await this.buildLines(tx, dto.items, items, partner, {
        useInclusiveTax,
      });

      // 3) totales DESPUÉS de las líneas
      const totals = this.totalsFrom(lines, dto);

      // 4) cabecera + líneas
      const order = await tx.order.create({
        data: {
          code,
          tenantId,
          createdById,
          status: 'OPEN',
          partnerId: dto.partnerId,
          notes: dto.notes,
          date: dto.date ? new Date(dto.date) : new Date(),
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
        },
      });

      await tx.orderLine.createMany({
        data: lines.map((l, index) => ({
          orderId: order.id,
          lineNum: index + 1,
          ...l,
        })),
      });

      // 5) efectos derivados, en la MISMA transacción
      for (const l of lines) await this.applyStock(tx, l, tenantId);

      // 6) se devuelve el agregado
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { partner: true, items: { include: { item: true } } },
      });
    });
  }

  async findAll(
    params: PaginationParams & { search?: string; status?: string },
    tenantId: number,
  ): Promise<PaginatedResult<unknown>> {
    const { skip, take } = parsePagination(params);
    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(params.status ? { status: params.status } : { status: { not: 'CANCELLED' } }),
      ...(params.search
        ? {
            OR: [
              { code: { contains: params.search, mode: 'insensitive' } },
              { partner: { name: { contains: params.search, mode: 'insensitive' } } },
              { partner: { code: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.order.findMany({
        where, skip, take,
        include: { partner: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.order.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async findOne(id: number, tenantId: number) {
    const order = await this.db.order.findFirst({
      where: { id, tenantId }, // el inquilino va SIEMPRE en el filtro
      include: {
        partner: true,
        items: { include: { item: true, warehouse: true } },
      },
    });
    if (!order) throw new NotFoundException('El documento no existe');
    return order;
  }

  async update(
    id: number,
    dto: UpdateOrderDto,
    updatedById: number,
    tenantId: number,
  ) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!existing) throw new NotFoundException('El documento no existe');
      if (existing.status !== 'OPEN') {
        throw new BadRequestException('Solo se puede editar un documento abierto');
      }

      // revertir el impacto viejo, reconstruir, aplicar el nuevo
      for (const old of existing.items) await this.reverseStock(tx, old, tenantId);

      const lines = await this.buildLines(tx, dto.items ?? [], [], undefined, {});
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      await tx.orderLine.createMany({
        data: lines.map((l, index) => ({ orderId: id, lineNum: index + 1, ...l })),
      });
      for (const l of lines) await this.applyStock(tx, l, tenantId);

      const totals = this.totalsFrom(lines, dto);
      return tx.order.update({
        where: { id },
        data: { ...totals, updatedById },
        include: { items: true },
      });
    });
  }

  async close(id: number, updatedById: number, tenantId: number) {
    // ver references/documentos-y-efectos.md §4
    throw new Error('pendiente');
  }

  async cancel(id: number, updatedById: number, tenantId: number) {
    // ver references/documentos-y-efectos.md §5
    throw new Error('pendiente');
  }

  // ── ayudantes que PARTICIPAN de la transacción: reciben `tx` ───────────────

  private async nextCode(tx: Prisma.TransactionClient, tenantId: number) {
    // ver references/documentos-y-efectos.md §2 (secuencia + autocuración)
    throw new Error('pendiente');
  }

  private async buildLines(
    tx: Prisma.TransactionClient,
    lines: CreateOrderDto['items'],
    _items: unknown[],
    _partner: unknown,
    _options: Record<string, unknown>,
  ) {
    // precio, impuesto, descuento, coste → una sola implementación para create y update
    throw new Error('pendiente');
  }

  private totalsFrom(lines: unknown[], _dto: Partial<CreateOrderDto>) {
    throw new Error('pendiente');
  }

  private async applyStock(
    tx: Prisma.TransactionClient,
    line: unknown,
    tenantId: number,
  ) {
    throw new Error('pendiente');
  }

  private async reverseStock(
    tx: Prisma.TransactionClient,
    line: unknown,
    tenantId: number,
  ) {
    throw new Error('pendiente');
  }
}
```

Puntos que la plantilla **no** puede relajar:

- Todo lo que escribe vive en el `$transaction` y usa `tx`.
- El resultado de la transacción **se devuelve**; nadie ignora el retorno.
- `buildLines` es **la misma** en crear y actualizar.
- Actualizar empieza por revertir.
- Cada consulta filtra `tenantId`, incluidas las que el ORM no filtra solo.

---

## 5. Sobre de paginación (uno solo para todo el backend)

```typescript
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

export function parsePagination(params: PaginationParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit) || DEFAULT_LIMIT));
  return { skip: (page - 1) * limit, take: limit, page };
}
```

Un límite máximo explícito es parte del contrato: sin él, un cliente puede pedir el millón de filas y
tumbar la instancia.
