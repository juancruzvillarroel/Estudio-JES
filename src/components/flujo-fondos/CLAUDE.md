# Módulo Flujo de fondos

La plata de cada obra: gastos, aportes de inversores, facturas de proveedores, presupuesto
proyectado, ventas de unidades y honorarios del estudio. Se ve dentro de cada proyecto y
requiere el permiso `flujo-fondos`: es información financiera sensible y un usuario puede
tener acceso al proyecto sin tenerlo a esto.

## Archivos

- `src/lib/flujo-fondos.ts` — tipos y `map*` de movimientos, inversores, medios de pago y unidades.
- `src/lib/presupuesto.ts` — presupuesto proyectado (montos mensuales derivados de total + tramo + curva).
- `src/lib/honorarios.ts` — calculadora de honorarios (función pura). El comentario del
  principio explica las tres reglas de negocio: leerlo antes de tocar algo.
- `src/lib/facturas.ts` — facturas de proveedores, pagos y saldos.
- `src/lib/ventas.ts` — ventas de unidades y cuotas.
- Server Actions en `src/actions/`: `movimientos-fondo`, `facturas`, `presupuesto`,
  `proyecto-inversores`, `medios-pago`, `unidades-proyecto`, `ventas`, `cotizaciones` (dólar blue).
- Pantalla: `flujo-fondos-section.tsx` es el contenedor con pestañas (Resumen, Gastos,
  Facturas, Aportes, Rubros, Presupuesto, Cronograma, Ventas, Datos del proyecto). Las
  ventas viven en `src/components/ventas/`.
- Modelos: `MovimientoFondo`, `Factura`, `PresupuestoItem`, `ProyectoInversor`, `MedioPago`,
  `UnidadProyecto`, `Venta`, `VentaCuota`.

## Reglas de negocio

- **Movimientos**: `GASTO` (con rubro, subrubro y proveedor), `APORTE` (con inversor) o
  `CAMBIO` (cambio de moneda de la caja, sin inversor).
- **Cambios de moneda**: una sola fila con lo que sale (`moneda`, `monto`) y el `tipoCambio`
  obligatorio; lo que entra en la otra caja se calcula en `src/lib/cambios-moneda.ts`. Mueven
  el saldo de cada bloque por moneda del Resumen, pero no lo aportado por inversor ni el
  consolidado en dólares. Se cargan con el botón "Cambio de moneda" de la solapa Aportes
  y se listan entre los aportes, pero no suman a sus totales.
- **Monedas**: ARS y USD. Los totales consolidados se expresan en dólares: un movimiento en
  pesos se convierte con su `tipoCambio`, y si no lo tiene queda afuera del consolidado.
  `cotizaciones.ts` sugiere el dólar blue del día para completarlo.
- **Facturado**: un gasto cuenta como facturado (con IVA) si se pagó con un medio de pago
  marcado con `incluyeIva`.
- **Adjuntos**: `archivoUrl` es el comprobante de pago y `facturaUrl` el respaldo fiscal. Van
  separados a propósito.
- **Facturas**: el pago no es un modelo aparte. Es un `MovimientoFondo` con `facturaId`, y una
  factura puede pagarse en varias partes. Para el saldo solo cuentan los pagos en la misma
  moneda de la factura.
- **Presupuesto**: siempre en USD. Cada línea es rubro o subrubro con monto, mes de inicio,
  duración y curva (`UNIFORME`, `CRECIENTE`, `DECRECIENTE`, `CAMPANA`). Si un rubro tiene
  subrubros presupuestados, la línea del rubro entero se ignora. El guardado es un upsert a
  mano porque `subrubroId` puede ser null (ver `guardarPresupuestoItem`).
- **Honorarios**:
  - El período arranca en el último honorario cargado, separado por moneda.
  - La base es nominal por moneda, sin conversión.
  - Solo suman los rubros con `Rubro.pagaHonorarios`.
  - El rubro de honorarios se marca con `Rubro.esHonorarios` y debería haber uno solo.

## Relación con otros módulos

- Comparte `Rubro`, `Subrubro` y `Proveedor` con Cómputo, Pedidos y Tareas: cambios ahí
  afectan a todos.
- Las facturas pueden respaldar pedidos (`Factura.pedidos`); el panel del lado de pedidos es
  `src/components/pedidos/pedido-factura-panel.tsx`.
- La tarjeta de la portada del proyecto se arma en `src/app/(protected)/proyectos/[id]/page.tsx`
  (ver `sumarUSD` ahí).
