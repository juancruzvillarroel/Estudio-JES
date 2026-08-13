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

export type UsuarioRow = {
  id: string;
  nombre: string;
  usuario: string;
  email: string | null;
  esAdmin: boolean;
  paginasPermitidas: string[];
};

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const esUltimoAdmin = u.esAdmin && cantidadAdmins <= 1;
            return (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.nombre}
                  {u.id === usuarioActualId && (
                    <span className="ml-1 text-xs text-muted-foreground">(vos)</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{u.usuario}</TableCell>
                <TableCell>
                  {u.email ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={u.esAdmin ? "secondary" : "outline"}>
                    {u.esAdmin ? "Admin" : "Usuario"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
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
