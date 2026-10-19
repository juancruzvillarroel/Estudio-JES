"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  abrirInformePresupuesto,
  type SeccionPresupuesto,
} from "@/components/computos/informe-presupuesto";
import {
  simboloUnidad,
  TIPO_COMPUTO_LABEL,
  type ItemOpcion,
  type SeccionOpcion,
  type TipoComputo,
} from "@/lib/computos";

/** Marca y desmarca un id dentro de un conjunto. */
function alternar(conjunto: Set<string>, id: string) {
  const next = new Set(conjunto);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Un renglón de checkbox con su etiqueta, clickeable entero. */
function Opcion({
  marcado,
  onCambio,
  children,
  detalle,
}: {
  marcado: boolean;
  onCambio: () => void;
  children: React.ReactNode;
  detalle?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-muted">
      <Checkbox checked={marcado} onCheckedChange={onCambio} />
      <span className="min-w-0 flex-1 truncate text-sm">{children}</span>
      {detalle && <span className="shrink-0 text-xs text-muted-foreground">{detalle}</span>}
    </label>
  );
}

/**
 * Elegir qué ítems de este cómputo van en el pedido de presupuesto.
 *
 * Es un diálogo por cómputo —un rubro de un lado— y no por obra: el pedido
 * que se le manda al corralón de materiales no tiene nada que ver con el que
 * se le manda al gremio de mano de obra, aunque sean del mismo rubro.
 *
 * Arranca todo marcado, por la misma razón que el informe del rubro: el
 * pedido normal es "todo lo que hay cargado", y lo que se destilda es la
 * excepción —ya se cotizó una parte, o esta vez sólo hace falta una.
 */
export function PresupuestarDialog({
  proyectoNombre,
  rubroNombre,
  tipo,
  modificadoEl,
  secciones,
  items,
  totales,
}: {
  proyectoNombre: string;
  rubroNombre: string;
  tipo: TipoComputo;
  /** Cuándo se tocó por última vez este lado del cómputo. Null = nunca. */
  modificadoEl: Date | null;
  /** Las secciones de este rubro, de este lado. */
  secciones: SeccionOpcion[];
  /** Los ítems de esas secciones. */
  items: ItemOpcion[];
  /** Los totales de toda la obra, para resolver ítems derivados. */
  totales: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const delLado = [...secciones].sort((a, b) => a.orden - b.orden);
  const itemsDe = (seccionId: string | null) =>
    items.filter((i) => i.seccionId === seccionId).sort((a, b) => a.orden - b.orden);

  const [itemsElegidos, setItemsElegidos] = useState<Set<string>>(
    new Set(items.map((i) => i.id))
  );

  const abrir = (abierto: boolean) => {
    setOpen(abierto);
    // Al reabrir se vuelve a "todo", que es el pedido normal: un diálogo que
    // recuerda lo que se destildó la vez pasada manda un pedido de menos sin
    // que se note.
    if (abierto) setItemsElegidos(new Set(items.map((i) => i.id)));
  };

  const armarSecciones = (): SeccionPresupuesto[] =>
    delLado.map((seccion) => ({
      nombre: seccion.nombre,
      items: itemsDe(seccion.id).filter((i) => itemsElegidos.has(i.id)),
    }));

  const listo = armarSecciones();
  const imprimibles = listo.filter((s) => s.items.length > 0);
  const totalElegidos = imprimibles.reduce((acc, s) => acc + s.items.length, 0);

  const generar = () => {
    abrirInformePresupuesto({
      proyectoNombre,
      rubroNombre,
      tipo,
      modificadoEl,
      secciones: imprimibles,
      totales,
    });
    setOpen(false);
  };

  if (items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger render={<Button type="button" variant="default" size="sm" />}>
        <ClipboardList className="h-3.5 w-3.5" />
        Presupuestar
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Presupuestar {rubroNombre} · {TIPO_COMPUTO_LABEL[tipo]}
          </DialogTitle>
          <DialogDescription>
            Se abre en una pestaña nueva con el diálogo de impresión; desde ahí
            se guarda como PDF. Sale con la cantidad final de compra de cada
            ítem, lista para que el proveedor la cotice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {delLado.map((seccion) => {
            const deSeccion = itemsDe(seccion.id);
            if (deSeccion.length === 0) return null;
            const cuantas = deSeccion.filter((i) => itemsElegidos.has(i.id)).length;
            return (
              <div key={seccion.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {seccion.nombre}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setItemsElegidos((prev) => {
                        const next = new Set(prev);
                        const marcarTodas = cuantas !== deSeccion.length;
                        deSeccion.forEach((i) =>
                          marcarTodas ? next.add(i.id) : next.delete(i.id)
                        );
                        return next;
                      })
                    }
                    className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {cuantas === deSeccion.length ? "Ninguna" : "Todas"}
                  </button>
                </div>
                <div className="flex flex-col rounded-md border p-1">
                  {deSeccion.map((item) => (
                    <Opcion
                      key={item.id}
                      marcado={itemsElegidos.has(item.id)}
                      detalle={simboloUnidad(item.unidad)}
                      onCambio={() => setItemsElegidos((prev) => alternar(prev, item.id))}
                    >
                      {item.nombre}
                    </Opcion>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {totalElegidos === 0
              ? "No queda nada para pedir."
              : `${totalElegidos} ${totalElegidos === 1 ? "ítem" : "ítems"}`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={totalElegidos === 0} onClick={generar}>
              <ClipboardList className="h-4 w-4" />
              Generar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
