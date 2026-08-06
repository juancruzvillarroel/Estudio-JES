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
  createEtapaMunicipal,
  deleteEtapaMunicipal,
  updateEtapaMunicipal,
} from "@/actions/etapas-municipales";

type Etapa = { id: string; nombre: string };

export function EtapaMunicipalDialog({
  proyectoId,
  categoriaId,
  etapa,
  trigger,
}: {
  proyectoId: string;
  categoriaId: string;
  etapa?: Etapa;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = etapa
    ? updateEtapaMunicipal.bind(null, etapa.id, proyectoId)
    : createEtapaMunicipal.bind(null, categoriaId, proyectoId);
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
          <DialogTitle>{etapa ? "Editar etapa" : "Nueva etapa"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={etapa?.nombre} required />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {etapa ? (
              <DeleteButton
                action={() => deleteEtapaMunicipal(etapa.id, proyectoId)}
                confirmMessage={`¿Eliminar la etapa "${etapa.nombre}"? Esta acción no se puede deshacer.`}
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
