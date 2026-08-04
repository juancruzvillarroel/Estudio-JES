import * as z from "zod";

const MovimientoFondoBaseSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  fecha: z.string().min(1, "Ingresá una fecha"),
  descripcion: z.string().trim().default(""),
  monto: z.number({ error: "Ingresá un monto" }).positive("El monto debe ser mayor a 0"),
  moneda: z.enum(["ARS", "USD"]),
  tipoCambio: z
    .number()
    .positive("El tipo de cambio debe ser mayor a 0")
    .optional(),
  notas: z.string().trim().optional(),
  medioPagoId: z.string().optional(),
});

export const MovimientoGastoSchema = MovimientoFondoBaseSchema.extend({
  tipo: z.literal("GASTO"),
  rubroId: z.string().min(1, "Elegí un rubro"),
  subrubroId: z.string().optional(),
  proveedorId: z.string().optional(),
});

export const MovimientoAporteSchema = MovimientoFondoBaseSchema.extend({
  tipo: z.literal("APORTE"),
  proyectoInversorId: z.string().min(1, "Elegí un inversor"),
});

export const MovimientoFondoSchema = z.discriminatedUnion("tipo", [
  MovimientoGastoSchema,
  MovimientoAporteSchema,
]);

export type MovimientoFondoInput = z.infer<typeof MovimientoFondoSchema>;
