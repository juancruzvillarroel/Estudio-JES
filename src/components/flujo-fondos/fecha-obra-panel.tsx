"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateFechaObra } from "@/actions/proyectos";
import { claveMes, formatMesLargo, sumarMeses } from "@/lib/presupuesto";

/**
 * Arranque y largo de la obra. Es el único dato que la solapa Presupuesto
 * necesita antes de poder mostrar algo: sin él no hay meses contra los cuales
 * ubicar las barras.
 *
 * Los dos campos se guardan juntos y se validan juntos (o los dos cargados o
 * los dos vacíos) porque uno solo no define ninguna línea de tiempo, y dejar
 * pasar la mitad obligaría a la solapa Presupuesto a explicar un estado que no
 * tiene por qué existir.
 */
export function FechaObraPanel({
  proyectoId,
  fechaInicio,
  duracionMeses,
  onChange,
}: {
  proyectoId: string;
  /** "AAAA-MM-DD" o null si todavía no se cargó. */
  fechaInicio: string | null;
  duracionMeses: number | null;
  /** Avisa al contenedor para que la solapa Presupuesto se rearme sin recargar. */
  onChange?: (valor: { fechaInicio: string | null; duracionMeses: number | null }) => void;
}) {
  const [fecha, setFecha] = useState(fechaInicio ?? "");
  const [meses, setMeses] = useState(duracionMeses != null ? String(duracionMeses) : "");
  const [prev, setPrev] = useState({ fechaInicio, duracionMeses });
  const [error, setError] = useState<string | undefined>();
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  if (fechaInicio !== prev.fechaInicio || duracionMeses !== prev.duracionMeses) {
    setPrev({ fechaInicio, duracionMeses });
    setFecha(fechaInicio ?? "");
    setMeses(duracionMeses != null ? String(duracionMeses) : "");
  }

  // Se calcula sobre lo que está escrito, no sobre lo guardado, para que el mes
  // de fin se actualice mientras se tipea: es la forma de darse cuenta de que
  // 24 meses no era lo que uno tenía en la cabeza antes de apretar Guardar.
  const cantidad = Number(meses);
  const finPrevisto =
    fecha && Number.isInteger(cantidad) && cantidad >= 1
      ? formatMesLargo(sumarMeses(claveMes(fecha), cantidad - 1))
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setGuardado(false);

    const fechaLimpia = fecha.trim();
    const mesesLimpio = meses.trim();
    const vacio = fechaLimpia === "" && mesesLimpio === "";

    if (!vacio && (fechaLimpia === "" || mesesLimpio === "")) {
      setError("Cargá las dos cosas, o dejá las dos vacías para borrarlas.");
      return;
    }
    if (!vacio && (!Number.isInteger(cantidad) || cantidad < 1)) {
      setError("La duración tiene que ser un número entero de meses.");
      return;
    }

    startTransition(async () => {
      const result = await updateFechaObra(proyectoId, {
        fechaInicio: vacio ? null : fechaLimpia,
        duracionMeses: vacio ? null : cantidad,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChange?.({ fechaInicio: result.fechaInicio, duracionMeses: result.duracionMeses });
      setGuardado(true);
    });
  };

  return (
    <div className="rounded-md border p-4">
      <div>
        <h3 className="text-sm font-semibold">Inicio y duración de la obra</h3>
        <p className="text-xs text-muted-foreground">
          Definen la línea de tiempo del presupuesto: cada rubro se ubica en un tramo de estos
          meses para proyectar el flujo de egresos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fechaInicioObra">Fecha de inicio</Label>
          <Input
            id="fechaInicioObra"
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              setGuardado(false);
            }}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="duracionMesesObra">Duración (meses)</Label>
          <Input
            id="duracionMesesObra"
            inputMode="numeric"
            placeholder="Ej. 24"
            value={meses}
            onChange={(e) => {
              setMeses(e.target.value);
              setGuardado(false);
            }}
            className="w-28"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {guardado && !pending && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            Guardado
          </span>
        )}
        {error && <span className="text-xs text-error">{error}</span>}
      </form>

      <p className="mt-2 text-xs text-muted-foreground">
        {finPrevisto ? (
          <>
            La obra termina en <span className="font-medium text-foreground">{finPrevisto}</span>.
            Dejá los dos campos vacíos para borrarlos.
          </>
        ) : (
          "Dejá los dos campos vacíos para borrarlos. Sin estos datos, la solapa Presupuesto no se puede armar."
        )}
      </p>
    </div>
  );
}
