"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FiltroMultiple } from "@/components/ui/filtro-multiple";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { TareasLista } from "@/components/tareas/tareas-lista";
import { ordenarTareas, type OpcionSimple, type TareaOpcion } from "@/lib/tareas";

/**
 * Valores sentinela para poder tildar "las que no tienen rubro" y "las que no
 * están asignadas a nadie" dentro de los mismos filtros.
 */
const SIN_RUBRO = "__sin_rubro__";
const SIN_ASIGNAR = "__sin_asignar__";

export function TareasGlobal({
  tareas,
  proyectos,
  rubros,
  usuarios,
}: {
  tareas: TareaOpcion[];
  proyectos: OpcionSimple[];
  rubros: OpcionSimple[];
  usuarios: OpcionSimple[];
}) {
  const [items, setItems] = useState(tareas);
  const [prevTareas, setPrevTareas] = useState(tareas);
  if (tareas !== prevTareas) {
    setPrevTareas(tareas);
    setItems(tareas);
  }

  const [obrasFiltro, setObrasFiltro] = useState<string[]>([]);
  const [rubrosFiltro, setRubrosFiltro] = useState<string[]>([]);
  const [personasFiltro, setPersonasFiltro] = useState<string[]>([]);
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

  // Nada tildado en un filtro significa "todas": así el usuario ve el conjunto
  // completo sin tener que tildar las siete obras una por una.
  //
  // "Ver completadas" es la excepción: no suma, cambia de lista. O se ven las
  // pendientes o se ven las completadas, nunca mezcladas, porque lo que falta
  // hacer se perdía entre lo ya hecho, que es lo que se acumula con el tiempo.
  const visibles = ordenarTareas(
    items.filter((t) => {
      if (verCompletadas ? t.estado !== "COMPLETADA" : t.estado === "COMPLETADA") return false;
      if (obrasFiltro.length > 0 && !obrasFiltro.includes(t.proyectoId)) return false;
      if (rubrosFiltro.length > 0 && !rubrosFiltro.includes(t.rubroId ?? SIN_RUBRO)) return false;
      if (personasFiltro.length > 0) {
        const coincide =
          t.asignados.length === 0
            ? personasFiltro.includes(SIN_ASIGNAR)
            : t.asignados.some((a) => personasFiltro.includes(a.id));
        if (!coincide) return false;
      }
      return true;
    })
  );

  const hayFiltros =
    obrasFiltro.length > 0 || rubrosFiltro.length > 0 || personasFiltro.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de filtros y acciones.
          En móvil las acciones suben arriba de todo y los filtros van en una
          grilla de dos columnas: sueltos se acomodaban solos según el ancho de
          cada uno y quedaban escalonados, con la grilla arrancan todos en la
          misma línea y miden lo mismo.
          De `sm` para arriba el envoltorio de la grilla pasa a `contents`, así
          los filtros vuelven a ser hijos directos de la fila y todo queda en
          un solo renglón como venía. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {/* En móvil `order-first` las manda arriba; en escritorio `order-last`
            más `ml-auto` las devuelve al extremo derecho de la fila. */}
        <div className="order-first flex items-center justify-between gap-3 sm:order-last sm:ml-auto">
          <label className="flex cursor-default items-center gap-2">
            <Checkbox
              id="verCompletadasGlobal"
              checked={verCompletadas}
              onCheckedChange={(checked) => setVerCompletadas(checked === true)}
            />
            <Label htmlFor="verCompletadasGlobal" className="cursor-pointer text-xs font-normal">
              Ver completadas
            </Label>
          </label>
          <TareaDialog
            proyectos={proyectos}
            rubros={rubros}
            usuarios={usuarios}
            onSaved={handleSaved}
            trigger={
              <Button
                type="button"
                size="sm"
                aria-label="Nueva tarea"
                // En móvil queda como un círculo con un más y nada de texto:
                // ocupa poco y es un blanco cómodo para el pulgar. Los `max-sm`
                // van sólo hacia abajo, así que el botón de escritorio no se
                // toca. El texto no se borra, se esconde para el lector de
                // pantalla, que sigue leyendo "Nueva tarea".
                className="max-sm:size-10 max-sm:rounded-full max-sm:p-0"
              >
                <Plus className="size-3.5 max-sm:size-5" />
                <span className="max-sm:sr-only">Nueva tarea</span>
              </Button>
            }
          />
        </div>

        <div className="grid grid-cols-2 items-end gap-3 sm:contents">
          <FiltroMultiple
            id="filtroObra"
            label="Obra"
            opciones={proyectos}
            value={obrasFiltro}
            onChange={setObrasFiltro}
            etiquetaTodos="Todas las obras"
            sustantivo="obras"
            className="w-full sm:w-40"
          />
          <FiltroMultiple
            id="filtroRubro"
            label="Rubro"
            opciones={[...rubros, { id: SIN_RUBRO, nombre: "Sin rubro" }]}
            value={rubrosFiltro}
            onChange={setRubrosFiltro}
            etiquetaTodos="Todos los rubros"
            sustantivo="rubros"
            className="w-full sm:w-40"
          />
          <FiltroMultiple
            id="filtroPersona"
            label="Asignada a"
            opciones={[...usuarios, { id: SIN_ASIGNAR, nombre: "Sin asignar" }]}
            value={personasFiltro}
            onChange={setPersonasFiltro}
            etiquetaTodos="Todas las personas"
            sustantivo="personas"
            className="w-full sm:w-40"
          />

          {/* En móvil cae en la celda libre al lado de "Asignada a", que es
              justo donde queda a mano después de tocar los filtros. */}
          {hayFiltros && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setObrasFiltro([]);
                setRubrosFiltro([]);
                setPersonasFiltro([]);
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Se aclara siempre cuál de las dos listas se está mirando: el contador
          es lo único que distingue "no hay pendientes" de "no hay completadas"
          cuando el número es chico y el tilde queda fuera de la vista. */}
      <p className="text-xs text-muted-foreground">
        {visibles.length}{" "}
        {visibles.length === 1
          ? verCompletadas
            ? "tarea completada"
            : "tarea pendiente"
          : verCompletadas
            ? "tareas completadas"
            : "tareas pendientes"}
        {hayFiltros ? " con los filtros aplicados" : ""}
      </p>

      <TareasLista
        tareas={visibles}
        rubros={rubros}
        usuarios={usuarios}
        mostrarObra
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        vacio={
          hayFiltros
            ? "No hay tareas que coincidan con los filtros."
            : items.length === 0
              ? "Todavía no hay tareas cargadas."
              : verCompletadas
                ? "Todavía no hay tareas completadas."
                : "No quedan tareas pendientes."
        }
      />
    </div>
  );
}
