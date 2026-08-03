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
import { createSubrubro, deleteSubrubro, updateSubrubro } from "@/actions/subrubros";

type Subrubro = { id: string; nombre: string };

export function SubrubroDialog({
  rubroId,
  subrubro,
  trigger,
}: {
  rubroId: string;
  subrubro?: Subrubro;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = subrubro ? updateSubrubro.bind(null, subrubro.id) : createSubrubro.bind(null, rubroId);
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
          <DialogTitle>{subrubro ? "Editar subrubro" : "Nuevo subrubro"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={subrubro?.nombre} required />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {subrubro ? (
              <DeleteButton
                action={() => deleteSubrubro(subrubro.id)}
                confirmMessage={`¿Eliminar el subrubro "${subrubro.nombre}"? Esta acción no se puede deshacer.`}
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
