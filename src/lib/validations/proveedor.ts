import * as z from "zod";

export const ProveedorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  contacto: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  email: z.string().trim().optional(),
  cuit: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export type ProveedorInput = z.infer<typeof ProveedorSchema>;
