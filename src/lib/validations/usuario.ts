import * as z from "zod";

export const UsuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().min(1, "El email es obligatorio").email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  esAdmin: z.boolean(),
});

export const UsuarioUpdateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().min(1, "El email es obligatorio").email("Email inválido"),
  password: z
    .union([z.string().min(6, "La contraseña debe tener al menos 6 caracteres"), z.literal("")])
    .optional(),
  esAdmin: z.boolean(),
});

export type UsuarioCreateInput = z.infer<typeof UsuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof UsuarioUpdateSchema>;
