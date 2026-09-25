"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteButton } from "@/components/ui/delete-button";
import { actualizarItem, crearItem, eliminarItem } from "@/actions/computos";
import { UNIDADES, UNIDAD_INFO, type ItemOpcion, type UnidadComputo } from "@/lib/computos";
import { cn } from "@/lib/utils";

type OpcionRubro = { id: string; nombre: string; subrubros: { id: string; nombre: string }[] };

const SIN_SUBRUBRO = "";

/**
 * Alta y edición de un ítem del cómputo.
 *
 * Dos campos mandan acá y los dos están resueltos para que no haya que pensar:
 *
 * El subrubro va como botones y no como desplegable porque en la práctica son
 * dos —MANO DE OBRA y MATERIALES— y son la decisión más importante del ítem:
 * dicen en qué etapa del cómputo entra y contra qué gasto se va a comparar
 * después. Dos clicks para elegir entre dos opciones era una lista desplegable
 * de más.
 *
 * La unidad no es un desplegable seco: debajo se lee qué se computa con ella y
 * qué medidas va a pedir. Elegir mal la unidad es el error que después obliga a
 * rehacer las mediciones, así que la pantalla lo explica antes en vez de
 * dejarlo descubrir después.
 */
export function ItemDialog({
  proyectoId,
  rubros,
  item,
  rubroSugerido,
  subrubroSugerido,
  trigger,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  rubros: OpcionRubro[];
  item?: ItemOpcion;
  /** Rubro con el que arranca el alta, cuando se crea desde un grupo. */
  rubroSugerido?: string;
  /** Subrubro con el que arranca el alta, cuando se crea desde un grupo. */
  subrubroSugerido?: string | null;
  trigger: React.ReactNode;
  onSaved: (item: ItemOpcion) => void;
  onDeleted?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [unidad, setUnidad] = useState<UnidadComputo>(item?.unidad ?? "M2");
  const [rubroId, setRubroId] = useState(item?.rubroId ?? rubroSugerido ?? "");
  const [subrubroId, setSubrubroId] = useState(
    item?.subrubroId ?? subrubroSugerido ?? SIN_SUBRUBRO
  );
  const [notas, setNotas] = useState(item?.notas ?? "");

  const handleOpenChange = (abierto: boolean) => {
    setOpen(abierto);
    if (!abierto) return;
    // Al reabrir se vuelve a lo guardado: un diálogo que se cerró sin guardar no
    // tiene que dejar restos la próxima vez.
    setError(undefined);
    setNombre(item?.nombre ?? "");
    setUnidad(item?.unidad ?? "M2");
    setRubroId(item?.rubroId ?? rubroSugerido ?? "");
    setSubrubroId(item?.subrubroId ?? subrubroSugerido ?? SIN_SUBRUBRO);
    setNotas(item?.notas ?? "");
  };

  const rubroActual = rubros.find((r) => r.id === rubroId);
  const subrubros = rubroActual?.subrubros ?? [];

  // El <Select> de Base UI necesita el mapa value → label para mostrar el texto
  // del valor elegido en el trigger.
  const rubroItems = Object.fromEntries(rubros.map((r) => [r.id, r.nombre]));
  const unidadItems = Object.fromEntries(
    UNIDADES.map((u) => [u, `${UNIDAD_INFO[u].nombre} (${UNIDAD_INFO[u].simbolo})`])
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!nombre.trim()) {
      setError("Poné un nombre para el ítem.");
      return;
    }
    if (!rubroId) {
      setError("Elegí un rubro.");
      return;
    }

    const datos = {
      nombre,
      unidad,
      rubroId,
      subrubroId: subrubroId || null,
      notas: notas || null,
    };

    startTransition(async () => {
      const result = item
        ? await actualizarItem(proyectoId, item.id, datos)
        : await crearItem(proyectoId, datos);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.item);
      setOpen(false);
    });
  };

  const info = UNIDAD_INFO[unidad];
  const cambiaUnidad = item && item.unidad !== unidad && item.mediciones.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="itemNombre">Ítem</Label>
            <Input
              id="itemNombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Mampostería de ladrillo hueco 12"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="itemRubro">Rubro</Label>
            <Select
              value={rubroId}
              onValueChange={(v) => {
                setRubroId(v ?? "");
                // El subrubro cuelga del rubro: si cambia el rubro, el que
                // estaba elegido ya no existe en la lista nueva.
                setSubrubroId(SIN_SUBRUBRO);
              }}
              items={rubroItems}
            >
              <SelectTrigger id="itemRubro" className="w-full">
                <SelectValue placeholder="Elegí un rubro" />
              </SelectTrigger>
              <SelectContent>
                {rubros.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subrubros.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>¿Qué se computa?</Label>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: SIN_SUBRUBRO, nombre: "General" }, ...subrubros].map((s) => (
                  <button
                    key={s.id || "general"}
                    type="button"
                    onClick={() => setSubrubroId(s.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      subrubroId === s.id
                        ? "border-foreground bg-foreground text-background"
                        : "hover:bg-muted"
                    )}
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                La mano de obra se computa antes, para presupuestar al contratista. Los
                materiales después, y pueden salir de una cuenta sobre lo ya computado.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="itemUnidad">Se mide en</Label>
            <Select
              value={unidad}
              onValueChange={(v) => setUnidad(v as UnidadComputo)}
              items={unidadItems}
            >
              <SelectTrigger id="itemUnidad" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIDAD_INFO[u].nombre} ({UNIDAD_INFO[u].simbolo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {info.ayuda}{" "}
              {info.dimensiones.length > 0
                ? `Cada fila pide ${info.dimensiones.join(", ")}.`
                : "Cada fila pide sólo la cantidad."}
            </p>
            {/* Cambiar la unidad no borra nada (ver actualizarItem), pero sí
                cambia cuáles de las medidas cargadas cuentan para el total, y
                eso conviene decirlo antes de guardar. */}
            {cambiaUnidad && (
              <p className="text-xs text-warning">
                Estás cambiando la unidad de un ítem que ya tiene {item.mediciones.length}{" "}
                filas. No se borra ninguna medida, pero el total se recalcula con las que
                use la unidad nueva.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="itemNotas">Notas</Label>
            <Textarea
              id="itemNotas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Espesor, terminación, lo que haga falta aclarar."
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {item && onDeleted ? (
              <DeleteButton
                action={async () => {
                  const result = await eliminarItem(proyectoId, item.id);
                  if (!result.success) return { error: result.error };
                  return { success: true };
                }}
                confirmMessage={`¿Eliminar "${item.nombre}" y sus ${item.mediciones.length} filas?`}
                onDeleted={() => {
                  onDeleted(item.id);
                  setOpen(false);
                  toast.success("Ítem eliminado");
                }}
              />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
