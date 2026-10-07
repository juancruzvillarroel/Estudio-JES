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
  tareasDeVista,
  type OpcionSimple,
  type TareaOpcion,
  type VistaTarea,
} from "@/lib/tareas";

/**
 * Valores sentinela para poder tildar "las que no tienen rubro" y "las que no
 * están asignadas a nadie" dentro de los mismos filtros.
 */
const SIN_RUBRO = "__sin_rubro__";
const SIN_ASIGNAR = "__sin_asignar__";

/** Cómo se cuenta cada lista en el renglón de arriba de las tareas. */
const SUSTANTIVO_POR_VISTA: Record<VistaTarea, { una: string; varias: string }> = {
  PENDIENTE: { una: "tarea pendiente", varias: "tareas pendientes" },
  A_CORREGIR: { una: "tarea a corregir", varias: "tareas a corregir" },
  EN_REVISION: { una: "tarea en revisión", varias: "tareas en revisión" },
  COMPLETADA: { una: "tarea completada", varias: "tareas completadas" },
};

/** Qué decir cuando la solapa elegida no tiene nada. */
const VACIO_POR_VISTA: Record<VistaTarea, string> = {
  PENDIENTE: "No quedan tareas pendientes.",
  A_CORREGIR: "No hay nada esperando una corrección.",
  EN_REVISION: "No hay nada esperando revisión.",
  COMPLETADA: "Todavía no hay tareas completadas.",
};

export function TareasGlobal({
  encabezado,
  tareas,
  proyectos,
  rubros,
  usuarios,
}: {
  encabezado: React.ReactNode;
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

  const conteos: Record<VistaTarea, number> = {
    PENDIENTE: tareasDeVista(filtradas, "PENDIENTE").length,
    A_CORREGIR: tareasDeVista(filtradas, "A_CORREGIR").length,
    EN_REVISION: tareasDeVista(filtradas, "EN_REVISION").length,
    COMPLETADA: tareasDeVista(filtradas, "COMPLETADA").length,
  };
  const visibles = ordenarTareas(tareasDeVista(filtradas, vista));

  const hayFiltros =
    obrasFiltro.length > 0 || rubrosFiltro.length > 0 || personasFiltro.length > 0;

  return (
    <div>
      {/* El título y la acción principal comparten renglón, como en Pedidos: en
          un celular el botón queda arriba de todo y a la derecha, que es donde
          el pulgar lo busca, en vez de perdido entre los filtros. */}
      <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
        {encabezado}
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
              className="shrink-0 max-sm:size-10 max-sm:rounded-full max-sm:p-0"
            >
              <Plus className="size-3.5 max-sm:size-5" />
              <span className="max-sm:sr-only">Nueva tarea</span>
            </Button>
          }
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Barra de filtros: uno debajo del otro y ocupando todo el ancho.
            En dos columnas los nombres largos de obra y de rubro se recortaban,
            y el filtro deja de servir si no se lee qué está tildado.
            El corte va en `lg` y no en `sm`: con `sm` cualquier pantalla de más
            de 640px —una tablet, o el navegador achicado— ya los volvía a poner
            en fila, que es justo lo que no se quería. */}
        <div className="grid items-end gap-3 lg:grid-cols-4">
          <FiltroMultiple
            id="filtroObra"
            label="Obra"
            opciones={proyectos}
            value={obrasFiltro}
            onChange={setObrasFiltro}
            etiquetaTodos="Todas las obras"
            sustantivo="obras"
            className="w-full"
          />
          <FiltroMultiple
            id="filtroRubro"
            label="Rubro"
            opciones={[...rubros, { id: SIN_RUBRO, nombre: "Sin rubro" }]}
            value={rubrosFiltro}
            onChange={setRubrosFiltro}
            etiquetaTodos="Todos los rubros"
            sustantivo="rubros"
            className="w-full"
          />
          <FiltroMultiple
            id="filtroPersona"
            label="Asignada a"
            opciones={[...usuarios, { id: SIN_ASIGNAR, nombre: "Sin asignar" }]}
            value={personasFiltro}
            onChange={setPersonasFiltro}
            etiquetaTodos="Todas las personas"
            sustantivo="personas"
            className="w-full"
          />

          {hayFiltros && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
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

        <EstadoTareasTabs value={vista} onChange={setVista} conteos={conteos}>
          {/* El número ya está en la solapa, pero acá se escribe con todas las
              letras y, sobre todo, se aclara si viene recortado por los
              filtros: sin eso una lista corta parece que no hay trabajo cuando
              en realidad hay un filtro puesto y olvidado. */}
          <p className="mb-3 text-xs text-muted-foreground">
            {visibles.length}{" "}
            {visibles.length === 1
              ? SUSTANTIVO_POR_VISTA[vista].una
              : SUSTANTIVO_POR_VISTA[vista].varias}
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
                  : VACIO_POR_VISTA[vista]
            }
          />
        </EstadoTareasTabs>
      </div>
    </div>
  );
}
