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
import { NivelesPanel } from "@/components/proyectos/niveles-panel";
import { createProyecto, updateProyecto } from "@/actions/proyectos";
import type { NivelOpcion } from "@/lib/niveles";

type Proyecto = {
  id: string;
  nombre: string;
  barrio: string | null;
  direccion: string | null;
  estado: "ACTIVO" | "PAUSADO" | "FINALIZADO";
  descripcion: string | null;
  imagenUrl: string | null;
  brochureUrl: string | null;
  brochureNombre: string | null;
};

const ESTADO_LABELS: Record<Proyecto["estado"], string> = {
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  FINALIZADO: "Finalizado",
};

export function ProyectoDialog({
  proyecto,
  niveles = [],
  trigger,
}: {
  proyecto?: Proyecto;
  /** Los niveles de la obra, de abajo hacia arriba. Vacío al crear una nueva. */
  niveles?: NivelOpcion[];
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
      {/* Con los niveles adentro el formulario pasa el alto de la pantalla, así
          que scrollea en vez de desbordarse, igual que los demás diálogos
          largos (venta, factura, tarea). */}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
          {/*
            Los niveles sólo aparecen al editar: se guardan de a uno, contra el
            servidor, y un proyecto que todavía no existe no tiene dónde
            colgarlos. Se cargan apenas se crea la obra.
          */}
          {proyecto && <NivelesPanel proyectoId={proyecto.id} niveles={niveles} />}
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="brochure">Brochure</Label>
            {proyecto?.brochureUrl && (
              <a
                href={proyecto.brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm underline"
              >
                {proyecto.brochureNombre ?? "Ver brochure actual"}
              </a>
            )}
            <Input
              id="brochure"
              name="brochure"
              type="file"
              accept="application/pdf,image/*"
            />
            <p className="text-xs text-muted-foreground">
              El folleto de venta de la obra. Se abre desde el botón &quot;Ver brochure&quot;
              de la portada del proyecto. Subir uno nuevo reemplaza al anterior.
            </p>
            {proyecto?.brochureUrl && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox name="quitarBrochure" value="on" />
                Quitar brochure actual
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
