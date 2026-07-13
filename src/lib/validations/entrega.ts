import * as z from "zod";

export const EntregaItemSchema = z.object({
  pedidoItemId: z.string().min(1),
  cantidad: z.number({ error: "Ingresá una cantidad" }).nonnegative(),
});

export const EntregaSchema = z.object({
  pedidoId: z.string().min(1),
  fecha: z.date().optional(),
  numeroRemito: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  sumarAInventario: z.boolean().optional(),
  items: z
    .array(EntregaItemSchema)
    .min(1)
    .refine((items) => items.some((i) => i.cantidad > 0), {
      error: "Cargá al menos una cantidad entregada",
    }),
});

export type EntregaInput = z.infer<typeof EntregaSchema>;
