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

/**
 * Cambio de moneda (ver src/lib/cambios-moneda.ts): `moneda` y `monto` son lo
 * que sale. El tipo de cambio es obligatorio porque sin él no se sabe cuánto
 * entra en la otra caja.
 */
export const MovimientoCambioSchema = MovimientoFondoBaseSchema.extend({
  tipo: z.literal("CAMBIO"),
  tipoCambio: z
    .number({ error: "Ingresá el tipo de cambio" })
    .positive("El tipo de cambio debe ser mayor a 0"),
});

export const MovimientoFondoSchema = z.discriminatedUnion("tipo", [
  MovimientoGastoSchema,
  MovimientoAporteSchema,
  MovimientoCambioSchema,
]);

export type MovimientoFondoInput = z.infer<typeof MovimientoFondoSchema>;
