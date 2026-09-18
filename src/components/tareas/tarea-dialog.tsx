"use client";

import { useState, useTransition } from "react";
import { GripVertical, Plus, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { actualizarTarea, crearTarea, eliminarTarea } from "@/actions/tareas";
import { cn } from "@/lib/utils";
import {
  PRIORIDADES,
  PRIORIDAD_LABELS,
  type OpcionSimple,
  type Prioridad,
  type TareaOpcion,
} from "@/lib/tareas";

const SIN_RUBRO = "";

/**
 * Un sub ítem mientras se lo edita. `id` viene solo si ya existe en la base
 * (para no perder si estaba tildado). `key` es el key de React: los ítems
 * nuevos todavía no tienen id y el índice no sirve porque se reordenan al
 * borrar uno del medio.
 *
 * `completado` no se edita acá —los tildes se ponen desde la lista, no desde
 * el formulario—, pero hace falta para poder esconder lo que ya está hecho.
 */
type ItemBorrador = { key: string; id?: string; texto: string; completado: boolean };

/** Un bloque de sub ítems mientras se lo edita. */
type SeccionBorrador = { key: string; id?: string; titulo: string; items: ItemBorrador[] };

let proximaKey = 0;
const nuevaKey = () => `nuevo-${proximaKey++}`;

/** Un renglón recién agregado: siempre vacío y sin tildar. */
const itemVacio = (): ItemBorrador => ({ key: nuevaKey(), texto: "", completado: false });

const aBorradores = (items: TareaOpcion["items"] | undefined): ItemBorrador[] =>
  items?.map((i) => ({ key: i.id, id: i.id, texto: i.texto, completado: i.completado })) ?? [];

const aSecciones = (secciones: TareaOpcion["secciones"] | undefined): SeccionBorrador[] =>
  secciones?.map((s) => ({
    key: s.id,
    id: s.id,
    titulo: s.titulo,
    items: aBorradores(s.items),
  })) ?? [];

/** Los renglones en blanco se descartan: es normal agregar uno de más. */
const aItemsValidos = (items: ItemBorrador[]) =>
  items.filter((i) => i.texto.trim()).map((i) => ({ id: i.id, texto: i.texto.trim() }));

/**
 * Renglones de sub ítems. Se usa tanto para los sueltos como para los de cada
 * sección: lo único que cambia es de qué lista salen.
 *
 * `items` ya viene filtrado por quien la usa: acá sólo se dibuja lo que hay.
 * `escondidos` es cuántos quedaron afuera por estar hechos, para poder avisar
 * cuando la lista queda vacía y parece que se borró todo.
 */
function ListaItems({
  items,
  escondidos = 0,
  onCambiar,
  onQuitar,
  onAgregar,
}: {
  items: ItemBorrador[];
  escondidos?: number;
  onCambiar: (key: string, texto: string) => void;
  onQuitar: (key: string) => void;
  onAgregar: () => void;
}) {
  return (
    <>
      {items.map((sub, i) => (
        <div key={sub.key} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {i + 1}.
          </span>
          <Input
            value={sub.texto}
            onChange={(e) => onCambiar(sub.key, e.target.value)}
            placeholder="Ej. Pedir cotización a tres proveedores"
            // Tachado igual que en la lista, para que se note de un vistazo
            // cuál de los renglones que se están viendo ya está hecho. Se
            // sigue pudiendo corregir el texto: el tilde no lo congela.
            className={cn(sub.completado && "text-muted-foreground line-through")}
            // Enter agrega otro renglón en vez de mandar el formulario: se
            // cargan varios seguidos.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAgregar();
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar sub ítem"
            onClick={() => onQuitar(sub.key)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {/* Sólo cuando no quedó ningún renglón a la vista: si hay alguno, el
          contador de arriba ya explica que falta ver el resto. */}
      {items.length === 0 && escondidos > 0 && (
        <p className="pl-7 text-xs text-muted-foreground">
          {escondidos === 1 ? "El único sub ítem ya está hecho." : `Los ${escondidos} sub ítems ya están hechos.`}
        </p>
      )}
    </>
  );
}

/**
 * Una sección con su título y sus sub ítems, agarrable de la manija para
 * reordenarla entre las demás.
 *
 * El arrastre va solo desde la manija y no desde todo el bloque: adentro hay
 * campos de texto, y si el bloque entero fuera el área de agarre no se podría
 * seleccionar lo que uno escribe.
 */
function SeccionBloque({
  seccion,
  arrastrable,
  verHechos,
  onCambiarTitulo,
  onQuitar,
  onCambiarItem,
  onQuitarItem,
  onAgregarItem,
}: {
  seccion: SeccionBorrador;
  arrastrable: boolean;
  /** Si está en false, los sub ítems ya tildados no se dibujan. */
  verHechos: boolean;
  onCambiarTitulo: (titulo: string) => void;
  onQuitar: () => void;
  onCambiarItem: (itemKey: string, texto: string) => void;
  onQuitarItem: (itemKey: string) => void;
  onAgregarItem: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: seccion.key,
    disabled: !arrastrable,
  });

  // La sección se dibuja siempre, aunque no le quede nada a la vista: el
  // título y el botón de agregar son justamente lo que se viene a usar acá.
  const visibles = verHechos ? seccion.items : seccion.items.filter((i) => !i.completado);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border bg-background p-2.5",
        isDragging && "relative z-10 opacity-80 shadow-lg"
      )}
    >
      <div className="flex items-center gap-2">
        {arrastrable && (
          <button
            type="button"
            aria-label="Arrastrar para reordenar la sección"
            className="shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Input
          value={seccion.titulo}
          onChange={(e) => onCambiarTitulo(e.target.value)}
          placeholder="Nombre de la sección. Ej. Documentación"
          className="font-medium"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar sección"
          onClick={onQuitar}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ListaItems
        items={visibles}
        escondidos={seccion.items.length - visibles.length}
        onCambiar={onCambiarItem}
        onQuitar={onQuitarItem}
        onAgregar={onAgregarItem}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onAgregarItem}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar sub ítem
      </Button>
    </div>
  );
}

export function TareaDialog({
  proyectoId,
  proyectos,
  rubros,
  usuarios,
  item,
  trigger,
  onSaved,
  onDeleted,
}: {
  /** Obra fija (pestaña de un proyecto). Si no viene, se elige con el <Select>. */
  proyectoId?: string;
  /** Obras entre las que elegir cuando no hay `proyectoId` fijo. */
  proyectos?: OpcionSimple[];
  rubros: OpcionSimple[];
  usuarios: OpcionSimple[];
  item?: TareaOpcion;
  trigger: React.ReactNode;
  onSaved: (tarea: TareaOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [proyecto, setProyecto] = useState(item?.proyectoId ?? proyectoId ?? "");
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [rubro, setRubro] = useState(item?.rubroId ?? SIN_RUBRO);
  const [prioridad, setPrioridad] = useState<Prioridad>(item?.prioridad ?? "MEDIA");
  const [asignados, setAsignados] = useState<string[]>(
    () => item?.asignados.map((a) => a.id) ?? []
  );
  const [items, setItems] = useState<ItemBorrador[]>(() => aBorradores(item?.items));
  const [secciones, setSecciones] = useState<SeccionBorrador[]>(() => aSecciones(item?.secciones));
  /**
   * Si se muestran también los sub ítems ya tildados. Arranca apagado, igual
   * que en la lista: al abrir una tarea a medio hacer lo que se viene a tocar
   * es lo que falta, y los hechos sólo estiran el formulario.
   *
   * Esconderlos es sólo de la vista: siguen en `items` / `secciones` con su id,
   * así que se guardan igual y no se pierde ni el texto ni el tilde.
   */
  const [verHechos, setVerHechos] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setError(undefined);
      setProyecto(item?.proyectoId ?? proyectoId ?? "");
      setTitulo(item?.titulo ?? "");
      setDescripcion(item?.descripcion ?? "");
      setRubro(item?.rubroId ?? SIN_RUBRO);
      setPrioridad(item?.prioridad ?? "MEDIA");
      setAsignados(item?.asignados.map((a) => a.id) ?? []);
      setItems(aBorradores(item?.items));
      setSecciones(aSecciones(item?.secciones));
      setVerHechos(false);
    }
  };

  const agregarItem = () => setItems((prev) => [...prev, itemVacio()]);
  const quitarItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const cambiarItem = (key: string, texto: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, texto } : i)));

  // Las secciones y sus ítems se editan sobre la misma lista: `mapearSeccion`
  // evita repetir el recorrido en cada handler.
  const mapearSeccion = (key: string, fn: (s: SeccionBorrador) => SeccionBorrador) =>
    setSecciones((prev) => prev.map((s) => (s.key === key ? fn(s) : s)));

  // Una sección nueva arranca con un renglón vacío: nadie crea una sección para
  // dejarla sin nada adentro.
  //
  // Va arriba de todo y no al final: el botón que la crea está justo encima de
  // la lista, así que apareciendo primera queda a la vista y con el cursor
  // cerca. Al final, en una tarea con varias secciones, nacía fuera de
  // pantalla y había que ir a buscarla. El orden en que quedan es el que se
  // guarda, así que además es la manera de poner una sección adelante.
  const agregarSeccion = () =>
    setSecciones((prev) => [{ key: nuevaKey(), titulo: "", items: [itemVacio()] }, ...prev]);
  const quitarSeccion = (key: string) =>
    setSecciones((prev) => prev.filter((s) => s.key !== key));
  const cambiarTituloSeccion = (key: string, titulo: string) =>
    mapearSeccion(key, (s) => ({ ...s, titulo }));
  const agregarItemSeccion = (key: string) =>
    mapearSeccion(key, (s) => ({ ...s, items: [...s.items, itemVacio()] }));
  const quitarItemSeccion = (key: string, itemKey: string) =>
    mapearSeccion(key, (s) => ({ ...s, items: s.items.filter((i) => i.key !== itemKey) }));
  const cambiarItemSeccion = (key: string, itemKey: string, texto: string) =>
    mapearSeccion(key, (s) => ({
      ...s,
      items: s.items.map((i) => (i.key === itemKey ? { ...i, texto } : i)),
    }));

  // Un mínimo de recorrido antes de considerar que es un arrastre: si no, un
  // clic en la manija ya empezaría a mover el bloque.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // El orden en el que quedan es el que se guarda: el server action numera las
  // secciones por su posición en el array.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSecciones((prev) => {
      const desde = prev.findIndex((s) => s.key === active.id);
      const hasta = prev.findIndex((s) => s.key === over.id);
      if (desde === -1 || hasta === -1) return prev;
      return arrayMove(prev, desde, hasta);
    });
  };

  const toggleAsignado = (userId: string) => {
    setAsignados((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
  };

  // Cuántos sub ítems ya están tildados, contando sueltos y de secciones: es
  // lo que se esconde, y el número que muestra el botón.
  const hechos = [...items, ...secciones.flatMap((s) => s.items)].filter(
    (i) => i.completado
  ).length;
  const sueltosVisibles = verHechos ? items : items.filter((i) => !i.completado);

  // El <Select> de Base UI necesita el mapa value → label para mostrar el
  // texto del valor elegido en el trigger.
  const rubroItems = Object.fromEntries([
    [SIN_RUBRO, "Sin rubro"],
    ...rubros.map((r) => [r.id, r.nombre]),
  ]);
  const proyectoItems = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!titulo.trim()) {
      setError("Ingresá un título para la tarea.");
      return;
    }
    if (!item && !proyecto) {
      setError("Elegí una obra.");
      return;
    }

    startTransition(async () => {
      const datos = {
        titulo,
        descripcion,
        rubroId: rubro || undefined,
        prioridad,
        asignadoIds: asignados,
        // Los renglones que quedaron en blanco se descartan en vez de dar
        // error: es normal agregar uno de más y no llenarlo. Con las secciones
        // igual: una sin título se va entera, con sus ítems.
        items: aItemsValidos(items),
        secciones: secciones
          .filter((s) => s.titulo.trim())
          .map((s) => ({ id: s.id, titulo: s.titulo.trim(), items: aItemsValidos(s.items) })),
      };
      const result = item
        ? await actualizarTarea(item.id, datos)
        : await crearTarea({ ...datos, proyectoId: proyecto });

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.item);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* La obra no se puede cambiar una vez creada: mover una tarea de
              obra no es algo que haga falta y complica los revalidate. */}
          {!item && !proyectoId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="tareaProyecto">Obra</Label>
              <Select
                value={proyecto}
                onValueChange={(v) => setProyecto(v ?? "")}
                items={proyectoItems}
              >
                <SelectTrigger id="tareaProyecto" className="w-full">
                  <SelectValue placeholder="Elegí una obra" />
                </SelectTrigger>
                <SelectContent>
                  {(proyectos ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {item && (
            <div className="flex flex-col gap-1">
              <Label>Obra</Label>
              <p className="text-sm font-medium">{item.proyectoNombre}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="tareaTitulo">Título</Label>
            <Input
              id="tareaTitulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Pedir presupuesto de aberturas"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tareaDescripcion">Descripción (opcional)</Label>
            <Textarea
              id="tareaDescripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="De qué se trata la tarea"
              rows={3}
            />
          </div>

          {/* Checklist: los pasos que se van tildando después desde la lista.
              Acá solo se escriben, no se tildan.

              Los sub ítems sueltos van arriba y las secciones abajo, en el
              mismo orden en que se ven en la lista. Las secciones son
              opcionales: una tarea corta se resuelve con sueltos nomás. */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {/* El interruptor va pegado al título del bloque porque manda
                  sobre todo el checklist, sueltos y secciones por igual. */}
              <div className="flex items-center justify-between gap-2">
                <Label>Sub ítems (opcional)</Label>
                {hechos > 0 && (
                  <button
                    type="button"
                    onClick={() => setVerHechos((prev) => !prev)}
                    aria-expanded={verHechos}
                    className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {verHechos
                      ? "Ocultar hechos"
                      : `Ver ${hechos} hecho${hechos === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>
              {items.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <ListaItems
                    items={sueltosVisibles}
                    escondidos={items.length - sueltosVisibles.length}
                    onCambiar={cambiarItem}
                    onQuitar={quitarItem}
                    onAgregar={agregarItem}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar sub ítem
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={agregarSeccion}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar sección
                </Button>
              </div>
            </div>

            {/* Las secciones se arrastran de a bloque entero (título + sus sub
                ítems) para reordenarlas. Con una sola no hay nada que ordenar,
                así que ahí ni aparece la manija. */}
            {secciones.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={secciones.map((s) => s.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-3">
                    {secciones.map((seccion) => (
                      <SeccionBloque
                        key={seccion.key}
                        seccion={seccion}
                        arrastrable={secciones.length > 1}
                        verHechos={verHechos}
                        onCambiarTitulo={(titulo) => cambiarTituloSeccion(seccion.key, titulo)}
                        onQuitar={() => quitarSeccion(seccion.key)}
                        onCambiarItem={(itemKey, texto) =>
                          cambiarItemSeccion(seccion.key, itemKey, texto)
                        }
                        onQuitarItem={(itemKey) => quitarItemSeccion(seccion.key, itemKey)}
                        onAgregarItem={() => agregarItemSeccion(seccion.key)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <p className="text-xs text-muted-foreground">
              Cuando tildes todos los sub ítems, se te va a preguntar si la tarea va a revisión o
              si la das por completada.
            </p>
          </div>

          {/* El rubro va a lo ancho de todo el diálogo: hay nombres largos
              ("Movimiento de suelos y demolición") que en media columna
              quedaban cortados. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="tareaRubro">Rubro</Label>
            <Select
              value={rubro}
              onValueChange={(v) => setRubro(v ?? SIN_RUBRO)}
              items={rubroItems}
            >
              <SelectTrigger id="tareaRubro" className="w-full">
                <SelectValue placeholder="Sin rubro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_RUBRO}>Sin rubro</SelectItem>
                {rubros.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tareaPrioridad">Prioridad</Label>
            <Select
              value={prioridad}
              onValueChange={(v) => setPrioridad(v as Prioridad)}
              items={PRIORIDAD_LABELS}
            >
              <SelectTrigger id="tareaPrioridad" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Asignada a</Label>
            {usuarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay usuarios cargados.</p>
            ) : (
              <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
                {usuarios.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-default items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Checkbox
                      checked={asignados.includes(u.id)}
                      onCheckedChange={() => toggleAsignado(u.id)}
                    />
                    <span className="min-w-0 truncate">{u.nombre}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Podés asignar la tarea a más de una persona.
            </p>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item ? (
              <DeleteButton
                action={() => eliminarTarea(item.id)}
                confirmMessage={`¿Eliminar la tarea "${item.titulo}"? Esta acción no se puede deshacer.`}
                onDeleted={() => {
                  setOpen(false);
                  onDeleted?.(item.id);
                }}
              />
            ) : (
              <div />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
