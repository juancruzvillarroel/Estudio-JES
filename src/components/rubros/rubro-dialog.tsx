"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { createRubro, deleteRubro, updateRubro } from "@/actions/rubros";

type Rubro = { id: string; nombre: string; codigoPrefijo?: string | null };

export function RubroDialog({
  rubro,
  trigger,
}: {
  rubro?: Rubro;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = rubro ? updateRubro.bind(null, rubro.id) : createRubro;
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

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
          <DialogTitle>{rubro ? "Editar rubro" : "Nuevo rubro"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={rubro?.nombre} required />
          </div>
          {rubro && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="codigoPrefijo">Prefijo de código</Label>
              <Input
                id="codigoPrefijo"
                name="codigoPrefijo"
                defaultValue={rubro.codigoPrefijo ?? ""}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se usa para armar el código de los materiales de este rubro (ej. 05-01).
              </p>
            </div>
          )}
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {rubro ? (
              <DeleteButton
                action={() => deleteRubro(rubro.id)}
                confirmMessage={`¿Eliminar el rubro "${rubro.nombre}"? Esta acción no se puede deshacer.`}
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
