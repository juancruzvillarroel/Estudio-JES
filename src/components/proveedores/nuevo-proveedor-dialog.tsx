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
import { createProveedorRapido } from "@/actions/proveedores";

export function NuevoProveedorDialog({
  rubroId,
  trigger,
  onCreated,
}: {
  rubroId: string;
  trigger: React.ReactNode;
  onCreated: (proveedor: { id: string; nombre: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createProveedorRapido({ nombre, rubroId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated(result.proveedor);
      setOpen(false);
      setNombre("");
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(undefined);
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombreProveedorRapido">Nombre</Label>
            <Input
              id="nombreProveedorRapido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se va a crear asociado al rubro elegido. Después podés completar contacto, teléfono y
            demás datos desde la pantalla de Proveedores.
          </p>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Guardando..." : "Guardar proveedor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
