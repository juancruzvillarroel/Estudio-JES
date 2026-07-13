"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { createProveedor, deleteProveedor, updateProveedor } from "@/actions/proveedores";

type Proveedor = {
  id: string;
  nombre: string;
  codigo?: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  cuit: string | null;
  notas: string | null;
  rubros?: { id: string }[];
};

export function ProveedorDialog({
  proveedor,
  rubros,
  trigger,
}: {
  proveedor?: Proveedor;
  rubros: { id: string; nombre: string }[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = proveedor ? updateProveedor.bind(null, proveedor.id) : createProveedor;
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
          <DialogTitle>{proveedor ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={proveedor?.nombre} required />
          </div>
          {proveedor && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" name="codigo" defaultValue={proveedor.codigo ?? ""} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contacto">Contacto</Label>
              <Input id="contacto" name="contacto" defaultValue={proveedor?.contacto ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" defaultValue={proveedor?.telefono ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={proveedor?.email ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cuit">CUIT</Label>
              <Input id="cuit" name="cuit" defaultValue={proveedor?.cuit ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" name="notas" defaultValue={proveedor?.notas ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rubros</Label>
            {rubros.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay rubros cargados. Podés crear uno desde la pestaña Rubros.
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-2">
                {rubros.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="rubroIds"
                      value={r.id}
                      defaultChecked={proveedor?.rubros?.some((pr) => pr.id === r.id)}
                    />
                    {r.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {proveedor ? (
              <DeleteButton
                action={() => deleteProveedor(proveedor.id)}
                confirmMessage={`¿Eliminar el proveedor "${proveedor.nombre}"? Esta acción no se puede deshacer.`}
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
