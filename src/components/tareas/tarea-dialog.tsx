"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
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
 */
type ItemBorrador = { key: string; id?: string; texto: string };

let proximaKey = 0;
const nuevaKey = () => `nuevo-${proximaKey++}`;

const aBorradores = (items: TareaOpcion["items"] | undefined): ItemBorrador[] =>
  items?.map((i) => ({ key: i.id, id: i.id, texto: i.texto })) ?? [];

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
    }
  };

  const agregarItem = () => setItems((prev) => [...prev, { key: nuevaKey(), texto: "" }]);
  const quitarItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const cambiarItem = (key: string, texto: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, texto } : i)));

  const toggleAsignado = (userId: string) => {
    setAsignados((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
  };

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
        // error: es normal agregar uno de más y no llenarlo.
        items: items
          .filter((i) => i.texto.trim())
          .map((i) => ({ id: i.id, texto: i.texto.trim() })),
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

          {/* Checklist: los pasos sueltos que se van tildando después desde la
              lista. Acá solo se escriben, no se tildan. */}
          <div className="flex flex-col gap-2">
            <Label>Sub ítems (opcional)</Label>
            {items.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {items.map((sub, i) => (
                  <div key={sub.key} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {i + 1}.
                    </span>
                    <Input
                      value={sub.texto}
                      onChange={(e) => cambiarItem(sub.key, e.target.value)}
                      placeholder="Ej. Pedir cotización a tres proveedores"
                      // Enter agrega otro renglón en vez de mandar el
                      // formulario: se cargan varios seguidos.
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarItem();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar sub ítem"
                      onClick={() => quitarItem(sub.key)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={agregarItem}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar sub ítem
            </Button>
            <p className="text-xs text-muted-foreground">
              Cuando tildes todos los sub ítems, la tarea se marca completada sola.
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
