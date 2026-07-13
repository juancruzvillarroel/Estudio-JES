import * as z from "zod";

export const MovimientoInventarioSchema = z.object({
  materialId: z.string().min(1, "Elegí un material"),
  tipo: z.enum(["ENTRADA", "SALIDA"]),
  cantidad: z.number({ error: "Ingresá una cantidad" }).positive("La cantidad debe ser mayor a 0"),
  notas: z.string().trim().optional(),
});

export type MovimientoInventarioInput = z.infer<typeof MovimientoInventarioSchema>;
