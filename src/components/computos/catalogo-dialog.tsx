"use client";

import { useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
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
import { traerItemsDelCatalogo } from "@/actions/computos";
import { simboloUnidad, type ItemOpcion, type ItemTipoOpcion } from "@/lib/computos";
import { cn } from "@/lib/utils";

/**
 * El catálogo de ítems: el repertorio que el estudio ya computó otras veces.
 *
 * Existe para que arrancar el cómputo de una obra nueva no sea escribir cuarenta
 * nombres de cero. Se marcan los que van y se traen todos juntos.
 *
 * Los que ya están en este cómputo se muestran igual, tildados y apagados, en
 * vez de desaparecer: así se ve de un vistazo qué se trajo y qué falta, que es
 * media revisión del cómputo hecha sin salir de acá.
 */
export function CatalogoDialog({
  proyectoId,
  tipos,
  rubros,
  yaEnComputo,
  trigger,
  onTraidas,
}: {
  proyectoId: string;
  tipos: ItemTipoOpcion[];
  rubros: { id: string; nombre: string }[];
  /** Ids de tipo de catálogo que esta obra ya tiene en el cómputo. */
  yaEnComputo: Set<string>;
  trigger: React.ReactNode;
  onTraidas: (items: ItemOpcion[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (abierto: boolean) => {
    setOpen(abierto);
    if (abierto) {
      setBusqueda("");
      setElegidos(new Set());
    }
  };

  const nombreRubro = (id: string) => rubros.find((r) => r.id === id)?.nombre ?? "Sin rubro";

  const texto = busqueda.trim().toLowerCase();
  const visibles = texto
    ? tipos.filter(
        (t) =>
          t.nombre.toLowerCase().includes(texto) ||
          nombreRubro(t.rubroId).toLowerCase().includes(texto)
      )
    : tipos;

  // Agrupadas por rubro, que es como se lee un cómputo.
  const grupos = rubros
    .map((r) => ({ rubro: r, tipos: visibles.filter((t) => t.rubroId === r.id) }))
    .filter((g) => g.tipos.length > 0);

  const toggle = (id: string) =>
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const traer = () => {
    if (elegidos.size === 0) return;
    startTransition(async () => {
      const result = await traerItemsDelCatalogo(proyectoId, [...elegidos]);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onTraidas(result.items);
      toast.success(
        result.items.length === 1
          ? "Se agregó 1 ítem"
          : `Se agregaron ${result.items.length} ítems`
      );
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Traer ítems del catálogo</DialogTitle>
        </DialogHeader>

        {tipos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            El catálogo está vacío. Se va llenando solo: creá ítems en esta obra y guardá
            en el catálogo los que vayas a repetir.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar ítem o rubro"
                aria-label="Buscar en el catálogo"
                className="pl-8"
                autoFocus
              />
            </div>

            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
              {grupos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No hay ítems que coincidan.
                </p>
              ) : (
                grupos.map(({ rubro, tipos: delRubro }) => (
                  <div key={rubro.id} className="flex flex-col gap-1">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {rubro.nombre}
                    </p>
                    {delRubro.map((t) => {
                      const puesto = yaEnComputo.has(t.id);
                      const marcado = elegidos.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={puesto}
                          onClick={() => toggle(t.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            puesto
                              ? "cursor-default text-muted-foreground"
                              : "hover:border-foreground/25",
                            marcado && "border-foreground/40 bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                              (marcado || puesto) && "border-foreground bg-foreground"
                            )}
                          >
                            {(marcado || puesto) && (
                              <Check className="h-3 w-3 text-background" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{t.nombre}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {puesto ? "ya está" : simboloUnidad(t.unidad)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {elegidos.size === 0
                  ? "Marcá los que quieras traer."
                  : `${elegidos.size} marcado${elegidos.size === 1 ? "" : "s"}`}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={elegidos.size === 0 || pending} onClick={traer}>
                  {pending ? "Agregando..." : "Agregar al cómputo"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
