/**
 * Reglas del nombre de usuario, o sea con lo que se inicia sesión.
 *
 * Se guarda siempre normalizado y el login normaliza lo que se tipea antes de
 * buscar, así "Jorge.Garcia " y "jorge.garcia" entran al mismo lado. El email
 * quedó como dato de contacto opcional.
 */

/** Minúsculas y sin espacios de sobra. Es lo que se guarda en la base. */
export function normalizarUsuario(valor: string) {
  return valor.trim().toLowerCase();
}

/**
 * Sugerencia de nombre de usuario a partir del nombre real:
 * "Jorge García" → "jorge.garcia". Sin acentos, que al tipearlos se erran.
 */
export function sugerirUsuario(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}
