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
import { DeleteButton } from "@/components/ui/delete-button";
import {
  createUnidadProyecto,
  deleteUnidadProyecto,
  updateUnidadProyecto,
} from "@/actions/unidades-proyecto";
import type { UnidadProyectoOpcion } from "@/lib/flujo-fondos";

const ESTADO_LABELS: Record<UnidadProyectoOpcion["estado"], string> = {
  DISPONIBLE: "Disponible",
  RESERVADA: "Reservada",
  VENDIDA: "Vendida",
};

export function UnidadProyectoDialog({
  proyectoId,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  item?: UnidadProyectoOpcion;
  trigger: React.ReactNode;
  onSaved: (item: UnidadProyectoOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [tipo, setTipo] = useState(item?.tipo ?? "");
  const [m2, setM2] = useState(item?.m2 != null ? String(item.m2) : "");
  const [estado, setEstado] = useState<UnidadProyectoOpcion["estado"]>(item?.estado ?? "DISPONIBLE");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setNombre(item?.nombre ?? "");
      setTipo(item?.tipo ?? "");
      setM2(item?.m2 != null ? String(item.m2) : "");
      setEstado(item?.estado ?? "DISPONIBLE");
      setError(undefined);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!nombre.trim()) {
      setError("Ingresá el nombre de la unidad.");
      return;
    }
    const m2Num = m2.trim() ? Number(m2) : undefined;
    if (m2.trim() && (!m2Num || m2Num <= 0)) {
      setError("Ingresá un valor de m² mayor a 0.");
      return;
    }

    startTransition(async () => {
      const datos = {
        nombre: nombre.trim(),
        tipo: tipo.trim() || undefined,
        m2: m2Num,
        estado,
      };
      const result = item
        ? await updateUnidadProyecto(item.id, datos)
        : await createUnidadProyecto({ proyectoId, ...datos });

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
          <DialogTitle>{item ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Depto 1A"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo (opcional)</Label>
            <Input
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Ej: Departamento, Cochera, Local"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m2">m² (opcional)</Label>
            <Input
              id="m2"
              type="number"
              step="0.01"
              min="0"
              value={m2}
              onChange={(e) => setM2(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Select
              name="estado"
              value={estado}
              onValueChange={(value) => setEstado(value as UnidadProyectoOpcion["estado"])}
              items={ESTADO_LABELS}
            >
              <SelectTrigger id="estado" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => deleteUnidadProyecto(item.id)}
                confirmMessage={`¿Eliminar la unidad "${item.nombre}"? Esta acción no se puede deshacer.`}
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
