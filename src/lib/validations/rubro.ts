import * as z from "zod";

export const RubroSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type RubroInput = z.infer<typeof RubroSchema>;
