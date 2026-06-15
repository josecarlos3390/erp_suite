Usar en tu aplicación
TypeScript
// app.component.ts — importar lo que necesites
import { LunaButtonComponent } from './shared/luna/luna-button.component';
import { LunaInputComponent } from './shared/luna/luna-input.component';
import { LunaCardComponent } from './shared/luna/luna-card.component';
import { LunaToastContainerComponent } from './shared/luna/luna-toast.component';
import { LunaToastService } from './shared/luna/luna-toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    LunaButtonComponent,
    LunaInputComponent,
    LunaCardComponent,
    LunaToastContainerComponent
  ],
  template: `
    <!-- Toast container global -->
    <luna-toast-container></luna-toast-container>
    
    <!-- Tu contenido -->
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  constructor(private toast: LunaToastService) {}
}
3. Ejemplos de uso
HTML
<!-- Botón premium -->
<<luna-button variant="primary" size="lg" icon="fas fa-plus" (clicked)="crear()">
  Nuevo registro
</luna-button>

<!-- Input con glassmorphism -->
<<luna-input
  label="Email"
  placeholder="usuario@empresa.com"
  leadingIcon="fas fa-envelope"
  [clearable]="true"
  [(ngModel)]="email"
></luna-input>

<!-- Card con glassmorphism -->
<<luna-card variant="glass" hoverable title="Ventas del mes" icon="fas fa-chart-line">
  <div class="stats">$45,230</div>
</luna-card>

<!-- Toast desde código -->
<button (click)="toast.success('Guardado', 'Los cambios se guardaron correctamente')">
  Probar toast
</button>
🎯 Características Premium Implementadas
Table
Feature	Componentes que lo usan
Glassmorphism	Button, Card, Modal, Toast, Dropdown
Layered Shadows	Button, Card, Modal
Gradientes	Button (primary/destructive)
Glow Effects	Button (focus), Input (focus/error)
Spring Animations	Toggle, Tabs, Modal
Ripple Effect	Button
Shimmer Loading	Skeleton
Pause on Hover	Toast
Reduced Motion	Todos (vía tokens)


Componentes Adicionales Generados
Table
#	Componente	Archivo	Descripción
12	Data Table	luna-data-table.component.ts	Inline editing, sorting, selección, paginación, columnas congeladas
13	Command Palette	luna-command-palette.component.ts	⌘K, fuzzy search, highlight, secciones, atajos
14	Sticky Summary	luna-sticky-summary.component.ts	Barra flotante para totales, formatos currency/percent, animaciones
15	Date Picker	luna-date-picker.component.ts	Calendario glassmorphism, rango, min/max, reactive forms
16	Select/Combobox	luna-select.component.ts	Búsqueda, múltiple, crear opción, grupos, tags
📁 Archivos de soporte
index.ts — Barrel export de todos los componentes
README-KIT.md — Documentación completa con ejemplos
🚀 Instalación rápida
bash
# 1. Copiar todo al proyecto
cp luna-kit/*.component.ts src/app/shared/luna/
cp luna-kit/*.service.ts src/app/shared/luna/
cp luna-kit/index.ts src/app/shared/luna/

# 2. Asegurar que tienes los tokens CSS
# (ver sección anterior de tokens v2.0)

# 3. Importar en tu componente
import { 
  LunaDataTableComponent, 
  LunaCommandPaletteComponent,
  LunaStickySummaryComponent,
  LunaDatePickerComponent,
  LunaSelectComponent,
  LunaToastService 
} from './shared/luna';
💡 Ejemplos de uso avanzado
Data Table con inline editing
HTML
<<luna-data-table
  [columns]="[
    { key: 'codigo', header: 'Código', width: '100px' },
    { key: 'nombre', header: 'Nombre', editable: true },
    { key: 'precio', header: 'Precio', type: 'currency', editable: true, align: 'right' },
    { key: 'estado', header: 'Estado', type: 'badge' }
  ]"
  [data]="productos"
  [selectable]="true"
  (editSave)="guardarCambio($event)"
  (selectionChange)="actualizarSeleccion($event)"
>
  <ng-template batchActions>
    <luna-button variant="destructive" size="sm">Eliminar</luna-button>
  </ng-template>
</luna-data-table>
Command Palette global
TypeScript
// app.component.ts
commands = [
  { id: 'clientes', title: 'Clientes', icon: 'fas fa-users', shortcut: '⌘1', 
    section: 'Navegación', action: () => this.router.navigate(['/clientes']) },
  { id: 'facturas', title: 'Facturas', icon: 'fas fa-file-invoice', shortcut: '⌘2',
    section: 'Navegación', action: () => this.router.navigate(['/facturas']) },
  { id: 'nuevo', title: 'Nuevo Cliente', icon: 'fas fa-plus', shortcut: '⌘N',
    section: 'Acciones', action: () => this.router.navigate(['/clientes/nuevo']) }
];
HTML
<<luna-command-palette [items]="commands"></luna-command-palette>
Sticky Summary para facturas
HTML
<<luna-sticky-summary
  [visible]="true"
  [items]="[
    { label: 'Subtotal', value: subtotal, format: 'currency', prefix: 'S/' },
    { label: 'IGV', value: igv, format: 'currency', prefix: 'S/' },
    { label: 'Total', value: total, format: 'currency', prefix: 'S/', highlight: true, animated: true }
  ]"
>
  <ng-template actions>
    <luna-button variant="secondary">Cancelar</luna-button>
    <luna-button variant="primary">Emitir Factura</luna-button>
  </ng-template>
</luna-sticky-summary>
Select con búsqueda y creación
HTML
<<luna-select
  label="Cliente"
  [options]="clientes"
  [searchable]="true"
  [allowCreate]="true"
  [(ngModel)]="clienteId"
  (optionCreated)="crearCliente($event)"
></luna-select>
