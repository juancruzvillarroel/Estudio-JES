"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePorcentajeHonorarios } from "@/actions/proyectos";

/** Convierte el texto del input a número, aceptando coma o punto decimal. */
function parsePorcentaje(texto: string): number | null | undefined {
  const limpio = texto.trim().replace("%", "").replace(",", ".");
  if (limpio === "") return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : undefined;
}

export function PorcentajeHonorariosPanel({
  proyectoId,
  porcentajeHonorarios,
  onChange,
}: {
  proyectoId: string;
  porcentajeHonorarios: number | null;
  /** Avisa al contenedor para recalcular el panel del resumen sin recargar. */
  onChange?: (valor: number | null) => void;
}) {
  const [texto, setTexto] = useState(
    porcentajeHonorarios != null ? String(porcentajeHonorarios) : ""
  );
  const [prevPorcentaje, setPrevPorcentaje] = useState(porcentajeHonorarios);
  const [error, setError] = useState<string | undefined>();
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  if (porcentajeHonorarios !== prevPorcentaje) {
    setPrevPorcentaje(porcentajeHonorarios);
    setTexto(porcentajeHonorarios != null ? String(porcentajeHonorarios) : "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setGuardado(false);

    const valor = parsePorcentaje(texto);
    if (valor === undefined) {
      setError("Ingresá un número válido.");
      return;
    }

    startTransition(async () => {
      const result = await updatePorcentajeHonorarios(proyectoId, {
        porcentajeHonorarios: valor,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChange?.(result.porcentajeHonorarios);
      setGuardado(true);
    });
  };

  return (
    <div className="rounded-md border p-4">
      <div>
        <h3 className="text-sm font-semibold">Honorarios del estudio</h3>
        <p className="text-xs text-muted-foreground">
          Porcentaje que cobra el estudio sobre los gastos de esta obra. Es el que usa la
          calculadora del resumen para proponer el monto de cada liquidación.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="porcentajeHonorarios">Porcentaje</Label>
          <Input
            id="porcentajeHonorarios"
            inputMode="decimal"
            placeholder="Ej. 12"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setGuardado(false);
            }}
            className="w-32"
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
        Dejalo vacío si todavía no está definido: el resumen no propone ningún monto hasta que se
        cargue. Qué rubros entran en la base se configura rubro por rubro, en Proveedores → Rubros.
      </p>
    </div>
  );
}
