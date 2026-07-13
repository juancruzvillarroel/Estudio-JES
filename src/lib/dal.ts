import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/session";

export const verifySession = cache(async () => {
  const session = await getSessionFromCookie();

  if (!session?.userId) {
    redirect("/login");
  }

  return { userId: session.userId, nombre: session.nombre, esAdmin: session.esAdmin };
});
