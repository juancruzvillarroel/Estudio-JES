"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updatePedido } from "@/actions/pedidos";

function toDateInputValue(fechaISO: string) {
  return fechaISO.slice(0, 10);
}

export function EditarPedidoDialog({
  pedidoId,
  fechaISO,
  notas,
  trigger,
}: {
  pedidoId: string;
  fechaISO: string;
  notas: string | null;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const formAction = (formData: FormData) => {
    setError(undefined);
    const fechaRaw = formData.get("fecha");
    const notasRaw = formData.get("notas");
    startTransition(async () => {
      const result = await updatePedido(pedidoId, {
        fecha: fechaRaw ? new Date(String(fechaRaw)) : undefined,
        notas: notasRaw ? String(notasRaw) : undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pedido</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              defaultValue={toDateInputValue(fechaISO)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" name="notas" defaultValue={notas ?? ""} />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
