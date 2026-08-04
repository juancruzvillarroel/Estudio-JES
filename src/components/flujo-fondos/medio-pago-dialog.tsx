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
import { createMedioPago, deleteMedioPago, updateMedioPago } from "@/actions/medios-pago";
import type { MedioPagoOpcion } from "@/lib/flujo-fondos";

export function MedioPagoDialog({
  proyectoId,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  item?: MedioPagoOpcion;
  trigger: React.ReactNode;
  onSaved: (item: MedioPagoOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setNombre(item?.nombre ?? "");
      setError(undefined);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!nombre.trim()) {
      setError("Ingresá el nombre del medio de pago.");
      return;
    }

    startTransition(async () => {
      const result = item
        ? await updateMedioPago(item.id, { nombre: nombre.trim() })
        : await createMedioPago({ proyectoId, nombre: nombre.trim() });

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
          <DialogTitle>{item ? "Editar medio de pago" : "Nuevo medio de pago"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Transferencia"
              required
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteMedioPago(item.id)}
                confirmMessage={`¿Quitar "${item.nombre}" de este proyecto? Esta acción no se puede deshacer.`}
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
