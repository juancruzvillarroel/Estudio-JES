"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UsuarioDialog } from "@/components/usuarios/usuario-dialog";
import { cn } from "@/lib/utils";

export type UsuarioRow = {
  id: string;
  nombre: string;
  email: string;
  esAdmin: boolean;
  paginasPermitidas: string[];
};

const COL_ROL = "w-28";
const COL_ACCIONES = "w-20";

export function UsuariosLista({
  usuarios,
  usuarioActualId,
  cantidadAdmins,
}: {
  usuarios: UsuarioRow[];
  usuarioActualId: string;
  cantidadAdmins: number;
}) {
  if (usuarios.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Todavía no hay usuarios cargados.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className={COL_ROL}>Rol</TableHead>
            <TableHead className={cn(COL_ACCIONES, "text-right")}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const esUltimoAdmin = u.esAdmin && cantidadAdmins <= 1;
            return (
              <TableRow key={u.id}>
                <TableCell className="truncate font-medium">
                  {u.nombre}
                  {u.id === usuarioActualId && (
                    <span className="ml-1 text-xs text-muted-foreground">(vos)</span>
                  )}
                </TableCell>
                <TableCell className="truncate">{u.email}</TableCell>
                <TableCell className={COL_ROL}>
                  <Badge variant={u.esAdmin ? "secondary" : "outline"}>
                    {u.esAdmin ? "Admin" : "Usuario"}
                  </Badge>
                </TableCell>
                <TableCell className={cn(COL_ACCIONES, "text-right")}>
                  <UsuarioDialog
                    usuario={u}
                    puedeEliminar={u.id !== usuarioActualId && !esUltimoAdmin}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
