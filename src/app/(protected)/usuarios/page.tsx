import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { UsuarioDialog } from "@/components/usuarios/usuario-dialog";
import { UsuariosLista } from "@/components/usuarios/usuarios-lista";

export default async function UsuariosPage() {
  const session = await verifySession();

  if (!session.esAdmin) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No tenés permisos para ver esta sección.
      </div>
    );
  }

  const usuarios = await prisma.user.findMany({ orderBy: { nombre: "asc" } });
  const cantidadAdmins = usuarios.filter((u) => u.esAdmin).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Altas, edición y bajas de los usuarios que pueden acceder al sistema.
          </p>
        </div>
        <UsuarioDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          }
        />
      </div>

      <div className="mt-6">
        <UsuariosLista
          usuarios={usuarios}
          usuarioActualId={session.userId}
          cantidadAdmins={cantidadAdmins}
        />
      </div>
    </div>
  );
}
