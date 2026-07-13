import * as z from "zod";

const AcopioBaseSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  proveedorId: z.string().min(1, "Elegí un proveedor"),
  notas: z.string().trim().optional(),
});

export const AcopioMaterialSchema = AcopioBaseSchema.extend({
  tipo: z.literal("MATERIAL"),
  materialId: z.string().min(1, "Elegí un material"),
  cantidadTotal: z.number({ error: "Ingresá una cantidad" }).positive("La cantidad debe ser mayor a 0"),
});

export const AcopioMontoSchema = AcopioBaseSchema.extend({
  tipo: z.literal("MONTO"),
  montoTotal: z.number({ error: "Ingresá un monto" }).positive("El monto debe ser mayor a 0"),
  precios: z
    .array(
      z.object({
        materialId: z.string().min(1, "Elegí un material"),
        precioUnitario: z
          .number({ error: "Ingresá un precio" })
          .positive("El precio debe ser mayor a 0"),
      })
    )
    .min(1, "Agregá al menos un material con precio"),
});

export const AcopioSchema = z.discriminatedUnion("tipo", [AcopioMaterialSchema, AcopioMontoSchema]);

export type AcopioInput = z.infer<typeof AcopioSchema>;
