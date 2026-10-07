"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { TareasLista } from "@/components/tareas/tareas-lista";
import { EstadoTareasTabs } from "@/components/tareas/estado-tareas-tabs";
import {
  ordenarTareas,
  tareasDeVista,
  type OpcionSimple,
  type TareaOpcion,
  type VistaTarea,
} from "@/lib/tareas";

/**
 * Qué decir cuando la solapa elegida no tiene nada. Es distinto de "no hay
 * tareas": acá sí las hay, pero están todas en otra solapa, y el mensaje tiene
 * que dejar claro cuál se está mirando.
 */
const VACIO_POR_VISTA: Record<VistaTarea, string> = {
  PENDIENTE: "No quedan tareas pendientes en esta obra.",
  A_CORREGIR: "No hay nada esperando una corrección en esta obra.",
  EN_REVISION: "No hay nada esperando revisión en esta obra.",
  COMPLETADA: "Todavía no hay tareas completadas en esta obra.",
};

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

  const [vista, setVista] = useState<VistaTarea>("PENDIENTE");

  const handleSaved = (tarea: TareaOpcion) => {
    setItems((prev) => {
      const existe = prev.some((t) => t.id === tarea.id);
      return existe ? prev.map((t) => (t.id === tarea.id ? tarea : t)) : [...prev, tarea];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  // Cada solapa muestra una sola vista, nunca mezcladas: lo que falta hacer se
  // perdía entre lo ya hecho, que es lo que se acumula con el tiempo.
  const conteos: Record<VistaTarea, number> = {
    PENDIENTE: tareasDeVista(items, "PENDIENTE").length,
    A_CORREGIR: tareasDeVista(items, "A_CORREGIR").length,
    EN_REVISION: tareasDeVista(items, "EN_REVISION").length,
    COMPLETADA: tareasDeVista(items, "COMPLETADA").length,
  };
  const visibles = ordenarTareas(tareasDeVista(items, vista));

  // El renglón de abajo del título. Nombra lo que sigue abierto, y lo que está
  // en revisión o a corregir cuenta como abierto: decir "no quedan tareas
  // pendientes" con cinco esperando el visto bueno o una corrección haría
  // pensar que la obra está al día.
  const abiertas = [
    conteos.PENDIENTE > 0
      ? `${conteos.PENDIENTE} ${conteos.PENDIENTE === 1 ? "pendiente" : "pendientes"}`
      : null,
    conteos.A_CORREGIR > 0 ? `${conteos.A_CORREGIR} a corregir` : null,
    conteos.EN_REVISION > 0 ? `${conteos.EN_REVISION} en revisión` : null,
  ].filter(Boolean);

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
            {abiertas.length === 0
              ? "No queda nada abierto."
              : `${abiertas.join(" · ")}.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
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

      <EstadoTareasTabs value={vista} onChange={setVista} conteos={conteos}>
        <TareasLista
          tareas={visibles}
          rubros={rubros}
          usuarios={usuarios}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          vacio={
            items.length === 0
              ? "Todavía no hay tareas cargadas para esta obra."
              : VACIO_POR_VISTA[vista]
          }
        />
      </EstadoTareasTabs>
    </div>
  );
}
