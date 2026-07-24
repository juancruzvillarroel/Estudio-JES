import * as z from "zod";

export const ESTADOS_PROYECTO = ["ACTIVO", "PAUSADO", "FINALIZADO"] as const;

export const ProyectoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  barrio: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  estado: z.enum(ESTADOS_PROYECTO).default("ACTIVO"),
  descripcion: z.string().trim().optional(),
  // Pisos por encima de planta baja (ver DocumentoCategoria.porPiso).
  cantidadPisos: z.coerce.number().int().min(0).default(0),
});

export type ProyectoInput = z.infer<typeof ProyectoSchema>;
