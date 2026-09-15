"use client";

import { useState, useTransition } from "react";
import { GripVertical, Plus } from "lucide-react";
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  crearCategoriaDocumento,
  crearTipoDocumento,
  eliminarCategoriaDocumento,
  eliminarTipoDocumento,
  renombrarCategoriaDocumento,
  renombrarSubSeccionDocumento,
  renombrarTipoDocumento,
  reordenarCategoriasDocumento,
  reordenarSubSeccionesDocumento,
  reordenarTiposDocumento,
} from "@/actions/documentos";
import { cn } from "@/lib/utils";
import { DocumentoItemCard } from "./documento-item-card";
import { BotonRenombrar, RenombrarFila } from "./renombrar-fila";

type Categoria = {
  id: string;
  nombre: string;
  orden: number;
  porPiso: boolean;
};

type Tipo = {
  id: string;
  categoriaId: string;
  proyectoId: string | null;
  nombre: string;
  descripcion: string | null;
  orden: number;
  subSeccion: string | null;
  parentId: string | null;
};

type Documento = {
  tipoId: string;
  estado: "PENDIENTE" | "PRESENTADO";
  notas: string | null;
  archivoNombre: string | null;
  archivoUrl: string | null;
};

const AVISO_COMPARTIDO =
  "Viene del listado compartido: al tocarlo queda una copia propia de esta obra y las demás no se enteran.";

const AVISO_CATEGORIA =
  "Las categorías son las mismas en todas las obras: al renombrarla cambia en todas.";

/** El id que usa el arrastre para una subsección, que no es una fila y no tiene id propio. */
function idSubSeccion(categoriaId: string, nombre: string) {
  return `sub:${categoriaId}:${nombre}`;
}

function leerIdSubSeccion(id: string) {
  const resto = id.slice(4);
  const corte = resto.indexOf(":");
  return { categoriaId: resto.slice(0, corte), nombre: resto.slice(corte + 1) };
}

/**
 * Reacomoda en la lista plana solo los lugares que ocupaban esos ids.
 *
 * Los documentos de todos los niveles viven mezclados en una sola lista y cada
 * nivel se arma filtrándola, así que mover un grupo es reescribir sus casilleros
 * sin tocar los del resto: si se los mandara al final, los demás niveles se
 * reordenarían solos de rebote.
 */
function reacomodar<T extends { id: string }>(lista: T[], idsEnOrden: string[]): T[] {
  const delGrupo = new Set(idsEnOrden);
  const lugares = lista.flatMap((item, i) => (delGrupo.has(item.id) ? [i] : []));
  const porId = new Map(lista.map((item) => [item.id, item]));
  const copia = [...lista];
  idsEnOrden.forEach((id, i) => {
    const item = porId.get(id);
    if (item) copia[lugares[i]] = item;
  });
  return copia;
}

/**
 * Cuántos documentos hay y cuántos están presentados, contando solo las
 * hojas del árbol.
 *
 * Un item que agrupa subitems no es un documento en sí: no se presenta, se
 * completa cuando se completan los de adentro. Si se contara también el
 * grupo, la barra nunca llegaría al final aunque estuviera todo entregado.
 */
function progreso(
  nodos: Tipo[],
  hijosDe: (id: string) => Tipo[],
  presentado: (id: string) => boolean
): { total: number; presentados: number } {
  let total = 0;
  let presentados = 0;
  for (const nodo of nodos) {
    const hijos = hijosDe(nodo.id);
    if (hijos.length > 0) {
      const dentro = progreso(hijos, hijosDe, presentado);
      total += dentro.total;
      presentados += dentro.presentados;
    } else {
      total += 1;
      if (presentado(nodo.id)) presentados += 1;
    }
  }
  return { total, presentados };
}

/**
 * Envuelve una fila para poder arrastrarla y le pasa la manija al contenido.
 *
 * La manija va como hijo y no adentro del envoltorio porque en Documentación
 * cada fila es un acordeón: el asa tiene que quedar al lado del título, que ya
 * es un botón, y nunca adentro.
 */
