import * as z from "zod";
import { PAGINA_KEYS } from "@/lib/paginas";

const PaginasPermitidasSchema = z
  .array(z.string())
  .transform((valores) => valores.filter((v) => (PAGINA_KEYS as string[]).includes(v)));

export const UsuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().min(1, "El email es obligatorio").email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  esAdmin: z.boolean(),
  paginasPermitidas: PaginasPermitidasSchema,
});

export const UsuarioUpdateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().min(1, "El email es obligatorio").email("Email inválido"),
  password: z
    .union([z.string().min(6, "La contraseña debe tener al menos 6 caracteres"), z.literal("")])
    .optional(),
  esAdmin: z.boolean(),
  paginasPermitidas: PaginasPermitidasSchema,
});

export type UsuarioCreateInput = z.infer<typeof UsuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof UsuarioUpdateSchema>;
