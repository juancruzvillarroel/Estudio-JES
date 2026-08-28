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
  // El tilde cambia de lista, no agrega: o se ven las pendientes o se ven las
  // completadas. Mezcladas, lo que falta hacer se perdía entre lo ya hecho, que
  // es lo que se acumula con el tiempo.
  const visibles = ordenarTareas(
    items.filter((t) => (verCompletadas ? t.estado === "COMPLETADA" : t.estado === "PENDIENTE"))
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Sin `flex-wrap` en móvil: si envuelve, las acciones bajan de renglón y
          el botón de nueva tarea deja de estar arriba a la derecha, que es
          justo donde se lo busca. El título cede el ancho (`min-w-0`) y las
          acciones no (`shrink-0`). */}
      <div className="flex items-start justify-between gap-3 sm:flex-wrap sm:items-center">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Tareas de la obra</h3>
          <p className="text-xs text-muted-foreground">
            {pendientes === 0
              ? "No quedan tareas pendientes."
              : `${pendientes} ${pendientes === 1 ? "tarea pendiente" : "tareas pendientes"}.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* El `|| verCompletadas` es la salida de emergencia: si estando en la
              vista de completadas se destildan todas, el contador queda en cero
              y sin esto el tilde desaparecía dejando al usuario mirando una
              lista vacía y sin forma de volver a las pendientes. */}
          {(completadas > 0 || verCompletadas) && (
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
              <Button
                type="button"
                size="sm"
                aria-label="Nueva tarea"
                // Mismo criterio que en la pantalla de todas las tareas: en
                // móvil es un círculo con un más, en escritorio queda igual que
                // antes. Ver el comentario en tareas-global.tsx.
                className="max-sm:size-10 max-sm:rounded-full max-sm:p-0"
              >
                <Plus className="size-3.5 max-sm:size-5" />
                <span className="max-sm:sr-only">Nueva tarea</span>
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
          items.length === 0
            ? "Todavía no hay tareas cargadas para esta obra."
            : verCompletadas
              ? "Todavía no hay tareas completadas en esta obra."
              : "No quedan tareas pendientes en esta obra."
        }
      />
    </div>
  );
}
