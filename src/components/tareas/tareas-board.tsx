"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { TareasLista } from "@/components/tareas/tareas-lista";
import { ordenarTareas, type OpcionSimple, type TareaOpcion } from "@/lib/tareas";

/** Pestaña "Tareas" de un proyecto: pendientes de esa obra. */
export function TareasBoard({
  proyectoId,
  tareas,
  rubros,
  usuarios,
}: {
  proyectoId: string;
  tareas: TareaOpcion[];
  rubros: OpcionSimple[];
  usuarios: OpcionSimple[];
}) {
  const [items, setItems] = useState(tareas);
  const [prevTareas, setPrevTareas] = useState(tareas);
  if (tareas !== prevTareas) {
    setPrevTareas(tareas);
    setItems(tareas);
  }

  const [verCompletadas, setVerCompletadas] = useState(false);

  const handleSaved = (tarea: TareaOpcion) => {
    setItems((prev) => {
      const existe = prev.some((t) => t.id === tarea.id);
      return existe ? prev.map((t) => (t.id === tarea.id ? tarea : t)) : [...prev, tarea];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  const pendientes = items.filter((t) => t.estado === "PENDIENTE").length;
  const completadas = items.length - pendientes;
  const visibles = ordenarTareas(
    verCompletadas ? items : items.filter((t) => t.estado === "PENDIENTE")
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Tareas de la obra</h3>
          <p className="text-xs text-muted-foreground">
            {pendientes === 0
              ? "No quedan tareas pendientes."
              : `${pendientes} ${pendientes === 1 ? "tarea pendiente" : "tareas pendientes"}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {completadas > 0 && (
            <label className="flex cursor-default items-center gap-2">
              <Checkbox
                id="verCompletadas"
                checked={verCompletadas}
                onCheckedChange={(checked) => setVerCompletadas(checked === true)}
              />
              <Label htmlFor="verCompletadas" className="cursor-pointer text-xs font-normal">
                Ver completadas ({completadas})
              </Label>
            </label>
          )}
          <TareaDialog
            proyectoId={proyectoId}
            rubros={rubros}
            usuarios={usuarios}
            onSaved={handleSaved}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Nueva tarea
              </Button>
            }
          />
        </div>
      </div>

      <TareasLista
        tareas={visibles}
        rubros={rubros}
        usuarios={usuarios}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        vacio={
          pendientes === 0 && completadas > 0
            ? "No quedan tareas pendientes en esta obra."
            : "Todavía no hay tareas cargadas para esta obra."
        }
      />
    </div>
  );
}
