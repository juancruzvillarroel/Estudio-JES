"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateM2Vendibles } from "@/actions/proyectos";

/** Convierte el texto del input a número, aceptando coma o punto decimal. */
function parseM2(texto: string): number | null | undefined {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : undefined;
}

export function M2VendiblesPanel({
  proyectoId,
  m2Vendibles,
  onChange,
}: {
  proyectoId: string;
  m2Vendibles: number | null;
  /** Avisa al contenedor para refrescar los costos por m² del resumen sin recargar. */
  onChange?: (valor: number | null) => void;
}) {
  const [texto, setTexto] = useState(m2Vendibles != null ? String(m2Vendibles) : "");
  const [prevM2, setPrevM2] = useState(m2Vendibles);
  const [error, setError] = useState<string | undefined>();
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  if (m2Vendibles !== prevM2) {
    setPrevM2(m2Vendibles);
    setTexto(m2Vendibles != null ? String(m2Vendibles) : "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setGuardado(false);

    const valor = parseM2(texto);
    if (valor === undefined) {
      setError("Ingresá un número válido.");
      return;
    }

    startTransition(async () => {
      const result = await updateM2Vendibles(proyectoId, { m2Vendibles: valor });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChange?.(result.m2Vendibles);
      setGuardado(true);
    });
  };

  return (
    <div className="rounded-md border p-4">
      <div>
        <h3 className="text-sm font-semibold">Metros cuadrados vendibles</h3>
        <p className="text-xs text-muted-foreground">
          Superficie vendible total de la obra. Es el divisor que usa el resumen para calcular la
          incidencia del terreno y el costo de construcción por m².
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="m2Vendibles">m² vendibles</Label>
          <Input
            id="m2Vendibles"
            inputMode="decimal"
            placeholder="Ej. 1250,50"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setGuardado(false);
            }}
            className="w-40"
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
        Dejalo vacío para borrarlo. Si está vacío, el resumen no muestra los costos por m².
      </p>
    </div>
  );
}
