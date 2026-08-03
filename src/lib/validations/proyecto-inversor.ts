import * as z from "zod";

export const ProyectoInversorSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  nombre: z.string().min(1, "Ingresá el nombre del inversor"),
  porcentaje: z
    .number({ error: "Ingresá un porcentaje" })
    .positive("El porcentaje debe ser mayor a 0")
    .max(100, "El porcentaje no puede superar 100"),
});

export type ProyectoInversorInput = z.infer<typeof ProyectoInversorSchema>;

export const ProyectoInversorUpdateSchema = ProyectoInversorSchema.pick({
  nombre: true,
  porcentaje: true,
});

export type ProyectoInversorUpdateInput = z.infer<typeof ProyectoInversorUpdateSchema>;
