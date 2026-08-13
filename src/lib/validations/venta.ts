import * as z from "zod";

// Un pago planeado de la venta (anticipo o cuota). `id` solo viene presente
// al editar una venta existente: si falta, es una fila nueva; las filas que
// ya existían en la DB pero no vienen en el array se eliminan (ver
// actualizarVenta en src/actions/ventas.ts).
const VentaCuotaItemSchema = z.object({
  id: z.string().optional(),
  numero: z.number().int().nonnegative(),
  esAnticipo: z.boolean().default(false),
  fecha: z.string().min(1, "Ingresá una fecha"),
  monto: z.number({ error: "Ingresá un monto" }).positive("El monto debe ser mayor a 0"),
});

export const VentaSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  unidadId: z.string().min(1, "Elegí una unidad"),
  compradorNombre: z.string().trim().min(1, "Ingresá el nombre del comprador"),
  fecha: z.string().min(1, "Ingresá una fecha"),
  moneda: z.enum(["ARS", "USD"]),
  precioTotal: z.number({ error: "Ingresá el precio total" }).positive("El precio debe ser mayor a 0"),
  modalidad: z.enum(["CONTADO", "FINANCIADO"]),
  medioPagoId: z.string().optional(),
  notas: z.string().trim().optional(),
  cuotas: z.array(VentaCuotaItemSchema).min(1, "Agregá al menos un pago"),
});

export type VentaInput = z.infer<typeof VentaSchema>;

// En edición no se permite cambiar la unidad (ni el proyecto): si se cargó
// mal, conviene borrar la venta y cargarla de nuevo para esa unidad.
export const VentaUpdateSchema = VentaSchema.omit({ proyectoId: true, unidadId: true });

export type VentaUpdateInput = z.infer<typeof VentaUpdateSchema>;

// Para marcar/desmarcar el cobro de un pago puntual (no pasa por el form
// completo de la venta).
export const VentaCuotaCobroSchema = z.object({
  cobrada: z.boolean(),
  fechaCobro: z.string().optional(),
});

export type VentaCuotaCobroInput = z.infer<typeof VentaCuotaCobroSchema>;
