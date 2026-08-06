"use client";

import { useState, useTransition } from "react";
import { LayoutGrid, List, GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { crearTipoTramite, moverTipoTramite } from "@/actions/municipal";
import { TramiteItemRow } from "./tramite-item-row";
import { CategoriaMunicipalDialog } from "./categoria-municipal-dialog";
import { EtapaMunicipalDialog } from "./etapa-municipal-dialog";

type Vista = "grid" | "lista";

type Categoria = { id: string; nombre: string; orden: number };
type Etapa = { id: string; categoriaId: string; nombre: string; orden: number };

type Tipo = {
  id: string;
  categoriaId: string;
  etapaId: string | null;
  nombre: string;
  descripcion: string | null;
  orden: number;
};

type Tramite = {
  tipoId: string;
  estado: "PENDIENTE" | "PRESENTADO";
  notas: string | null;
  archivoNombre: string | null;
  archivoUrl: string | null;
};

// Clave usada para el contenedor de trámites que todavía no tienen etapa
// asignada dentro de una categoría.
const SIN_ETAPA = "__sin_etapa__";

function AgregarDocumentoTile({
  proyectoId,
  categoriaId,
  etapaId,
  vista,
}: {
  proyectoId: string;
  categoriaId: string;
  etapaId: string | null;
  vista: Vista;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pending, startTransition] = useTransition();

  const cerrar = () => {
    setAbierto(false);
    setNombre("");
    setDescripcion("");
  };

  const handleGuardar = () => {
    if (!nombre.trim()) return;
    startTransition(async () => {
      await crearTipoTramite(proyectoId, categoriaId, etapaId, nombre, descripcion || undefined);
      cerrar();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted",
          vista === "grid" ? "min-h-[9rem] flex-col p-3" : "p-3"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar documento
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border p-3", vista === "lista" && "max-w-sm")}>
      <Input
        placeholder="Nombre del documento"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus
      />
      <Textarea
        placeholder="Descripción (opcional)"
        rows={2}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending || !nombre.trim()} onClick={handleGuardar}>
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function NuevaEtapaTile({ proyectoId, categoriaId }: { proyectoId: string; categoriaId: string }) {
  return (
    <EtapaMunicipalDialog
      proyectoId={proyectoId}
      categoriaId={categoriaId}
      trigger={
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva etapa
        </button>
      }
    />
  );
}

function TramiteBlock({
  proyectoId,
  tipo,
  tramite,
  vista,
}: {
  proyectoId: string;
  tipo: Tipo;
  tramite: Tramite | undefined;
  vista: Vista;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tipo.id,
  });

  const dragHandle = (
    <button
      type="button"
      aria-label="Arrastrar para mover"
      className="shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-70 shadow-lg")}
    >
      <TramiteItemRow
        proyectoId={proyectoId}
        tipoId={tipo.id}
        nombre={tipo.nombre}
        descripcion={tipo.descripcion}
        estado={tramite?.estado ?? "PENDIENTE"}
        notas={tramite?.notas ?? null}
        archivoNombre={tramite?.archivoNombre ?? null}
        archivoUrl={tramite?.archivoUrl ?? null}
        vista={vista}
        dragHandle={dragHandle}
      />
    </div>
  );
}

// Envuelve un grupo de trámites (una etapa, o el pool "sin etapa") como
// zona donde soltar bloques arrastrados, tanto para reordenar adentro como
// para recibir bloques que vienen de otro contenedor.
function ContenedorTramites({
  id,
  items,
  vista,
  children,
}: {
  id: string;
  items: string[];
  vista: Vista;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext
      id={id}
      items={items}
      strategy={vista === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-md transition-shadow",
          vista === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2",
          isOver && "ring-2 ring-primary/40"
        )}
      >
        {children}
      </div>
    </SortableContext>
  );
}

function encontrarContenedor(
  itemsPorContenedor: Record<string, Tipo[]>,
  id: string
): string | undefined {
  if (id in itemsPorContenedor) return id;
  return Object.keys(itemsPorContenedor).find((key) =>
    itemsPorContenedor[key].some((tipo) => tipo.id === id)
  );
}

