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
  const visibles = ordenarTareas(
    items.filter((t) => {
      if (!verCompletadas && t.estado === "COMPLETADA") return false;
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
      <div className="flex flex-wrap items-end gap-3">
        <FiltroMultiple
          id="filtroObra"
          label="Obra"
          opciones={proyectos}
          value={obrasFiltro}
          onChange={setObrasFiltro}
          etiquetaTodos="Todas las obras"
          sustantivo="obras"
        />
        <FiltroMultiple
          id="filtroRubro"
          label="Rubro"
          opciones={[...rubros, { id: SIN_RUBRO, nombre: "Sin rubro" }]}
          value={rubrosFiltro}
          onChange={setRubrosFiltro}
          etiquetaTodos="Todos los rubros"
          sustantivo="rubros"
        />
        <FiltroMultiple
          id="filtroPersona"
          label="Asignada a"
          opciones={[...usuarios, { id: SIN_ASIGNAR, nombre: "Sin asignar" }]}
          value={personasFiltro}
          onChange={setPersonasFiltro}
          etiquetaTodos="Todas las personas"
          sustantivo="personas"
        />

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

        <div className="ml-auto flex items-center gap-3">
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
              <Button type="button" variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Nueva tarea
              </Button>
            }
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibles.length} {visibles.length === 1 ? "tarea" : "tareas"}
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
            : "Todavía no hay tareas cargadas."
        }
      />
    </div>
  );
}
