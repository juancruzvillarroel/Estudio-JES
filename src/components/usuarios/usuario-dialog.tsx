"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { createUsuario, deleteUsuario, updateUsuario } from "@/actions/usuarios";
import { PAGINAS } from "@/lib/paginas";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  esAdmin: boolean;
  paginasPermitidas?: string[];
};

export function UsuarioDialog({
  usuario,
  puedeEliminar = true,
  trigger,
}: {
  usuario?: Usuario;
  puedeEliminar?: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = usuario ? updateUsuario.bind(null, usuario.id) : createUsuario;
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [esAdmin, setEsAdmin] = useState(usuario?.esAdmin ?? false);

  const formAction = (formData: FormData) => {
    setError(undefined);
    startTransition(async () => {
      const result = await action(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{usuario ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={usuario?.nombre} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={usuario?.email} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{usuario ? "Nueva contraseña" : "Contraseña"}</Label>
            <PasswordInput
              id="password"
              name="password"
              placeholder={usuario ? "Dejar en blanco para no cambiarla" : undefined}
              required={!usuario}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              name="esAdmin"
              checked={esAdmin}
              onCheckedChange={(checked) => setEsAdmin(checked === true)}
            />
            Administrador (puede crear, editar y eliminar usuarios)
          </label>
          <div className="flex flex-col gap-2">
            <Label>Páginas habilitadas</Label>
            {esAdmin ? (
              <p className="text-sm text-muted-foreground">
                Los administradores tienen acceso a todas las secciones.
              </p>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border p-2">
                {PAGINAS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="paginasPermitidas"
                      value={p.key}
                      defaultChecked={usuario?.paginasPermitidas?.includes(p.key)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {usuario && puedeEliminar ? (
              <DeleteButton
                action={() => deleteUsuario(usuario.id)}
                confirmMessage={`¿Eliminar el usuario "${usuario.nombre}"? Esta acción no se puede deshacer.`}
                onDeleted={() => setOpen(false)}
              />
            ) : (
              <div />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
