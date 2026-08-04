import * as z from "zod";

export const UnidadProyectoSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  nombre: z.string().min(1, "Ingresá el nombre de la unidad"),
  tipo: z.string().trim().optional(),
  m2: z.number().positive("Los m² deben ser mayor a 0").optional(),
  estado: z.enum(["DISPONIBLE", "RESERVADA", "VENDIDA"]),
});

export type UnidadProyectoInput = z.infer<typeof UnidadProyectoSchema>;

export const UnidadProyectoUpdateSchema = UnidadProyectoSchema.pick({
  nombre: true,
  tipo: true,
  m2: true,
  estado: true,
});

export type UnidadProyectoUpdateInput = z.infer<typeof UnidadProyectoUpdateSchema>;
