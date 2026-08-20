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
  colorPersona,
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
              {/* De qué se trata, en tres renglones de menor a mayor detalle:
                  la tarea, la obra y el rubro. El título va arriba y con más
                  peso porque es lo que distingue una fila de otra; la obra y el
                  rubro lo ubican y por eso quedan en letra chica. */}
              <div className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "text-base font-semibold",
                    completada && "text-muted-foreground line-through"
                  )}
                >
                  {tarea.titulo}
                </span>
                {/* La obra y, al lado, la prioridad. En la pestaña de una obra
                    el nombre no se repite y el badge queda solo en este
                    renglón, que es donde se lo busca en las dos vistas.

                    La obra va en negrita para poder barrer la lista buscando
                    una, pero en gris y más chica que el título, así no le
                    compite. */}
                <div className="flex flex-wrap items-center gap-2">
                  {mostrarObra && (
                    <span
                      className={cn(
                        "text-sm font-semibold text-muted-foreground",
                        completada && "line-through"
                      )}
                    >
                      {tarea.proyectoNombre}
                    </span>
                  )}
                  {/* La prioridad solo aplica a lo que falta hacer: en una
                      tarea ya completada no dice nada y se esconde. */}
                  {!completada && (
                    <Badge variant={PRIORIDAD_BADGE[tarea.prioridad]}>
                      {PRIORIDAD_LABELS[tarea.prioridad]}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {tarea.rubroNombre ?? "Sin rubro"}
                </span>
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

              {/* La obra, el rubro y la prioridad van arriba y los asignados a
                  la derecha: acá queda solo lo que ubica a la tarea en el
                  tiempo. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {/* La fecha de creación es la que manda el orden de la lista,
                    así que conviene tenerla a la vista para entender por qué
                    cada tarea está donde está. */}
                <span>Creada el {formatFecha(tarea.createdAt)}</span>
                {completada && tarea.completadaEl && (
                  <span className="text-success">
                    Completada el {formatFecha(tarea.completadaEl)}
                  </span>
                )}
              </div>
            </div>

            {/* Columna derecha: arriba el avance del checklist y las dos
                acciones, abajo quién la tiene que hacer. Todo lo que describe a
                la tarea (título, obra, rubro, fechas, prioridad) queda del lado
                izquierdo; acá va lo que se hace con ella y de quién es. */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2">
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

              {/* Quién la tiene que hacer, debajo de las acciones. Va acá y no
                  con el resto de los datos para que "de quién es cada tarea" se
                  lea bajando siempre por la misma columna. El ancho está
                  limitado para que varios nombres largos bajen de renglón en
                  vez de comerse el título. */}
              <div className="flex max-w-48 flex-wrap justify-end gap-1">
                {tarea.asignados.length > 0 ? (
                  tarea.asignados.map((a) => (
                    <Badge key={a.id} className={colorPersona(a.id)}>
                      {a.nombre}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Sin asignar</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
