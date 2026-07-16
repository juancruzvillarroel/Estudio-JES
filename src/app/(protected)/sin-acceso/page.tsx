import { LogOut } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

// Página de destino cuando un usuario autenticado no tiene ningún permiso
// de sección habilitado (ni siquiera "Inicio"). No usa requireSeccion para
// no volver a redirigir: solo exige que haya una sesión válida, evitando así
// el bucle de redirecciones que se daba antes al mandarlo siempre a
// /dashboard aunque tampoco tuviera acceso ahí.
export default async function SinAccesoPage() {
  await verifySession();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sin acceso todavía</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Tu usuario todavía no tiene ninguna sección habilitada. Pedile a un
        administrador que te dé acceso desde Usuarios.
      </p>
      <form action={logout} className="mt-6">
        <Button type="submit" variant="outline">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
