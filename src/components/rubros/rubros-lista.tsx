"use client";

import { useState, useTransition } from "react";
import { ChevronRight, GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RubroDialog } from "@/components/rubros/rubro-dialog";
import { SubrubroDialog } from "@/components/rubros/subrubro-dialog";
import { reordenarRubros } from "@/actions/rubros";
import { cn } from "@/lib/utils";

type Subrubro = { id: string; nombre: string };
type Rubro = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
  _count: { proveedores: number };
  subrubros: Subrubro[];
};

function RubroBlock({
  rubro,
  arrastrable,
  expandido,
  onToggle,
}: {
  rubro: Rubro;
  arrastrable: boolean;
  expandido: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rubro.id,
    disabled: !arrastrable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-md border bg-background",
        isDragging && "relative z-10 opacity-80 shadow-lg"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {arrastrable && (
          <button
            type="button"
            aria-label="Arrastrar para reordenar"
            className="shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={expandido ? "Ocultar subrubros" : "Mostrar subrubros"}
          aria-expanded={expandido}
          onClick={onToggle}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", expandido && "rotate-90")} />
        </button>
        <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
          {rubro.codigoPrefijo ?? "—"}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
        >
          {rubro.nombre}
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">
          {rubro.subrubros.length} subrubros
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {rubro._count.proveedores} proveedores
        </span>
        <RubroDialog
          rubro={rubro}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar rubro">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
      </div>

      {expandido && (
        <div className="border-t bg-muted/30 p-3 pl-14">
          <div className="flex flex-col gap-2">
            {rubro.subrubros.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin subrubros todavía.</p>
            ) : (
              rubro.subrubros.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-1.5"
                >
                  <span className="text-sm">{s.nombre}</span>
                  <SubrubroDialog
                    rubroId={rubro.id}
                    subrubro={s}
                    trigger={
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar subrubro">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>
              ))
            )}
            <SubrubroDialog
              rubroId={rubro.id}
              trigger={
                <Button type="button" variant="outline" size="sm" className="w-fit">
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo subrubro
                </Button>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function RubrosLista({
  rubros,
  nuevoRubro,
}: {
  rubros: Rubro[];
  nuevoRubro?: React.ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [items, setItems] = useState(rubros);
  const [prevRubros, setPrevRubros] = useState(rubros);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  if (rubros !== prevRubros) {
    setPrevRubros(rubros);
    setItems(rubros);
  }

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const sinFiltro = busqueda.trim() === "";
  const itemsFiltrados = sinFiltro
    ? items
    : items.filter((r) => {
        const texto = busqueda.trim().toLowerCase();
        return (
          r.nombre.toLowerCase().includes(texto) ||
          (r.codigoPrefijo ?? "").toLowerCase().includes(texto) ||
          r.subrubros.some((s) => s.nombre.toLowerCase().includes(texto))
        );
      });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((r) => r.id === active.id);
    const newIndex = items.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordenados = arrayMove(items, oldIndex, newIndex);
    setItems(reordenados);

    startTransition(async () => {
      const result = await reordenarRubros(reordenados.map((r) => r.id));
      if (result?.error) {
        toast.error(result.error);
        setItems(items);
      }
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input
          placeholder="Buscar rubro, prefijo o subrubro..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-56"
        />
        {nuevoRubro}
      </div>

      {itemsFiltrados.length === 0 ? (
        <div className="mt-4 rounded-md border p-6 text-center text-sm text-muted-foreground">
          No hay rubros que coincidan con el filtro.
        </div>
      ) : sinFiltro ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemsFiltrados.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 flex flex-col gap-2">
              {itemsFiltrados.map((r) => (
                <RubroBlock
                  key={r.id}
                  rubro={r}
                  arrastrable
                  expandido={expandidos.has(r.id)}
                  onToggle={() => toggleExpandido(r.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {itemsFiltrados.map((r) => (
            <RubroBlock
              key={r.id}
              rubro={r}
              arrastrable={false}
              expandido={expandidos.has(r.id)}
              onToggle={() => toggleExpandido(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
