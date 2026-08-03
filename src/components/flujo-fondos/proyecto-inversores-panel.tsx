"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProyectoInversorDialog } from "@/components/flujo-fondos/proyecto-inversor-dialog";
import { cn } from "@/lib/utils";
import type { ProyectoInversorOpcion } from "@/lib/flujo-fondos";

export function ProyectoInversoresPanel({
  proyectoId,
  asignaciones,
}: {
  proyectoId: string;
  asignaciones: ProyectoInversorOpcion[];
}) {
  const [items, setItems] = useState(asignaciones);
  const [prevAsignaciones, setPrevAsignaciones] = useState(asignaciones);

  if (asignaciones !== prevAsignaciones) {
    setPrevAsignaciones(asignaciones);
    setItems(asignaciones);
  }

  const totalPorcentaje = items.reduce((acc, it) => acc + it.porcentaje, 0);

  const handleSaved = (item: ProyectoInversorOpcion) => {
    setItems((prev) => {
      const existe = prev.some((it) => it.id === item.id);
      return existe ? prev.map((it) => (it.id === item.id ? item : it)) : [...prev, item];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Inversores del proyecto</h3>
          <p className="text-xs text-muted-foreground">
            Cargá los inversores de esta obra y el porcentaje de participación de cada uno.
          </p>
        </div>
        <ProyectoInversorDialog
          proyectoId={proyectoId}
          onSaved={handleSaved}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nuevo inversor
            </Button>
          }
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay inversores cargados en este proyecto.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.inversorNombre}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{it.porcentaje}%</span>
              <ProyectoInversorDialog
                proyectoId={proyectoId}
                item={it}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar inversor">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          ))}
          <p
            className={cn(
              "mt-1 text-xs",
              totalPorcentaje === 100 ? "text-muted-foreground" : "text-error"
            )}
          >
            Total asignado: {totalPorcentaje}%{totalPorcentaje !== 100 && " (debería sumar 100%)"}
          </p>
        </div>
      )}
    </div>
  );
}
