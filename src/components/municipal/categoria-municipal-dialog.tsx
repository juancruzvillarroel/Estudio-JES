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
import {
  createCategoriaMunicipal,
  deleteCategoriaMunicipal,
  updateCategoriaMunicipal,
} from "@/actions/categorias-municipales";

type Categoria = { id: string; nombre: string };

export function CategoriaMunicipalDialog({
  proyectoId,
  categoria,
  trigger,
}: {
  proyectoId: string;
  categoria?: Categoria;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = categoria
    ? updateCategoriaMunicipal.bind(null, categoria.id, proyectoId)
    : createCategoriaMunicipal.bind(null, proyectoId);
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
          <DialogTitle>{categoria ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={categoria?.nombre} required />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {categoria ? (
              <DeleteButton
                action={() => deleteCategoriaMunicipal(categoria.id, proyectoId)}
                confirmMessage={`¿Eliminar la categoría "${categoria.nombre}"? Esta acción no se puede deshacer.`}
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
