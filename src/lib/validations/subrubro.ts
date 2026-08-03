import * as z from "zod";

export const SubrubroSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type SubrubroInput = z.infer<typeof SubrubroSchema>;
