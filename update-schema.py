import re

with open('backend-erp/prisma/schema.prisma', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Agregar relaciones inversas en PaymentTerm
old_payment_term = '''model PaymentTerm {
  id          Int      @id @default(autoincrement())
  tenantId    Int
  name        String
  days        Int      @default(0)
  isDefault   Boolean  @default(false)
  status      Status   @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  partners    Partner[]

  @@unique([tenantId, name])
  @@index([tenantId])
}'''

new_payment_term = '''model PaymentTerm {
  id                      Int                      @id @default(autoincrement())
  tenantId                Int
  name                    String
  days                    Int                      @default(0)
  isDefault               Boolean                  @default(false)
  status                  Status                   @default(ACTIVE)
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
  tenant                  Tenant                   @relation(fields: [tenantId], references: [id])
  partners                Partner[]
  salesQuotations         SalesQuotation[]
  salesOrders             SalesOrder[]
  deliveryOrders          DeliveryOrder[]
  saleInvoices            SaleInvoice[]
  saleReserveInvoices     SaleReserveInvoice[]
  purchaseQuotations      PurchaseQuotation[]
  purchaseOrders          PurchaseOrder[]
  purchaseReceipts        PurchaseReceipt[]
  purchaseInvoices        PurchaseInvoice[]

  @@unique([tenantId, name])
  @@index([tenantId])
}'''

content = content.replace(old_payment_term, new_payment_term)

# 2. Agregar relaciones inversas en User
user_addition = """  salesQuotations         SalesQuotation[]         @relation("QuotationSeller")
  salesOrders             SalesOrder[]             @relation("OrderSeller")
  deliveryOrders          DeliveryOrder[]          @relation("DeliverySeller")
  saleInvoices            SaleInvoice[]            @relation("InvoiceSeller")
  saleReserveInvoices     SaleReserveInvoice[]     @relation("ReserveInvoiceSeller")"""

content = content.replace(
    '  stockMovements                 StockMovement[]',
    user_addition + '\n  stockMovements                 StockMovement[]'
)

# 3. Funcion para agregar campos
def add_fields_to_model(content, model_name, is_sales=False):
    pattern = rf'(model {model_name} \{{[\s\S]*?)(\n  @@unique)'
    match = re.search(pattern, content)
    if not match:
        print(f'WARNING: No se encontro {model_name}')
        return content

    base_fields = """  contactPerson   String?
  contactPhone    String?
  shipToAddress   String?
  paymentTermsId  Int?
  dueDate         DateTime?
  paymentTerms    PaymentTerm?  @relation(fields: [paymentTermsId], references: [id])"""

    rel_map = {
        'SalesQuotation': 'QuotationSeller',
        'SalesOrder': 'OrderSeller',
        'DeliveryOrder': 'DeliverySeller',
        'SaleInvoice': 'InvoiceSeller',
        'SaleReserveInvoice': 'ReserveInvoiceSeller',
    }

    if is_sales and model_name in rel_map:
        base_fields += f'\n  salesPersonId   Int?\n  salesPerson     User?         @relation(fields: [salesPersonId], references: [id], name: "{rel_map[model_name]}")'

    old_block = match.group(1) + '\n  @@unique'
    new_block = match.group(1).rstrip() + '\n' + base_fields + '\n\n  @@unique'
    content = content.replace(old_block, new_block, 1)
    return content

sales_docs = ['SalesQuotation', 'SalesOrder', 'DeliveryOrder', 'SaleInvoice', 'SaleReserveInvoice']
purchase_docs = ['PurchaseQuotation', 'PurchaseOrder', 'PurchaseReceipt', 'PurchaseInvoice']

for doc in sales_docs:
    content = add_fields_to_model(content, doc, is_sales=True)
    print(f'Procesado: {doc} (venta)')

for doc in purchase_docs:
    content = add_fields_to_model(content, doc, is_sales=False)
    print(f'Procesado: {doc} (compra)')

with open('backend-erp/prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(content)

print('Schema actualizado exitosamente')
