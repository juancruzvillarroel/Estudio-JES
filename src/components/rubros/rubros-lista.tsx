"use client";

import { useState, useTransition } from "react";
import { GripVertical, Pencil } from "lucide-react";
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
import { reordenarRubros } from "@/actions/rubros";
import { cn } from "@/lib/utils";

type Rubro = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
  _count: { proveedores: number };
};

function RubroBlock({
  rubro,
  arrastrable,
}: {
  rubro: Rubro;
  arrastrable: boolean;
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
        "flex items-center gap-3 rounded-md border bg-background p-3",
        isDragging && "relative z-10 opacity-80 shadow-lg"
      )}
    >
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
      <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
        {rubro.codigoPrefijo ?? "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{rubro.nombre}</span>
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
  const [, startTransition] = useTransition();

  if (rubros !== prevRubros) {
    setPrevRubros(rubros);
    setItems(rubros);
  }

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
          (r.codigoPrefijo ?? "").toLowerCase().includes(texto)
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
          placeholder="Buscar rubro o prefijo..."
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
                <RubroBlock key={r.id} rubro={r} arrastrable />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {itemsFiltrados.map((r) => (
            <RubroBlock key={r.id} rubro={r} arrastrable={false} />
          ))}
        </div>
      )}
    </div>
  );
}
