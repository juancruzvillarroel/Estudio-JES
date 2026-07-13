import * as z from "zod";

export const PedidoItemSchema = z.object({
  materialId: z.string().min(1, "Elegí un material"),
  cantidad: z.number({ error: "Ingresá una cantidad" }).positive("La cantidad debe ser mayor a 0"),
});

export const PedidoSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  proveedorId: z.string().min(1, "Elegí un proveedor"),
  acopioId: z.string().trim().optional(),
  fecha: z.date().optional(),
  notas: z.string().trim().optional(),
  items: z.array(PedidoItemSchema).min(1, "Agregá al menos un material"),
});

export type PedidoInput = z.infer<typeof PedidoSchema>;
export type PedidoItemInput = z.infer<typeof PedidoItemSchema>;

export const EditarPedidoItemSchema = z.object({
  id: z.string().optional(),
  materialId: z.string().min(1, "Elegí un material"),
  cantidad: z.number({ error: "Ingresá una cantidad" }).positive("La cantidad debe ser mayor a 0"),
});

export const EditarPedidoSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  proveedorId: z.string().min(1, "Elegí un proveedor"),
  acopioId: z.string().trim().optional(),
  fecha: z.date().optional(),
  notas: z.string().trim().optional(),
  items: z.array(EditarPedidoItemSchema).min(1, "Agregá al menos un material"),
});

export type EditarPedidoInput = z.infer<typeof EditarPedidoSchema>;
export type EditarPedidoItemInput = z.infer<typeof EditarPedidoItemSchema>;
