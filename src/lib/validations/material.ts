import * as z from "zod";

export const MaterialSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .transform((v) => v.toUpperCase()),
  unidad: z.string().trim().min(1, "La unidad es obligatoria"),
  pesoPorBarra: z
    .number({ error: "Ingresá un peso válido" })
    .positive("El peso debe ser mayor a 0")
    .optional(),
  codigo: z
    .string()
    .trim()
    .min(1, "El código no puede estar vacío")
    .transform((v) => v.toUpperCase())
    .optional(),
});

export type MaterialInput = z.infer<typeof MaterialSchema>;
