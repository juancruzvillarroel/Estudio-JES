import * as z from "zod";
import { PAGINA_KEYS } from "@/lib/paginas";
import { normalizarUsuario } from "@/lib/usuarios";

const PaginasPermitidasSchema = z
  .array(z.string())
  .transform((valores) => valores.filter((v) => (PAGINA_KEYS as string[]).includes(v)));

/**
 * Con lo que se inicia sesión. Se restringe a letras, números, punto, guión y
 * guión bajo: sin espacios ni acentos, que son la fuente de errores al tipear.
 * Se guarda normalizado (minúsculas) para que no haya dos que solo difieran en
 * mayúsculas.
 */
const UsuarioLoginSchema = z
  .string()
  .trim()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "El usuario solo puede tener letras, números, punto, guión y guión bajo"
  )
  .transform(normalizarUsuario);

/**
 * El email dejó de ser obligatorio: es un dato de contacto y hay gente del
 * estudio que no tiene. Vacío se guarda como null (y no como cadena vacía) para
 * que el índice único deje tener varios sin email.
 */
const EmailOpcionalSchema = z
  .union([z.string().trim().email("Email inválido"), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

export const UsuarioCreateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  usuario: UsuarioLoginSchema,
  email: EmailOpcionalSchema,
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  esAdmin: z.boolean(),
  paginasPermitidas: PaginasPermitidasSchema,
});

export const UsuarioUpdateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  usuario: UsuarioLoginSchema,
  email: EmailOpcionalSchema,
  password: z
    .union([z.string().min(6, "La contraseña debe tener al menos 6 caracteres"), z.literal("")])
    .optional(),
  esAdmin: z.boolean(),
  paginasPermitidas: PaginasPermitidasSchema,
});

export type UsuarioCreateInput = z.infer<typeof UsuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof UsuarioUpdateSchema>;
