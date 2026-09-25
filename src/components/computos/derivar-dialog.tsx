"use client";

import { useState, useTransition } from "react";

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
import { crearDerivada } from "@/actions/computos";
import {
  creaCiclo,
  formatCantidad,
  parseMedida,
  simboloUnidad,
  type ItemOpcion,
  type MedicionOpcion,
} from "@/lib/computos";
import { cn } from "@/lib/utils";

/**
 * Arma una fila que sale de la cantidad de otro ítem.
 *
 * Es la segunda etapa del cómputo puesta en una sola pantalla: los ladrillos no
 * se vuelven a medir, se calculan sobre los m² de mampostería que ya están
 * computados. El diálogo muestra la cuenta armándose en vivo —"1.240 m² × 15 +
 * 5% = 19.530 un"— porque el coeficiente solo no dice nada y el número final sí.
 *
 * Los ítems que ya dependen de éste no se ofrecen: derivar en círculo daría una
 * cuenta que se pide a sí misma. Se filtra acá además de validarse en el
 * servidor, así el error se evita en vez de explicarse.
 */
export function DerivarDialog({
  proyectoId,
  item,
  items,
  totales,
  trigger,
  onCreated,
}: {
  proyectoId: string;
  /** El ítem al que se le agrega la fila. */
  item: ItemOpcion;
  /** Todo el cómputo, para elegir origen y descartar los que harían ciclo. */
  items: ItemOpcion[];
  totales: Map<string, number>;
  trigger: React.ReactNode;
  onCreated: (medicion: MedicionOpcion) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [origenId, setOrigenId] = useState("");
  const [coeficiente, setCoeficiente] = useState("");
  const [desperdicio, setDesperdicio] = useState("");

  const handleOpenChange = (abierto: boolean) => {
    setOpen(abierto);
    if (!abierto) return;
    setError(undefined);
    setOrigenId("");
    setCoeficiente("");
    setDesperdicio("");
  };

  // Candidatos: todo lo computado de la obra menos el ítem mismo y menos lo que
  // ya depende de él. Se listan primero los que tienen cantidad, que son los
  // únicos de los que hoy saldría un número.
  const candidatos = items
    .filter((i) => i.id !== item.id && !creaCiclo(items, item.id, i.id))
    .sort((a, b) => {
      const ta = totales.get(a.id) ?? 0;
      const tb = totales.get(b.id) ?? 0;
      if (ta > 0 !== tb > 0) return ta > 0 ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });

  const origen = candidatos.find((i) => i.id === origenId);
  const totalOrigen = origen ? (totales.get(origen.id) ?? 0) : 0;
  const coef = parseMedida(coeficiente);
  const desp = desperdicio.trim() === "" ? null : parseMedida(desperdicio);
  const resultado =
    origen && coef !== null ? totalOrigen * coef * (1 + (desp ?? 0) / 100) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!origen) {
      setError("Elegí de qué ítem sale.");
      return;
    }
    if (coef === null) {
      setError("Poné cuánto entra por cada unidad del origen.");
      return;
    }

    startTransition(async () => {
      const result = await crearDerivada(proyectoId, item.id, {
        origenId: origen.id,
        cantidad: coef,
        desperdicio: desp,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated(result.medicion);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Calcular sobre lo computado</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            En vez de medir <span className="font-medium text-foreground">{item.nombre}</span>{" "}
            de nuevo, sacalo de algo que ya computaste.
          </p>

          <div className="flex flex-col gap-2">
            <Label>Sale de</Label>
            {candidatos.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Todavía no hay otro ítem del que se pueda sacar. Computá primero el trabajo
                (la mampostería, el revoque) y después volvé acá.
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-1">
                {candidatos.map((c) => {
                  const total = totales.get(c.id) ?? 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOrigenId(c.id)}
                      className={cn(
                        "flex items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors",
                        origenId === c.id ? "bg-foreground text-background" : "hover:bg-muted"
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          origenId === c.id
                            ? "text-background/70"
                            : total > 0
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                        )}
                      >
                        {total > 0
                          ? `${formatCantidad(total)} ${simboloUnidad(c.unidad)}`
                          : "sin computar"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="derivadaCoef">
                {simboloUnidad(item.unidad)} por{" "}
                {origen ? simboloUnidad(origen.unidad) : "unidad"}
              </Label>
              <Input
                id="derivadaCoef"
                value={coeficiente}
                onChange={(e) => setCoeficiente(e.target.value)}
                placeholder="15"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="derivadaDesp">Desperdicio (%)</Label>
              <Input
                id="derivadaDesp"
                value={desperdicio}
                onChange={(e) => setDesperdicio(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
          </div>

          {/* La cuenta a la vista mientras se escribe. Un coeficiente suelto no
              se puede revisar; el resultado sí, y es donde se nota si uno se
              equivocó de unidad o se le fue una coma. */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            {resultado === null ? (
              <span className="text-muted-foreground">
                Elegí el origen y el coeficiente para ver la cuenta.
              </span>
            ) : (
              <span className="tabular-nums">
                {formatCantidad(totalOrigen)} {simboloUnidad(origen!.unidad)} ×{" "}
                {formatCantidad(coef!)}
                {desp ? ` + ${formatCantidad(desp)}%` : ""} ={" "}
                <span className="font-semibold">
                  {formatCantidad(resultado)} {simboloUnidad(item.unidad)}
                </span>
              </span>
            )}
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || candidatos.length === 0}>
              {pending ? "Agregando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
