import * as z from "zod";

export const ESTADOS_PROYECTO = ["ACTIVO", "PAUSADO", "FINALIZADO"] as const;

export const ProyectoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  direccion: z.string().trim().optional(),
  estado: z.enum(ESTADOS_PROYECTO).default("ACTIVO"),
  descripcion: z.string().trim().optional(),
});

export type ProyectoInput = z.infer<typeof ProyectoSchema>;
