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
  createProyectoInversor,
  deleteProyectoInversor,
  updateProyectoInversor,
} from "@/actions/proyecto-inversores";
import type { ProyectoInversorOpcion } from "@/lib/flujo-fondos";

export function ProyectoInversorDialog({
  proyectoId,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  item?: ProyectoInversorOpcion;
  trigger: React.ReactNode;
  onSaved: (item: ProyectoInversorOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(item?.inversorNombre ?? "");
  const [porcentaje, setPorcentaje] = useState(item ? String(item.porcentaje) : "");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setNombre(item?.inversorNombre ?? "");
      setPorcentaje(item ? String(item.porcentaje) : "");
      setError(undefined);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    const porcentajeNum = Number(porcentaje);
    if (!porcentajeNum || porcentajeNum <= 0) {
      setError("Ingresá un porcentaje mayor a 0.");
      return;
    }
    if (!nombre.trim()) {
      setError("Ingresá el nombre del inversor.");
      return;
    }

    startTransition(async () => {
      const result = item
        ? await updateProyectoInversor(item.id, { nombre: nombre.trim(), porcentaje: porcentajeNum })
        : await createProyectoInversor({ proyectoId, nombre: nombre.trim(), porcentaje: porcentajeNum });

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.item);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar inversor" : "Nuevo inversor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre del inversor</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="porcentaje">Porcentaje de participación (%)</Label>
            <Input
              id="porcentaje"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteProyectoInversor(item.id)}
                confirmMessage={`¿Quitar a "${item.inversorNombre}" de este proyecto? Esta acción no se puede deshacer.`}
                onDeleted={() => {
                  setOpen(false);
                  onDeleted?.(item.id);
                }}
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
