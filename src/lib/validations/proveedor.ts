import * as z from "zod";

export const ProveedorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  contacto: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  email: z.string().trim().optional(),
  cuit: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  codigo: z
    .string()
    .trim()
    .min(1, "El código no puede estar vacío")
    .transform((v) => v.toUpperCase())
    .optional(),
});

export type ProveedorInput = z.infer<typeof ProveedorSchema>;
