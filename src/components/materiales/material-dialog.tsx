"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RubroDialog } from "@/components/rubros/rubro-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { createMaterial, deleteMaterial, updateMaterial } from "@/actions/materiales";

type Material = {
  id: string;
  nombre: string;
  unidad: string;
  rubroId: string | null;
  pesoPorBarra?: number | null;
};

export function MaterialDialog({
  material,
  rubros,
  trigger,
  onCreated,
}: {
  material?: Material;
  rubros: { id: string; nombre: string }[];
  trigger: React.ReactNode;
  onCreated?: (material: {
    id: string;
    nombre: string;
    unidad: string;
    pesoPorBarra: number | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const action = material ? updateMaterial.bind(null, material.id) : createMaterial;
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
        if (!material && result?.material) {
          onCreated?.(result.material);
        }
      }
    });
  };

  const rubroItems = { ninguno: "Sin rubro", ...Object.fromEntries(rubros.map((r) => [r.id, r.nombre])) };

  const unidadItems = {
    unidad: "Unidad",
    bolsa: "Bolsa",
    bolson: "Bolsón",
    cajon: "Cajón",
    caja: "Caja",
    paquete: "Paquete",
    rollo: "Rollo",
    kg: "Kg",
    m: "Metro (m)",
    m2: "Metro cuadrado (m2)",
    m3: "Metro cúbico (m3)",
    litro: "Litro",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material ? "Editar material" : "Nuevo material"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={material?.nombre} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="unidad">Unidad</Label>
            <Select name="unidad" defaultValue={material?.unidad ?? "unidad"} items={unidadItems}>
              <SelectTrigger id="unidad" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(unidadItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pesoPorBarra">Peso por barra (opcional)</Label>
            <Input
              id="pesoPorBarra"
              name="pesoPorBarra"
              type="number"
              step="0.001"
              min="0"
              defaultValue={material?.pesoPorBarra ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Si este material se pide por peso (ej. kg) pero se entrega contado en barras,
              cargá acá cuánto pesa cada barra para convertir automáticamente al registrar la
              entrega.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="rubroId">Rubro</Label>
              <RubroDialog
                trigger={
                  <Button type="button" variant="link" size="sm" className="h-auto p-0">
                    + Nuevo rubro
                  </Button>
                }
              />
            </div>
            <Select name="rubroId" defaultValue={material?.rubroId ?? "ninguno"} items={rubroItems}>
              <SelectTrigger id="rubroId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin rubro</SelectItem>
                {rubros.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {material ? (
              <DeleteButton
                action={() => deleteMaterial(material.id)}
                confirmMessage={`¿Eliminar el material "${material.nombre}"? Esta acción no se puede deshacer.`}
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
