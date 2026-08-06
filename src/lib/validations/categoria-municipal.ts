import * as z from "zod";

export const CategoriaMunicipalSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type CategoriaMunicipalInput = z.infer<typeof CategoriaMunicipalSchema>;
