# Módulo Cómputo

Qué se va a hacer en la obra, qué hace falta comprar y cuánto. Se ve dentro de cada
proyecto, en la tarjeta "Cómputo".

## Archivos

- `src/lib/computos.ts` — el corazón: tipos, unidades (`UNIDAD_INFO`), cálculo de parciales
  y totales, desperdicio, conversión a material, bultos, hierros. El comentario del
  principio explica el modelo completo: leerlo antes de cambiar cualquier cálculo.
- `src/actions/computos.ts` — Server Actions de secciones, ítems, mediciones, filas extra y
  catálogo. Usan `requireSeccion("proyectos")`.
- `src/components/computos/` — pantalla:
  - `computo-section.tsx` (arma los datos) → `computo-board.tsx` → `seccion-grilla.tsx`
  - diálogos: `item-dialog`, `item-seccion-dialog`, `derivar-dialog`, `catalogo-dialog`
  - informes imprimibles (abren una ventana nueva y llaman a `print()`): `informe-rubro.ts`
    (grilla por niveles, para controlar en obra), `informe-presupuesto.ts` (lista para que
    cotice un proveedor) e `informe-computo.ts`.
- Modelos en `prisma/schema.prisma`: `ComputoSeccion`, `ComputoItem`, `ComputoMedicion`,
  `ComputoFilaExtra`, `ComputoSubItem`, `ComputoSubItemMedicion`, `ComputoItemTipo`
  (catálogo), `ComputoFecha`, enums `UnidadComputo`
  y `TipoComputo`.

## Modelo

- Jerarquía: **rubro → tipo (materiales o mano de obra) → sección → ítems**. La sección es
  una parte de la obra (MUROS, REVOQUES) que se arma a mano en cada proyecto.
- Cada sección es una **grilla**: los ítems son columnas y las filas son los niveles del
  proyecto (más filas extra, como SALA DE MÁQUINAS). El orden de las filas se guarda en
  `ComputoSeccion.ordenFilas` como lista de claves (`"nivel:id"`, `"extra:id"`).
- Materiales y mano de obra son dos cómputos separados, con secciones y totales propios.
- Solo aparecen los rubros con `Rubro.seComputa = true`.
- **La unidad manda**: define qué dimensiones se piden (largo, ancho, alto) y cómo se
  calcula. Es un enum cerrado.
- Dos clases de fila que suman al mismo total:
  - MEDIDA: se carga con dimensiones (`origenId` null).
  - DERIVADA: se calcula a partir de otro ítem (`origenId` apunta al ítem de origen).
    Hay que evitar ciclos: ver `creaCiclo`.
- **Conversión a material** (`rinde`, `rindeUnidad`, `porBulto`, `bultoNombre`): es la misma
  medición leída en la unidad de compra, no un ítem derivado aparte.
- Desperdicio: `null` significa "sin cargar" y `0` significa "no lleva". No son lo mismo.
- Los niveles con repeticiones (planta tipo ×4) multiplican sus filas: ver `parcialMedicion`.
- Ningún total se guarda: todo sale de `calcularTotales` / `totalItem`.
- **Cómputos 2** (`ComputoSeccion.esComputos2`): nació como una grilla paralela a la de
  siempre. En noviembre de 2026 se borró el cómputo viejo (todas las secciones con
  `esComputos2: false`, y su `computo-section.tsx`), así que hoy es el único cómputo y en la
  portada se llama "Cómputo". Su pantalla está en `computo-section-2.tsx`. Las secciones
  nuevas se tienen que crear con `esComputos2: true` (el tablero ya lo pasa).
- **Sub ítems** (`ComputoSubItem`, `ComputoSubItemMedicion`): por ahora solo existen en la
  sección PUERTAS (ver `esSeccionPuertas`). Ahí el ítem no tiene cantidad propia y su total
  es la suma de sus sub ítems, que tienen nombre libre. Reemplazan a las columnas fijas
  `cajonC10/C15/C18` de `ComputoMedicion`, que los ítems nuevos ya no usan.

## Relación con otros módulos

- Comparte `Rubro` y los niveles del proyecto (`src/lib/niveles.ts`) con el resto del sistema.
- Está **separado de Flujo de fondos**: ya no clasifica por `Subrubro`. Las columnas
  `subrubroId` de `ComputoItem` y `ComputoItemTipo` están dormidas; no escribirlas.
- No comparte código con `src/lib/presupuesto.ts`: el "presupuestar" de acá es el pedido
  de cotización a proveedores, no el presupuesto proyectado de Flujo de fondos.
