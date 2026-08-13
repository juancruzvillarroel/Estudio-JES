"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MedioPagoDialog } from "@/components/flujo-fondos/medio-pago-dialog";
import type { MedioPagoOpcion } from "@/lib/flujo-fondos";

export function MediosPagoPanel({
  proyectoId,
  medios,
  onChange,
}: {
  proyectoId: string;
  medios: MedioPagoOpcion[];
  onChange?: (items: MedioPagoOpcion[]) => void;
}) {
  const [items, setItems] = useState(medios);
  const [prevMedios, setPrevMedios] = useState(medios);

  if (medios !== prevMedios) {
    setPrevMedios(medios);
    setItems(medios);
  }

  const actualizar = (next: MedioPagoOpcion[]) => {
    setItems(next);
    onChange?.(next);
  };

  const handleSaved = (item: MedioPagoOpcion) => {
    actualizar(
      items.some((it) => it.id === item.id)
        ? items.map((it) => (it.id === item.id ? item : it))
        : [...items, item]
    );
  };

  const handleDeleted = (id: string) => {
    actualizar(items.filter((it) => it.id !== id));
  };

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Medios de pago</h3>
          <p className="text-xs text-muted-foreground">
            Cargá los medios de pago que usás en esta obra, para clasificar gastos y aportes.
          </p>
        </div>
        <MedioPagoDialog
          proyectoId={proyectoId}
          onSaved={handleSaved}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nuevo medio de pago
            </Button>
          }
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay medios de pago cargados en este proyecto.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.nombre}</span>
              {it.incluyeIva && <Badge variant="secondary">Facturado</Badge>}
              <MedioPagoDialog
                proyectoId={proyectoId}
                item={it}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar medio de pago">
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
