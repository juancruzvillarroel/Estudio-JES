"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FiltroMultiple } from "@/components/ui/filtro-multiple";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { TareasLista } from "@/components/tareas/tareas-lista";
import { EstadoTareasTabs } from "@/components/tareas/estado-tareas-tabs";
import {
  ordenarTareas,
  type EstadoTarea,
  type OpcionSimple,
  type TareaOpcion,
} from "@/lib/tareas";

/**
 * Valores sentinela para poder tildar "las que no tienen rubro" y "las que no
 * están asignadas a nadie" dentro de los mismos filtros.
 */
const SIN_RUBRO = "__sin_rubro__";
const SIN_ASIGNAR = "__sin_asignar__";

/** Cómo se cuenta cada lista en el renglón de arriba de las tareas. */
const SUSTANTIVO_POR_ESTADO: Record<EstadoTarea, { una: string; varias: string }> = {
  PENDIENTE: { una: "tarea pendiente", varias: "tareas pendientes" },
  EN_REVISION: { una: "tarea en revisión", varias: "tareas en revisión" },
  COMPLETADA: { una: "tarea completada", varias: "tareas completadas" },
};

/** Qué decir cuando la solapa elegida no tiene nada. */
const VACIO_POR_ESTADO: Record<EstadoTarea, string> = {
  PENDIENTE: "No quedan tareas pendientes.",
  EN_REVISION: "No hay nada esperando revisión.",
  COMPLETADA: "Todavía no hay tareas completadas.",
};

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
  const [estado, setEstado] = useState<EstadoTarea>("PENDIENTE");

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
  // El estado no entra acá: lo elige la solapa y se aplica después, sobre este
  // mismo conjunto. Así los números de las tres solapas ya vienen con los
  // filtros puestos y dicen cuántas se van a ver al entrar, en vez de contar
  // tareas de obras que en ese momento están filtradas.
  const filtradas = items.filter((t) => {
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
  });

  const conteos = {
    PENDIENTE: filtradas.filter((t) => t.estado === "PENDIENTE").length,
    EN_REVISION: filtradas.filter((t) => t.estado === "EN_REVISION").length,
    COMPLETADA: filtradas.filter((t) => t.estado === "COMPLETADA").length,
  };
  const visibles = ordenarTareas(filtradas.filter((t) => t.estado === estado));

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
        <div className="order-first flex items-center justify-end gap-3 sm:order-last sm:ml-auto">
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

      <EstadoTareasTabs value={estado} onChange={setEstado} conteos={conteos}>
        {/* El número ya está en la solapa, pero acá se escribe con todas las
            letras y, sobre todo, se aclara si viene recortado por los filtros:
            sin eso una lista corta parece que no hay trabajo cuando en realidad
            hay un filtro puesto y olvidado. */}
        <p className="mb-3 text-xs text-muted-foreground">
          {visibles.length}{" "}
          {visibles.length === 1
            ? SUSTANTIVO_POR_ESTADO[estado].una
            : SUSTANTIVO_POR_ESTADO[estado].varias}
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
                : VACIO_POR_ESTADO[estado]
          }
        />
      </EstadoTareasTabs>
    </div>
  );
}
