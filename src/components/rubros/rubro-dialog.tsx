"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type Rubro = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
  pagaHonorarios?: boolean;
  esHonorarios?: boolean;
};

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
  // Los dos tildes de honorarios se manejan en estado y no con defaultChecked
  // porque están atados entre sí: el rubro donde se cobran los honorarios no
  // puede pagarse honorarios a sí mismo.
  const [pagaHonorarios, setPagaHonorarios] = useState(rubro?.pagaHonorarios ?? true);
  const [esHonorarios, setEsHonorarios] = useState(rubro?.esHonorarios ?? false);

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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setPagaHonorarios(rubro?.pagaHonorarios ?? true);
      setEsHonorarios(rubro?.esHonorarios ?? false);
      setError(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">Honorarios del estudio</p>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="pagaHonorarios"
                name="pagaHonorarios"
                checked={pagaHonorarios}
                // El rubro donde se cobran los honorarios no entra en su propia
                // base: si entrara, cada cobro agrandaría el del mes siguiente.
                disabled={esHonorarios}
                onCheckedChange={(checked) => setPagaHonorarios(checked === true)}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="pagaHonorarios" className="cursor-pointer">
                  Los gastos de este rubro pagan honorarios
                </Label>
                <p className="text-xs text-muted-foreground">
                  Destildalo para dejarlo afuera de la base, como la compra del terreno.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="esHonorarios"
                name="esHonorarios"
                checked={esHonorarios}
                onCheckedChange={(checked) => {
                  const marcado = checked === true;
                  setEsHonorarios(marcado);
                  if (marcado) setPagaHonorarios(false);
                }}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="esHonorarios" className="cursor-pointer">
                  Es el rubro donde se cobran los honorarios
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hay uno solo: al marcarlo acá se desmarca el que estuviera antes. Es el que
                  usa la calculadora del resumen para saber dónde termina un período y empieza
                  el otro.
                </p>
              </div>
            </div>
          </div>

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