function CategoriaPanel({
  proyectoId,
  categoria,
  etapasCategoria,
  tiposCategoria,
  tramitesPorTipo,
  vista,
}: {
  proyectoId: string;
  categoria: Categoria;
  etapasCategoria: Etapa[];
  tiposCategoria: Tipo[];
  tramitesPorTipo: Map<string, Tramite>;
  vista: Vista;
}) {
  const construirContenedores = () => {
    const mapa: Record<string, Tipo[]> = {};
    for (const etapa of etapasCategoria) {
      mapa[etapa.id] = tiposCategoria
        .filter((t) => t.etapaId === etapa.id)
        .sort((a, b) => a.orden - b.orden);
    }
    mapa[SIN_ETAPA] = tiposCategoria
      .filter((t) => !t.etapaId)
      .sort((a, b) => a.orden - b.orden);
    return mapa;
  };

  const [itemsPorContenedor, setItemsPorContenedor] = useState<Record<string, Tipo[]>>(
    construirContenedores
  );
  const [prevTipos, setPrevTipos] = useState(tiposCategoria);
  const [prevEtapas, setPrevEtapas] = useState(etapasCategoria);
  const [, startTransition] = useTransition();

  // Si cambian los datos del servidor (revalidación tras crear/borrar un
  // documento o etapa desde otro lado), resincronizamos los contenedores.
  if (tiposCategoria !== prevTipos || etapasCategoria !== prevEtapas) {
    setPrevTipos(tiposCategoria);
    setPrevEtapas(etapasCategoria);
    setItemsPorContenedor(construirContenedores());
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeContenedor = encontrarContenedor(itemsPorContenedor, String(active.id));
    const overContenedor = encontrarContenedor(itemsPorContenedor, String(over.id));
    if (!activeContenedor || !overContenedor || activeContenedor === overContenedor) return;

    setItemsPorContenedor((prev) => {
      const activeItems = prev[activeContenedor];
      const overItems = prev[overContenedor];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      if (activeIndex === -1) return prev;
      const overIndex = overItems.findIndex((t) => t.id === over.id);
      const nuevoIndex = overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...prev,
        [activeContenedor]: activeItems.filter((t) => t.id !== active.id),
        [overContenedor]: [
          ...overItems.slice(0, nuevoIndex),
          activeItems[activeIndex],
          ...overItems.slice(nuevoIndex),
        ],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overContenedor = encontrarContenedor(itemsPorContenedor, String(over.id));
    if (!overContenedor) return;

    let itemsFinales = itemsPorContenedor[overContenedor];
    const activeIndex = itemsFinales.findIndex((t) => t.id === active.id);
    const overIndex = itemsFinales.findIndex((t) => t.id === over.id);
    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      itemsFinales = arrayMove(itemsFinales, activeIndex, overIndex);
      setItemsPorContenedor((prev) => ({ ...prev, [overContenedor]: itemsFinales }));
    }

    const etapaId = overContenedor === SIN_ETAPA ? null : overContenedor;
    const idsOrdenados = itemsFinales.map((t) => t.id);

    startTransition(async () => {
      const result = await moverTipoTramite(proyectoId, categoria.id, etapaId, idsOrdenados);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  };

  const sinEtapaItems = itemsPorContenedor[SIN_ETAPA] ?? [];

  return (
    <div className="flex flex-col gap-3">
      {tiposCategoria.length === 0 && etapasCategoria.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Todavía no hay trámites cargados en esta categoría.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {etapasCategoria.map((etapa) => {
          const items = itemsPorContenedor[etapa.id] ?? [];
          const total = items.length;
          const presentados = items.filter(
            (tipo) => tramitesPorTipo.get(tipo.id)?.estado === "PRESENTADO"
          ).length;

          return (
            <div key={etapa.id} className="rounded-md border bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-medium">{etapa.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {presentados}/{total}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-success transition-[width] duration-300"
                        style={{ width: `${(presentados / total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <EtapaMunicipalDialog
                  proyectoId={proyectoId}
                  categoriaId={categoria.id}
                  etapa={etapa}
                  trigger={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar etapa">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
              <ContenedorTramites id={etapa.id} items={items.map((t) => t.id)} vista={vista}>
                {items.map((tipo) => (
                  <TramiteBlock
                    key={tipo.id}
                    proyectoId={proyectoId}
                    tipo={tipo}
                    tramite={tramitesPorTipo.get(tipo.id)}
                    vista={vista}
                  />
                ))}
                <AgregarDocumentoTile
                  proyectoId={proyectoId}
                  categoriaId={categoria.id}
                  etapaId={etapa.id}
                  vista={vista}
                />
              </ContenedorTramites>
            </div>
          );
        })}

        <div className={cn(etapasCategoria.length > 0 && "rounded-md border p-3")}>
          {etapasCategoria.length > 0 && (
            <p className="mb-2 text-xs font-medium text-muted-foreground">Sin etapa</p>
          )}
          <ContenedorTramites id={SIN_ETAPA} items={sinEtapaItems.map((t) => t.id)} vista={vista}>
            {sinEtapaItems.map((tipo) => (
              <TramiteBlock
                key={tipo.id}
                proyectoId={proyectoId}
                tipo={tipo}
                tramite={tramitesPorTipo.get(tipo.id)}
                vista={vista}
              />
            ))}
            <AgregarDocumentoTile
              proyectoId={proyectoId}
              categoriaId={categoria.id}
              etapaId={null}
              vista={vista}
            />
          </ContenedorTramites>
        </div>
      </DndContext>

      <NuevaEtapaTile proyectoId={proyectoId} categoriaId={categoria.id} />
    </div>
  );
}

export function MunicipalBoard({
  proyectoId,
  categorias,
  etapas,
  tipos,
  tramites,
}: {
  proyectoId: string;
  categorias: Categoria[];
  etapas: Etapa[];
  tipos: Tipo[];
  tramites: Tramite[];
}) {
  const [vista, setVista] = useState<Vista>("grid");
  const tramitesPorTipo = new Map(tramites.map((t) => [t.tipoId, t]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant={vista === "grid" ? "secondary" : "ghost"}
          onClick={() => setVista("grid")}
          aria-label="Ver en cuadrícula"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={vista === "lista" ? "secondary" : "ghost"}
          onClick={() => setVista("lista")}
          aria-label="Ver en lista"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      {categorias.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no hay categorías cargadas. Creá la primera abajo.
        </p>
      ) : (
        <Accordion multiple className="flex flex-col gap-3">
          {categorias.map((categoria) => {
            const tiposCategoria = tipos.filter((t) => t.categoriaId === categoria.id);
            const etapasCategoria = etapas.filter((e) => e.categoriaId === categoria.id);

            return (
              <div key={categoria.id} className="rounded-md border">
                <div className="flex items-center gap-2 pr-3">
                  <AccordionItem value={categoria.id} className="flex-1 border-0">
                    <AccordionTrigger className="w-full px-3 py-3 text-sm font-semibold">
                      {categoria.nombre}
                    </AccordionTrigger>
                    <AccordionPanel className="px-3">
                      <CategoriaPanel
                        proyectoId={proyectoId}
                        categoria={categoria}
                        etapasCategoria={etapasCategoria}
                        tiposCategoria={tiposCategoria}
                        tramitesPorTipo={tramitesPorTipo}
                        vista={vista}
                      />
                    </AccordionPanel>
                  </AccordionItem>
                  <CategoriaMunicipalDialog
                    proyectoId={proyectoId}
                    categoria={categoria}
                    trigger={
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar categoría">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </Accordion>
      )}

      <CategoriaMunicipalDialog
        proyectoId={proyectoId}
        trigger={
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva categoría
          </button>
        }
      />
    </div>
  );
}
