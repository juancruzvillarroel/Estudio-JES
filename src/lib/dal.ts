import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/session";
import type { PaginaKey } from "@/lib/paginas";

export const verifySession = cache(async () => {
  const session = await getSessionFromCookie();

  if (!session?.userId) {
    redirect("/login");
  }

  return {
    userId: session.userId,
    nombre: session.nombre,
    esAdmin: session.esAdmin,
    paginasPermitidas: session.paginasPermitidas ?? [],
  };
});

/**
 * Verifica que el usuario autenticado tenga acceso a la sección indicada.
 * Los administradores siempre tienen acceso a todo. Si el usuario no tiene
 * permiso, redirige a /dashboard (o a /sin-acceso si tampoco tiene permiso
 * para /dashboard, para no generar un bucle de redirecciones infinito).
 */
export async function requireSeccion(pagina: PaginaKey) {
  const session = await verifySession();
  if (!session.esAdmin && !session.paginasPermitidas.includes(pagina)) {
    redirect(session.paginasPermitidas.includes("dashboard") ? "/dashboard" : "/sin-acceso");
  }
  return session;
}
