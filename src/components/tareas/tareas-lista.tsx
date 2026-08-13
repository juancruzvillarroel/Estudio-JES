"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { cambiarEstadoItemTarea, cambiarEstadoTarea } from "@/actions/tareas";
import { cn, formatFecha } from "@/lib/utils";
import {
  avanceItems,
  PRIORIDAD_BADGE,
  PRIORIDAD_LABELS,
  type OpcionSimple,
  type TareaOpcion,
} from "@/lib/tareas";

/**
 * Lista de tareas compartida por la pestaña de un proyecto y la vista global
 * de todas las obras. No maneja estado propio: quien la usa es el dueño de la
 * lista y recibe los cambios por `onSaved` / `onDeleted`.
 */
export function TareasLista({
  tareas,
  rubros,
  usuarios,
  mostrarObra = false,
  onSaved,
  onDeleted,
  vacio,
}: {
  tareas: TareaOpcion[];
  rubros: OpcionSimple[];
  usuarios: OpcionSimple[];
  /** Muestra el nombre de la obra en cada fila (vista global). */
  mostrarObra?: boolean;
  onSaved: (tarea: TareaOpcion) => void;
  onDeleted: (id: string) => void;
  vacio: string;
}) {
  const [pending, startTransition] = useTransition();
  // Qué checklists están abiertos. Arranca todo cerrado para que la lista se
  // lea de un vistazo; el avance ya se ve en el "3/5" del encabezado.
  const [abiertas, setAbiertas] = useState<string[]>([]);

  const toggleAbierta = (id: string) =>
    setAbiertas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleToggle = (tarea: TareaOpcion, completada: boolean) => {
    startTransition(async () => {
      const result = await cambiarEstadoTarea(tarea.id, completada);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
    });
  };

  const handleToggleItem = (itemId: string, completado: boolean) => {
    startTransition(async () => {
      const result = await cambiarEstadoItemTarea(itemId, completado);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
    });
  };

  if (tareas.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {vacio}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tareas.map((tarea) => {
        const completada = tarea.estado === "COMPLETADA";
        const avance = avanceItems(tarea);
        const abierta = abiertas.includes(tarea.id);

        return (
          <div
            key={tarea.id}
            className="flex items-start gap-3 rounded-md border bg-background px-3 py-2.5"
          >
            <Checkbox
              checked={completada}
              disabled={pending}
              onCheckedChange={(checked) => handleToggle(tarea, checked === true)}
              aria-label={completada ? "Marcar como pendiente" : "Marcar como completada"}
              className="mt-0.5"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    completada
                      ? "font-medium text-muted-foreground line-through"
                      : "font-medium"
                  }
                >
                  {tarea.titulo}
                </span>
                {!completada && (
                  <Badge variant={PRIORIDAD_BADGE[tarea.prioridad]}>
                    {PRIORIDAD_LABELS[tarea.prioridad]}
                  </Badge>
                )}
                {avance && (
                  <button
                    type="button"
                    onClick={() => toggleAbierta(tarea.id)}
                    aria-expanded={abierta}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", abierta && "rotate-90")}
                    />
                    <span className="tabular-nums">
                      {avance.hechos}/{avance.total}
                    </span>
                  </button>
                )}
              </div>

              {tarea.descripcion && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {tarea.descripcion}
                </p>
              )}

              {avance && abierta && (
                <ul className="mt-1 flex flex-col gap-1 border-l pl-3">
                  {tarea.items.map((sub) => (
                    <li key={sub.id}>
                      <label className="flex cursor-default items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-accent hover:text-accent-foreground">
                        <Checkbox
                          checked={sub.completado}
                          disabled={pending}
                          onCheckedChange={(checked) => handleToggleItem(sub.id, checked === true)}
                          className="mt-0.5"
                        />
                        <span
                          className={cn(
                            "min-w-0",
                            sub.completado && "text-muted-foreground line-through"
                          )}
                        >
                          {sub.texto}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {mostrarObra && <span className="font-medium">{tarea.proyectoNombre}</span>}
                <span>{tarea.rubroNombre ?? "Sin rubro"}</span>
                {tarea.asignados.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {tarea.asignados.map((a) => (
                      <Badge key={a.id} variant="secondary">
                        {a.nombre}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span>Sin asignar</span>
                )}
                {completada && tarea.completadaEl && (
                  <span className="text-success">
                    Completada el {formatFecha(tarea.completadaEl)}
                  </span>
                )}
              </div>
            </div>

            <TareaDialog
              rubros={rubros}
              usuarios={usuarios}
              item={tarea}
              onSaved={onSaved}
              onDeleted={onDeleted}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar tarea">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              }
            />
          </div>
        );
      })}
    </div>
  );
}
