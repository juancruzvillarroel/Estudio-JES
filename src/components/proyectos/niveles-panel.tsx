"use client";

import { useRef, useState, useTransition } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  crearNivel,
  eliminarNivel,
  renombrarNivel,
  reordenarNiveles,
} from "@/actions/niveles-proyecto";
import type { NivelOpcion } from "@/lib/niveles";
import { cn } from "@/lib/utils";

/**
 * Una fila de la lista: se arrastra, se renombra en el lugar y se borra.
 *
 * El nombre se guarda al salir del campo y sólo si cambió, igual que las filas
 * del cómputo: cargar cinco niveles es escribir cinco renglones seguidos, y un
 * botón de guardar por renglón lo vuelve una ceremonia.
 */
function FilaNivel({
  nivel,
  proyectoId,
  arrastrable,
  onSaved,
  onDeleted,
}: {
  nivel: NivelOpcion;
  proyectoId: string;
  arrastrable: boolean;
  onSaved: (n: NivelOpcion) => void;
  onDeleted: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nivel.id,
    disabled: !arrastrable,
  });
  const [nombre, setNombre] = useState(nivel.nombre);
  const [guardado, setGuardado] = useState(nivel.nombre);
  const [prev, setPrev] = useState(nivel);
  const [, startTransition] = useTransition();

  if (nivel !== prev) {
    setPrev(nivel);
    setNombre(nivel.nombre);
    setGuardado(nivel.nombre);
  }

  const guardar = () => {
    const limpio = nombre.trim();
    if (limpio === guardado) return;
    // Vaciar el campo no es "borrame": es un tipeo a medias. Se vuelve al
    // nombre anterior en vez de mandar un nombre vacío al servidor.
    if (limpio === "") {
      setNombre(guardado);
      return;
    }

    setGuardado(limpio);
    startTransition(async () => {
      const result = await renombrarNivel(proyectoId, nivel.id, limpio);
      if (!result.success) {
        toast.error(result.error);
        setNombre(guardado);
        setGuardado(guardado);
        return;
      }
      onSaved(result.nivel);
    });
  };

  const borrar = () =>
    startTransition(async () => {
      const result = await eliminarNivel(proyectoId, nivel.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onDeleted(nivel.id);
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
        isDragging && "relative z-10 opacity-80 shadow-lg"
      )}
    >
      {arrastrable && (
        <button
          type="button"
          aria-label={`Arrastrar ${nivel.nombre}`}
          className="shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label="Nombre del nivel"
        className="h-8 px-2 text-sm"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Eliminar ${nivel.nombre}`}
        onClick={borrar}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Los niveles de la obra: "PLANTA BAJA", "PLANTA TIPO", "4TO PISO", "AZOTEA".
 *
 * Se escriben a mano, en el orden en que se sube la obra, porque los niveles
 * reales no salen de contar pisos: "planta tipo" son varios pisos iguales que
 * se computan una sola vez, un subsuelo no es un piso más, y el nombre que
 * importa es el que se usa en la obra y va a salir impreso en el cómputo.
 *
 * El orden es de abajo hacia arriba y lo decide el arrastre: no hay forma de
 * deducirlo del nombre, y el cómputo se lee subiendo.
 *
 * Borrar un nivel que ya tiene cómputo cargado está bloqueado a propósito (ver
 * eliminarNivel): mover esas filas a otra planta es una decisión, no algo que
 * tenga que pasar de costado al borrar un nombre.
 */
export function NivelesPanel({
  proyectoId,
  niveles,
  onChange,
}: {
  proyectoId: string;
  niveles: NivelOpcion[];
  onChange?: (niveles: NivelOpcion[]) => void;
}) {
  const [items, setItems] = useState(niveles);
  const [prev, setPrev] = useState(niveles);
  const [nuevo, setNuevo] = useState("");
  const [pending, startTransition] = useTransition();
  const campoNuevo = useRef<HTMLInputElement>(null);

  if (niveles !== prev) {
    setPrev(niveles);
    setItems(niveles);
  }

  const actualizar = (siguiente: NivelOpcion[]) => {
    setItems(siguiente);
    onChange?.(siguiente);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const agregar = () => {
    const limpio = nuevo.trim();
    if (limpio === "" || pending) return;
    startTransition(async () => {
      const result = await crearNivel(proyectoId, limpio);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      actualizar([...items, result.nivel]);
      setNuevo("");
      campoNuevo.current?.focus();
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const desde = items.findIndex((n) => n.id === active.id);
    const hasta = items.findIndex((n) => n.id === over.id);
    if (desde === -1 || hasta === -1) return;

    const anterior = items;
    const siguiente = arrayMove(items, desde, hasta);
    actualizar(siguiente);

    startTransition(async () => {
      const result = await reordenarNiveles(
        proyectoId,
        siguiente.map((n) => n.id)
      );
      if (!result.success) {
        toast.error(result.error);
        actualizar(anterior);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label>Niveles de la obra</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Cargalos con el nombre que tienen en la obra y en el orden en que se
          sube: planta baja primero, azotea al final. El cómputo de cada ítem se
          abre con esta lista. Se guardan solos, sin tocar Guardar.
        </p>
      </div>

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1.5">
              {items.map((n) => (
                <FilaNivel
                  key={n.id}
                  nivel={n}
                  proyectoId={proyectoId}
                  arrastrable={items.length > 1}
                  onSaved={(actualizado) =>
                    actualizar(items.map((x) => (x.id === actualizado.id ? actualizado : x)))
                  }
                  onDeleted={(id) => actualizar(items.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2">
        <Input
          ref={campoNuevo}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Agregar nivel…"
          aria-label="Nombre del nivel nuevo"
          className="h-8 px-2 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={nuevo.trim() === "" || pending}
          onClick={agregar}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </div>
  );
}
