# Boilerplate Module Template (NestJS ERP)

Use this as the starting point for every new domain module.

---

## Folder structure

```
src/purchase-orders/
├── dto/
│   ├── create-purchase-order.dto.ts
│   └── update-purchase-order.dto.ts
├── purchase-orders.module.ts
├── purchase-orders.controller.ts
├── purchase-orders.service.ts
├── purchase-orders.service.spec.ts
└── purchase-orders.controller.spec.ts
```

Replace `purchase-orders` with your module name in `kebab-case`. Class names use `PascalCase` (`PurchaseOrders`).

---

## 1. Module

```typescript
import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { SettingsModule } from '../settings/settings.module';
@Module({
  imports: [SettingsModule],
  providers: [PurchaseOrdersService],
  controllers: [PurchaseOrdersController],
})
export class PurchaseOrdersModule {}
```

Import other modules only when their **services** are needed (e.g. `SettingsModule`, `PriceListsModule`).
`PrismaService` is provided by the global `PrismaModule`; you do **not** need to import `PrismaModule` explicitly.

---

## 2. Controller (with SAP B1 aliases)

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { resolveSapAliases } from '../common/sap-alias.util';
import {
  addSapAliasesToDocument,
  addSapAliasesToPaginated,
} from '../common/sap-alias-response.util';

@ApiTags('PurchaseOrders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly service: PurchaseOrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await resolveSapAliases(dto, dto.items ?? [], this.prisma, user.tenantId);
    const doc = await this.service.create(dto, user.sub, user.tenantId);
    return addSapAliasesToDocument(doc);
  }

  @Get()
  async findAll(
    @Query('page')   page?: string,
    @Query('limit')  limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.service.findAll(
      {
        page:   page   ? +page   : undefined,
        limit:  limit  ? +limit  : undefined,
        search: search || undefined,
        status: status || undefined,
      },
      user.tenantId,
    );
    return addSapAliasesToPaginated(result);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const doc = await this.service.findOne(+id, user.tenantId);
    return addSapAliasesToDocument(doc);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await resolveSapAliases(dto, dto.items ?? [], this.prisma, user.tenantId);
    const doc = await this.service.update(+id, dto, user.sub, user.tenantId);
    return addSapAliasesToDocument(doc);
  }

  @Post(':id/close')
  async close(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const doc = await this.service.close(+id, user.sub, user.tenantId);
    return addSapAliasesToDocument(doc);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const doc = await this.service.cancel(+id, user.sub, user.tenantId);
    return addSapAliasesToDocument(doc);
  }
}
```

---

## 3. Service (skeleton)

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateCode, CODE_SEQUENCES } from '../common/code-generator';
import { SettingsService } from '../settings/settings.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import {
  PaginatedResult,
  PaginationParams,
  parsePagination,
} from '../common/paginated-result';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private async generateCode(
    tx: Prisma.TransactionClient,
    tenantId: number,
  ): Promise<string> {
    const { seq, prefix, pad } = CODE_SEQUENCES.purchaseOrders;
    return generateCode(tx, tenantId, seq, prefix, pad);
  }

  // ────────────────
  // Crear
  // ────────────────
  async create(
    dto: CreatePurchaseOrderDto,
    createdById: number,
    tenantId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateCode(tx, tenantId);
      // TODO: validate catalog entities, calculate lines, create header + lines
      const doc = await tx.purchaseOrder.create({
        data: {
          code,
          tenantId,
          createdById,
          // ...dto fields
        },
        include: { items: true },
      });
      return doc;
    });
  }

  // ────────────────
  // Listar
  // ────────────────
  async findAll(
    params: PaginationParams & { search?: string; status?: string },
    tenantId: number,
  ): Promise<PaginatedResult<unknown>> {
    const { skip, take } = parsePagination(params);
    const where: Prisma.PurchaseOrderWhereInput = {
      status: { not: 'INACTIVE' },
      tenantId,
      ...(params.search
        ? {
            OR: [
              {
                code: {
                  contains: params.search,
                  mode: 'insensitive',
                },
              },
              {
                partner: {
                  name: {
                    contains: params.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                partner: {
                  code: {
                    contains: params.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        include: { partner: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page || 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  // ────────────────
  // Obtener uno
  // ────────────────
  async findOne(id: number, tenantId: number) {
    const doc = await this.prisma.purchaseOrder.findUnique({
      where: { id, tenantId },
      include: {
        partner: true,
        items: { include: { item: true } },
      },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  // ────────────────
  // Actualizar
  // ────────────────
  async update(
    id: number,
    dto: UpdatePurchaseOrderDto,
    updatedById: number,
    tenantId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // TODO: validate existing doc, update lines, recalc stock, etc.
      return tx.purchaseOrder.update({
        where: { id, tenantId },
        data: {
          /* ... */
        },
        include: { items: true },
      });
    });
  }

  // ────────────────
  // Cerrar / Cancelar
  // ────────────────
  async close(id: number, updatedById: number, tenantId: number) {
    // TODO: implement close logic
  }

  async cancel(id: number, updatedById: number, tenantId: number) {
    // TODO: implement cancel logic (soft delete -> status INACTIVE)
  }
}
```

---

## 4. Create DTO (with SAP B1 aliases)

```typescript
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toNumber = ({ value }: { value: unknown }) =>
  value != null ? Number(value) : value;

class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'ID del articulo' })
  @IsInt()
  itemId!: number;

  @ApiPropertyOptional({ description: 'Código SAP del artículo (ItemCode)' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiProperty({ description: 'Cantidad' })
  @Transform(toNumber)
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  discountAmt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  warehouseId?: number | null;

  @ApiPropertyOptional({ description: 'Código SAP del almacén de línea (WhsCode)' })
  @IsOptional()
  @IsString()
  whsCode?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'ID del proveedor' })
  @IsInt()
  partnerId!: number;

  @ApiPropertyOptional({ description: 'Código SAP del socio (CardCode)' })
  @IsOptional()
  @IsString()
  cardCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  warehouseId?: number | null;

  @ApiPropertyOptional({ description: 'Código SAP del almacén de cabecera (WhsCode)' })
  @IsOptional()
  @IsString()
  whsCode?: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}
```

---

## 5. Update DTO

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}
```

If the update logic requires distinguishing existing lines from new lines, add `id?: number` to the inner item DTO and write the update DTO explicitly instead of using `PartialType`.
