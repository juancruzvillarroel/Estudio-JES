import * as z from "zod";

export const MaterialSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .transform((v) => v.toUpperCase()),
  unidad: z.string().trim().min(1, "La unidad es obligatoria"),
});

export type MaterialInput = z.infer<typeof MaterialSchema>;
