"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, FileDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { abrirInformeTarea } from "@/components/tareas/informe-tarea";
import { cambiarEstadoItemTarea, cambiarEstadoTarea } from "@/actions/tareas";
import { cn, formatFecha } from "@/lib/utils";
import {
  avanceItems,
  PRIORIDAD_BADGE,
  PRIORIDAD_LABELS,
  type OpcionSimple,
  type TareaItemOpcion,
  type TareaOpcion,
} from "@/lib/tareas";

/**
 * Un renglón tildable del checklist. Se usa igual para los sub ítems sueltos y
 * para los que están dentro de una sección: lo único que cambia es dónde se
 * dibuja.
 */
function ItemCheck({
  item,
  disabled,
  onToggle,
}: {
  item: TareaItemOpcion;
  disabled: boolean;
  onToggle: (itemId: string, completado: boolean) => void;
}) {
  return (
    <li>
      <label className="flex cursor-default items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-accent hover:text-accent-foreground">
        <Checkbox
          checked={item.completado}
          disabled={disabled}
          onCheckedChange={(checked) => onToggle(item.id, checked === true)}
          className="mt-0.5"
        />
        <span className={cn("min-w-0", item.completado && "text-muted-foreground line-through")}>
          {item.texto}
        </span>
      </label>
    </li>
  );
}

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
        // Una sección todavía sin sub ítems no suma al avance, pero igual hay
        // algo que desplegar: si no, el usuario la carga y parece que se perdió.
        const tieneChecklist = avance !== null || tarea.secciones.length > 0;
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
              {/* Encabezado: a la izquierda de qué obra es y de qué se trata,
                  a la derecha el estado (prioridad y avance del checklist).
                  La obra va más grande y en negrita porque es lo que se busca
                  primero cuando están todas las obras mezcladas; el título de
                  la tarea la acompaña en letra más fina. */}
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  {mostrarObra && (
                    <span
                      className={cn(
                        "text-base font-semibold",
                        completada && "text-muted-foreground line-through"
                      )}
                    >
                      {tarea.proyectoNombre}
                    </span>
                  )}
                  <span
                    className={cn(
                      "min-w-0",
                      // En la pestaña de una obra no se repite el nombre, así
                      // que el título pasa a ser el que manda.
                      mostrarObra ? "text-sm font-normal text-muted-foreground" : "font-medium",
                      completada && "text-muted-foreground line-through"
                    )}
                  >
                    {tarea.titulo}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!completada && (
                    <Badge variant={PRIORIDAD_BADGE[tarea.prioridad]}>
                      {PRIORIDAD_LABELS[tarea.prioridad]}
                    </Badge>
                  )}
                  {tieneChecklist && (
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
                        {avance ? `${avance.hechos}/${avance.total}` : "Ver checklist"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {tarea.descripcion && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {tarea.descripcion}
                </p>
              )}

              {/* Primero los sueltos y después cada sección con su título, en
                  el mismo orden en que se cargaron en el formulario. */}
              {tieneChecklist && abierta && (
                <div className="mt-1 flex flex-col gap-2 border-l pl-3">
                  {tarea.items.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {tarea.items.map((sub) => (
                        <ItemCheck
                          key={sub.id}
                          item={sub}
                          disabled={pending}
                          onToggle={handleToggleItem}
                        />
                      ))}
                    </ul>
                  )}
                  {tarea.secciones.map((seccion) => (
                    <div key={seccion.id} className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2 px-1">
                        <span className="text-xs font-semibold tracking-wide uppercase">
                          {seccion.titulo}
                        </span>
                        {seccion.items.length > 0 && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {seccion.items.filter((i) => i.completado).length}/
                            {seccion.items.length}
                          </span>
                        )}
                      </div>
                      <ul className="flex flex-col gap-1">
                        {seccion.items.map((sub) => (
                          <ItemCheck
                            key={sub.id}
                            item={sub}
                            disabled={pending}
                            onToggle={handleToggleItem}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* La obra ya va en el encabezado, acá no se repite. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

            <div className="flex shrink-0 items-center">
              {/* Abre el informe imprimible en una pestaña aparte; de ahí se
                  guarda como PDF para mandárselo a quien tiene que hacerla. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Descargar informe de la tarea"
                title="Descargar informe"
                onClick={() => abrirInformeTarea(tarea)}
              >
                <FileDown className="h-3.5 w-3.5" />
              </Button>
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
          </div>
        );
      })}
    </div>
  );
}
