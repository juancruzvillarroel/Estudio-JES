"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createProyecto, updateProyecto } from "@/actions/proyectos";

type Proyecto = {
  id: string;
  nombre: string;
  barrio: string | null;
  direccion: string | null;
  estado: "ACTIVO" | "PAUSADO" | "FINALIZADO";
  descripcion: string | null;
  imagenUrl: string | null;
  cantidadPisos: number;
};

const ESTADO_LABELS: Record<Proyecto["estado"], string> = {
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  FINALIZADO: "Finalizado",
};

export function ProyectoDialog({
  proyecto,
  trigger,
}: {
  proyecto?: Proyecto;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = proyecto ? updateProyecto.bind(null, proyecto.id) : createProyecto;
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
          <DialogTitle>{proyecto ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" defaultValue={proyecto?.nombre} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="barrio">Barrio</Label>
            <Input id="barrio" name="barrio" defaultValue={proyecto?.barrio ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" name="direccion" defaultValue={proyecto?.direccion ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Select name="estado" defaultValue={proyecto?.estado ?? "ACTIVO"} items={ESTADO_LABELS}>
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="cantidadPisos">Cantidad de pisos (además de planta baja)</Label>
            <Input
              id="cantidadPisos"
              name="cantidadPisos"
              type="number"
              min={0}
              step={1}
              defaultValue={proyecto?.cantidadPisos ?? 0}
            />
            <p className="text-xs text-muted-foreground">
              Se usa para generar automáticamente los planos por piso en Documentación
              (Planta baja, Piso 1, Piso 2, ..., Azotea).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" name="descripcion" defaultValue={proyecto?.descripcion ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="imagen">Imagen</Label>
            {proyecto?.imagenUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proyecto.imagenUrl}
                alt={proyecto.nombre}
                className="h-32 w-full rounded-md object-cover"
              />
            )}
            <Input id="imagen" name="imagen" type="file" accept="image/*" />
            {proyecto?.imagenUrl && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox name="quitarImagen" value="on" />
                Quitar imagen actual
              </label>
            )}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