function Arrastrable({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (asa: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const asa = (
    <button
      type="button"
      aria-label="Arrastrar para reordenar"
      className="shrink-0 touch-none cursor-grab pl-2 text-muted-foreground hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(className, isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      {children(asa)}
    </div>
  );
}

function AgregarDocumentoTile({
  proyectoId,
  categoriaId,
  subSeccion,
  parentId,
}: {
  proyectoId: string;
  categoriaId: string;
  subSeccion?: string | null;
  parentId?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [conSubitems, setConSubitems] = useState(false);
  const [grupoNombre, setGrupoNombre] = useState("");
  const [pending, startTransition] = useTransition();

  // Se puede armar un grupo desde el primer nivel de la categoría (donde el
  // grupo es una subsección) y desde adentro de una subsección (donde el
  // grupo es un documento que agrupa a otros). Adentro de un grupo ya no:
  // ahí sólo se agregan subitems sueltos, que es donde corta el anidado.
  const permiteGrupo = parentId === undefined;
  // En el primer nivel el grupo se guarda como subsección; más adentro, como
  // un tipo padre del que cuelgan los subitems.
  const grupoEsSubSeccion = subSeccion === undefined;

  const cerrar = () => {
    setAbierto(false);
    setNombre("");
    setDescripcion("");
    setConSubitems(false);
    setGrupoNombre("");
  };

  const handleGuardar = () => {
    if (!nombre.trim()) return;
    if (conSubitems && !grupoNombre.trim()) return;
    startTransition(async () => {
      if (conSubitems && grupoEsSubSeccion) {
        await crearTipoDocumento(
          proyectoId,
          categoriaId,
          nombre,
          descripcion || undefined,
          grupoNombre
        );
      } else if (conSubitems) {
        // Dos pasos: primero el padre, y recién con su id se puede colgar el
        // primer subitem.
        const padre = await crearTipoDocumento(
          proyectoId,
          categoriaId,
          grupoNombre,
          undefined,
          subSeccion ?? null
        );
        if (padre) {
          await crearTipoDocumento(
            proyectoId,
            categoriaId,
            nombre,
            descripcion || undefined,
            subSeccion ?? null,
            padre.id
          );
        }
      } else {
        await crearTipoDocumento(
          proyectoId,
          categoriaId,
          nombre,
          descripcion || undefined,
          subSeccion ?? null,
          parentId ?? null
        );
      }
      cerrar();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        {parentId ? "Agregar subitem" : "Agregar documento"}
      </button>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-2 rounded-md border p-3">
      {permiteGrupo && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={conSubitems} onCheckedChange={(checked) => setConSubitems(checked === true)} />
          Tiene subitems (agrupa varios documentos adentro)
        </label>
      )}
      {conSubitems && (
        <Input
          placeholder="Nombre del grupo"
          value={grupoNombre}
          onChange={(e) => setGrupoNombre(e.target.value)}
          autoFocus
        />
      )}
      <Input
        placeholder={
          conSubitems
            ? "Nombre del primer subitem"
            : parentId
              ? "Nombre del subitem"
              : "Nombre del documento"
        }
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus={!conSubitems}
      />
      <Textarea
        placeholder="Descripción (opcional)"
        rows={2}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !nombre.trim() || (conSubitems && !grupoNombre.trim())}
          onClick={handleGuardar}
        >
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function AgregarCategoriaTile({ proyectoId }: { proyectoId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [porPiso, setPorPiso] = useState(false);
  const [pending, startTransition] = useTransition();

  const cerrar = () => {
    setAbierto(false);
    setNombre("");
    setPorPiso(false);
  };

  const handleGuardar = () => {
    if (!nombre.trim()) return;
    startTransition(async () => {
      await crearCategoriaDocumento(proyectoId, nombre, porPiso);
      cerrar();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Nueva categoría
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Nombre de la categoría"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
          className="w-auto flex-1"
        />
        <Button type="button" size="sm" disabled={pending || !nombre.trim()} onClick={handleGuardar}>
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={porPiso} onCheckedChange={(checked) => setPorPiso(checked === true)} />
        Varía por piso (se genera un documento por cada piso del proyecto)
      </label>
    </div>
  );
}

function ProgresoBar({ total, presentados }: { total: number; presentados: number }) {
  if (total === 0) return null;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-success transition-[width] duration-300"
        style={{ width: `${(presentados / total) * 100}%` }}
      />
    </div>
  );
}

/**
 * Un documento del listado. Si tiene subitems colgando se dibuja como un
 * acordeón con los subitems adentro; si no, como la tarjeta de siempre con
 * su tilde de presentado.
 */
function NodoDocumento({
  proyectoId,
  categoriaId,
  tipo,
  hijosDe,
  documentosPorTipo,
  dragHandle,
}: {
  proyectoId: string;
  categoriaId: string;
  tipo: Tipo;
  hijosDe: (id: string) => Tipo[];
  documentosPorTipo: Map<string, Documento>;
  dragHandle?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const hijos = hijosDe(tipo.id);
  const compartido = tipo.proyectoId === null;

  if (hijos.length === 0) {
    return (
      <DocumentoItemCard
        proyectoId={proyectoId}
        tipoId={tipo.id}
        nombre={tipo.nombre}
        descripcion={tipo.descripcion}
        estado={documentosPorTipo.get(tipo.id)?.estado ?? "PENDIENTE"}
        compartido={compartido}
        dragHandle={dragHandle}
      />
    );
  }

  if (editando) {
    return (
      <div className="rounded-md border bg-background">
        <RenombrarFila
          inicial={tipo.nombre}
          aviso={compartido ? AVISO_COMPARTIDO : undefined}
          onGuardar={(valor) => renombrarTipoDocumento(proyectoId, tipo.id, valor)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  const { total, presentados } = progreso(
    hijos,
    hijosDe,
    (id) => documentosPorTipo.get(id)?.estado === "PRESENTADO"
  );

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center gap-2 pr-2">
        {dragHandle}
        <AccordionItem value={tipo.id} className="flex-1 border-0">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium">
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex w-full items-center justify-between gap-2">
                <span>{tipo.nombre}</span>
                <span className="text-muted-foreground">
                  {presentados}/{total}
                </span>
              </div>
              <ProgresoBar total={total} presentados={presentados} />
            </div>
          </AccordionTrigger>
          <AccordionPanel className="px-3">
            <div className="flex flex-col gap-2 pb-1">
              <ListaNodos
                proyectoId={proyectoId}
                categoriaId={categoriaId}
                nodos={hijos}
                hijosDe={hijosDe}
                documentosPorTipo={documentosPorTipo}
              />
              <AgregarDocumentoTile
                proyectoId={proyectoId}
                categoriaId={categoriaId}
                subSeccion={tipo.subSeccion}
                parentId={tipo.id}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>
        <BotonRenombrar nombre={tipo.nombre} onClick={() => setEditando(true)} />
        <DeleteButton
          iconOnly
          action={() => eliminarTipoDocumento(proyectoId, tipo.id)}
          confirmMessage={`¿Eliminar "${tipo.nombre}" y sus ${hijos.length} subitem${hijos.length === 1 ? "" : "s"} del listado?`}
        />
      </div>
    </div>
  );
}

/** Los documentos de un nivel, cada uno hoja o grupo, dentro de un acordeón. */
function ListaNodos({
  proyectoId,
  categoriaId,
  nodos,
  hijosDe,
  documentosPorTipo,
}: {
  proyectoId: string;
  categoriaId: string;
  nodos: Tipo[];
  hijosDe: (id: string) => Tipo[];
  documentosPorTipo: Map<string, Documento>;
}) {
  return (
    <Accordion multiple className="flex flex-col gap-2">
      <SortableContext items={nodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {nodos.map((tipo) => (
          <Arrastrable key={tipo.id} id={tipo.id}>
            {(asa) => (
              <NodoDocumento
                proyectoId={proyectoId}
                categoriaId={categoriaId}
                tipo={tipo}
                hijosDe={hijosDe}
                documentosPorTipo={documentosPorTipo}
                dragHandle={asa}
              />
            )}
          </Arrastrable>
        ))}
      </SortableContext>
    </Accordion>
  );
}

/** Una subsección: el grupo del primer nivel de una categoría. */
function SubSeccionBloque({
  proyectoId,
  categoriaId,
  sub,
  nodos,
  hijosDe,
  documentosPorTipo,
  presentado,
  dragHandle,
}: {
  proyectoId: string;
  categoriaId: string;
  sub: string;
  nodos: Tipo[];
  hijosDe: (id: string) => Tipo[];
  documentosPorTipo: Map<string, Documento>;
  presentado: (id: string) => boolean;
  dragHandle?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="rounded-md border bg-muted/20">
        <RenombrarFila
          inicial={sub}
          aviso={
            nodos.some((t) => t.proyectoId === null)
              ? "Tiene documentos del listado compartido: al renombrarla quedan copias propias de esta obra."
              : undefined
          }
          onGuardar={(valor) =>
            renombrarSubSeccionDocumento(proyectoId, categoriaId, sub, valor)
          }
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  const { total, presentados } = progreso(nodos, hijosDe, presentado);

  return (
    <div className="rounded-md border bg-muted/20">
      <div className="flex items-center gap-2 pr-2">
        {dragHandle}
        <AccordionItem value={sub} className="flex-1 border-0">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium">
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex w-full items-center justify-between gap-2">
                <span>{sub}</span>
                <span className="text-muted-foreground">
                  {presentados}/{total}
                </span>
              </div>
              <ProgresoBar total={total} presentados={presentados} />
            </div>
          </AccordionTrigger>
          <AccordionPanel className="px-3">
            <div className="flex flex-col gap-2">
              <ListaNodos
                proyectoId={proyectoId}
                categoriaId={categoriaId}
                nodos={nodos}
                hijosDe={hijosDe}
                documentosPorTipo={documentosPorTipo}
              />
              <AgregarDocumentoTile
                proyectoId={proyectoId}
                categoriaId={categoriaId}
                subSeccion={sub}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>
        <BotonRenombrar nombre={sub} onClick={() => setEditando(true)} />
      </div>
    </div>
  );
}

function CategoriaBloque({
  proyectoId,
  categoria,
  tipos,
  hijosDe,
  documentosPorTipo,
  presentado,
  dragHandle,
}: {
  proyectoId: string;
  categoria: Categoria;
  tipos: Tipo[];
  hijosDe: (id: string) => Tipo[];
  documentosPorTipo: Map<string, Documento>;
  presentado: (id: string) => boolean;
  dragHandle?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="rounded-md border">
        <RenombrarFila
          inicial={categoria.nombre}
          aviso={AVISO_CATEGORIA}
          onGuardar={(valor) => renombrarCategoriaDocumento(proyectoId, categoria.id, valor)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  const tiposCategoria = tipos.filter((t) => t.categoriaId === categoria.id);
  // El conteo va sobre las raíces: progreso() baja solo a los hijos
  // y cuenta cada documento una vez.
  const raices = tiposCategoria.filter((t) => !t.parentId);
  const { total, presentados } = progreso(raices, hijosDe, presentado);
  const subSecciones = Array.from(
    new Set(raices.filter((t) => t.subSeccion).map((t) => t.subSeccion!))
  );
  const tiposSinSubSeccion = raices.filter((t) => !t.subSeccion);

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 pr-3">
        {dragHandle}
        <AccordionItem value={categoria.id} className="flex-1 border-0">
          <AccordionTrigger className="w-full px-3 py-3 text-sm font-semibold">
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {categoria.nombre}
                  {categoria.porPiso && (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                      Por piso
                    </span>
                  )}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {presentados}/{total}
                </span>
              </div>
              <ProgresoBar total={total} presentados={presentados} />
            </div>
          </AccordionTrigger>
          <AccordionPanel className="px-3">
            <div className="flex flex-col gap-2">
              {subSecciones.length > 0 && (
                <Accordion multiple className="flex flex-col gap-2">
                  <SortableContext
                    items={subSecciones.map((sub) => idSubSeccion(categoria.id, sub))}
                    strategy={verticalListSortingStrategy}
                  >
                    {subSecciones.map((sub) => (
                      <Arrastrable key={sub} id={idSubSeccion(categoria.id, sub)}>
                        {(asa) => (
                          <SubSeccionBloque
                            proyectoId={proyectoId}
                            categoriaId={categoria.id}
                            sub={sub}
                            nodos={raices.filter((t) => t.subSeccion === sub)}
                            hijosDe={hijosDe}
                            documentosPorTipo={documentosPorTipo}
                            presentado={presentado}
                            dragHandle={asa}
                          />
                        )}
                      </Arrastrable>
                    ))}
                  </SortableContext>
                </Accordion>
              )}
              <ListaNodos
                proyectoId={proyectoId}
                categoriaId={categoria.id}
                nodos={tiposSinSubSeccion}
                hijosDe={hijosDe}
                documentosPorTipo={documentosPorTipo}
              />
              <AgregarDocumentoTile proyectoId={proyectoId} categoriaId={categoria.id} />
            </div>
            {categoria.porPiso && tiposCategoria.length === 0 && (
              <p className="pb-2 text-xs text-muted-foreground">
                Se generan solos al guardar la cantidad de pisos del proyecto (botón
                &quot;Editar datos&quot;), o podés agregarlos a mano arriba.
              </p>
            )}
          </AccordionPanel>
        </AccordionItem>
        <BotonRenombrar nombre={categoria.nombre} onClick={() => setEditando(true)} />
        <DeleteButton
          iconOnly
          action={() => eliminarCategoriaDocumento(proyectoId, categoria.id)}
          confirmMessage={`¿Eliminar la categoría "${categoria.nombre}" y todos sus documentos del listado?`}
        />
      </div>
    </div>
  );
}

export function DocumentacionBoard({
  proyectoId,
  categorias,
  tipos,
  documentos,
}: {
  proyectoId: string;
  categorias: Categoria[];
  tipos: Tipo[];
  documentos: Documento[];
}) {
  // Copias locales para que el arrastre se vea al instante; cuando el servidor
  // devuelve el listado nuevo se vuelven a sincronizar con él.
  const [itemsCategorias, setItemsCategorias] = useState(categorias);
  const [prevCategorias, setPrevCategorias] = useState(categorias);
  const [itemsTipos, setItemsTipos] = useState(tipos);
  const [prevTipos, setPrevTipos] = useState(tipos);
  const [, startTransition] = useTransition();

  if (categorias !== prevCategorias) {
    setPrevCategorias(categorias);
    setItemsCategorias(categorias);
  }
  if (tipos !== prevTipos) {
    setPrevTipos(tipos);
    setItemsTipos(tipos);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const documentosPorTipo = new Map(documentos.map((d) => [d.tipoId, d]));
  const presentado = (id: string) => documentosPorTipo.get(id)?.estado === "PRESENTADO";

  // Los subitems vienen mezclados con el resto en la misma lista plana, así
  // que se agrupan una vez por padre y después cada nivel se sirve de acá.
  const hijosPorPadre = new Map<string, Tipo[]>();
  for (const tipo of itemsTipos) {
    if (!tipo.parentId) continue;
    const actuales = hijosPorPadre.get(tipo.parentId);
    if (actuales) actuales.push(tipo);
    else hijosPorPadre.set(tipo.parentId, [tipo]);
  }
  const hijosDe = (id: string) => hijosPorPadre.get(id) ?? [];

  const moverSubSecciones = (categoriaId: string, activo: string, destino: string) => {
    const raices = itemsTipos.filter(
      (t) => t.categoriaId === categoriaId && !t.parentId && t.subSeccion
    );
    const subs = Array.from(new Set(raices.map((t) => t.subSeccion!)));
    const desde = subs.indexOf(activo);
    const hasta = subs.indexOf(destino);
    if (desde === -1 || hasta === -1) return;

    const nuevas = arrayMove(subs, desde, hasta);
    const idsEnOrden = nuevas.flatMap((sub) =>
      raices.filter((t) => t.subSeccion === sub).map((t) => t.id)
    );
    const previos = itemsTipos;
    setItemsTipos(reacomodar(itemsTipos, idsEnOrden));

    startTransition(async () => {
      const resultado = await reordenarSubSeccionesDocumento(proyectoId, categoriaId, nuevas);
      if (resultado?.error) {
        toast.error(resultado.error);
        setItemsTipos(previos);
      }
    });
  };

  const moverCategorias = (activo: string, destino: string) => {
    const desde = itemsCategorias.findIndex((c) => c.id === activo);
    const hasta = itemsCategorias.findIndex((c) => c.id === destino);
    if (desde === -1 || hasta === -1) return;

    const reordenadas = arrayMove(itemsCategorias, desde, hasta);
    const previas = itemsCategorias;
    setItemsCategorias(reordenadas);

    startTransition(async () => {
      const resultado = await reordenarCategoriasDocumento(
        proyectoId,
        reordenadas.map((c) => c.id)
      );
      if (resultado?.error) {
        toast.error(resultado.error);
        setItemsCategorias(previas);
      }
    });
  };

  const moverTipos = (activo: Tipo, destino: Tipo) => {
    // Solo se reordena adentro del mismo nivel: arrastrar un documento a otra
    // categoría o a otro grupo sería moverlo de lugar, no reordenarlo.
    const mismoNivel =
      activo.categoriaId === destino.categoriaId &&
      activo.parentId === destino.parentId &&
      activo.subSeccion === destino.subSeccion;
    if (!mismoNivel) return;

    const hermanos = itemsTipos.filter(
      (t) =>
        t.categoriaId === activo.categoriaId &&
        t.parentId === activo.parentId &&
        t.subSeccion === activo.subSeccion
    );
    const desde = hermanos.findIndex((t) => t.id === activo.id);
    const hasta = hermanos.findIndex((t) => t.id === destino.id);
    if (desde === -1 || hasta === -1) return;

    const idsEnOrden = arrayMove(hermanos, desde, hasta).map((t) => t.id);
    const previos = itemsTipos;
    setItemsTipos(reacomodar(itemsTipos, idsEnOrden));

    startTransition(async () => {
      const resultado = await reordenarTiposDocumento(proyectoId, idsEnOrden);
      if (resultado?.error) {
        toast.error(resultado.error);
        setItemsTipos(previos);
      }
    });
  };

  // Un solo DndContext para todo el árbol, con un SortableContext por nivel:
  // anidar contextos de arrastre haría que el de adentro se coma el gesto del
  // de afuera. Los ids de cada nivel no se pisan, así que acá se resuelve a qué
  // nivel pertenece lo que se soltó y se descartan los cruces entre niveles.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activo = String(active.id);
    const destino = String(over.id);

    if (activo.startsWith("sub:")) {
      if (!destino.startsWith("sub:")) return;
      const origen = leerIdSubSeccion(activo);
      const llegada = leerIdSubSeccion(destino);
      if (origen.categoriaId !== llegada.categoriaId) return;
      moverSubSecciones(origen.categoriaId, origen.nombre, llegada.nombre);
      return;
    }

    if (itemsCategorias.some((c) => c.id === activo)) {
      if (!itemsCategorias.some((c) => c.id === destino)) return;
      moverCategorias(activo, destino);
      return;
    }

    const tipoActivo = itemsTipos.find((t) => t.id === activo);
    const tipoDestino = itemsTipos.find((t) => t.id === destino);
    if (tipoActivo && tipoDestino) moverTipos(tipoActivo, tipoDestino);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {itemsCategorias.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay categorías de documentos. Creá la primera abajo.
          </p>
        ) : (
          <Accordion multiple className="flex flex-col gap-3">
            <SortableContext
              items={itemsCategorias.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {itemsCategorias.map((categoria) => (
                <Arrastrable key={categoria.id} id={categoria.id}>
                  {(asa) => (
                    <CategoriaBloque
                      proyectoId={proyectoId}
                      categoria={categoria}
                      tipos={itemsTipos}
                      hijosDe={hijosDe}
                      documentosPorTipo={documentosPorTipo}
                      presentado={presentado}
                      dragHandle={asa}
                    />
                  )}
                </Arrastrable>
              ))}
            </SortableContext>
          </Accordion>
        )}

        <AgregarCategoriaTile proyectoId={proyectoId} />
      </div>
    </DndContext>
  );
}
