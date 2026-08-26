import * as z from "zod";

export const RubroSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  codigoPrefijo: z
    .string()
    .trim()
    .min(2, "El prefijo debe tener al menos 2 caracteres")
    .max(6, "El prefijo debe tener como máximo 6 caracteres")
    .regex(/^[A-Za-z0-9]+$/, "El prefijo solo puede tener letras y números")
    .transform((v) => v.toUpperCase())
    .optional(),
  // Honorarios del estudio (ver src/lib/honorarios.ts). Llegan de un
  // checkbox, así que el valor ausente en el FormData significa "destildado".
  pagaHonorarios: z.boolean().default(true),
  esHonorarios: z.boolean().default(false),
});

export type RubroInput = z.infer<typeof RubroSchema>;
