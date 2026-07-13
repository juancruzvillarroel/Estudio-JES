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
import { createProveedorRapido } from "@/actions/proveedores";

const VALORES_INICIALES = {
  nombre: "",
  contacto: "",
  telefono: "",
  email: "",
  cuit: "",
  notas: "",
};

export function NuevoProveedorDialog({
  rubroId,
  trigger,
  onCreated,
}: {
  rubroId: string;
  trigger: React.ReactNode;
  onCreated: (proveedor: { id: string; nombre: string; codigo: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const handleChange = (campo: keyof typeof VALORES_INICIALES) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValores((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createProveedorRapido({
        nombre: valores.nombre,
        contacto: valores.contacto || undefined,
        telefono: valores.telefono || undefined,
        email: valores.email || undefined,
        cuit: valores.cuit || undefined,
        notas: valores.notas || undefined,
        rubroId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated(result.proveedor);
      setOpen(false);
      setValores(VALORES_INICIALES);
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
              value={valores.nombre}
              onChange={handleChange("nombre")}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactoProveedorRapido">Contacto</Label>
              <Input
                id="contactoProveedorRapido"
                value={valores.contacto}
                onChange={handleChange("contacto")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefonoProveedorRapido">Teléfono</Label>
              <Input
                id="telefonoProveedorRapido"
                value={valores.telefono}
                onChange={handleChange("telefono")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="emailProveedorRapido">Email</Label>
              <Input
                id="emailProveedorRapido"
                type="email"
                value={valores.email}
                onChange={handleChange("email")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuitProveedorRapido">CUIT</Label>
              <Input
                id="cuitProveedorRapido"
                value={valores.cuit}
                onChange={handleChange("cuit")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notasProveedorRapido">Notas</Label>
            <Textarea
              id="notasProveedorRapido"
              value={valores.notas}
              onChange={handleChange("notas")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se va a crear asociado al rubro elegido en el formulario.
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
