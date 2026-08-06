import * as z from "zod";

export const EtapaMunicipalSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type EtapaMunicipalInput = z.infer<typeof EtapaMunicipalSchema>;
