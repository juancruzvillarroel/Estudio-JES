"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UnidadProyectoDialog } from "@/components/flujo-fondos/unidad-proyecto-dialog";
import type { UnidadProyectoOpcion } from "@/lib/flujo-fondos";

const ESTADO_LABELS: Record<UnidadProyectoOpcion["estado"], string> = {
  DISPONIBLE: "Disponible",
  RESERVADA: "Reservada",
  VENDIDA: "Vendida",
};

const ESTADO_BADGE_VARIANT: Record<UnidadProyectoOpcion["estado"], "success" | "warning" | "secondary"> = {
  DISPONIBLE: "success",
  RESERVADA: "warning",
  VENDIDA: "secondary",
};

export function UnidadesProyectoPanel({
  proyectoId,
  unidades,
}: {
  proyectoId: string;
  unidades: UnidadProyectoOpcion[];
}) {
  const [items, setItems] = useState(unidades);
  const [prevUnidades, setPrevUnidades] = useState(unidades);

  if (unidades !== prevUnidades) {
    setPrevUnidades(unidades);
    setItems(unidades);
  }

  const handleSaved = (item: UnidadProyectoOpcion) => {
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
          <h3 className="text-sm font-semibold">Unidades del proyecto</h3>
          <p className="text-xs text-muted-foreground">
            Cargá las unidades de esta obra (departamentos, cocheras, locales) para más adelante
            vincularlas con las ventas.
          </p>
        </div>
        <UnidadProyectoDialog
          proyectoId={proyectoId}
          onSaved={handleSaved}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nueva unidad
            </Button>
          }
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay unidades cargadas en este proyecto.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.nombre}</span>
              {it.tipo && (
                <span className="shrink-0 text-xs text-muted-foreground">{it.tipo}</span>
              )}
              {it.m2 != null && (
                <span className="shrink-0 text-xs text-muted-foreground">{it.m2} m²</span>
              )}
              <Badge variant={ESTADO_BADGE_VARIANT[it.estado]}>{ESTADO_LABELS[it.estado]}</Badge>
              <UnidadProyectoDialog
                proyectoId={proyectoId}
                item={it}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar unidad">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
