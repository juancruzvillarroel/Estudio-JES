/**
 * Catálogo de secciones del sistema que se pueden habilitar/deshabilitar
 * por usuario. Cada clave corresponde a un ítem de navegación (ver
 * src/components/layout/nav-items.ts) y se usa tanto para filtrar el menú
 * como para bloquear el acceso directo por URL en cada página.
 *
 * "Usuarios" queda fuera de esta lista a propósito: solo los administradores
 * pueden verla, y eso ya está resuelto con el flag `esAdmin`.
 */
export const PAGINAS = [
  { key: "dashboard", label: "Inicio" },
  { key: "proyectos", label: "Proyectos" },
  { key: "pedidos", label: "Pedidos y entregas" },
  { key: "proveedores", label: "Proveedores y materiales" },
  { key: "inventario", label: "Inventario" },
] as const;

export type PaginaKey = (typeof PAGINAS)[number]["key"];

export const PAGINA_KEYS = PAGINAS.map((p) => p.key) as PaginaKey[];

export function esPaginaKey(valor: string): valor is PaginaKey {
  return (PAGINA_KEYS as string[]).includes(valor);
}
