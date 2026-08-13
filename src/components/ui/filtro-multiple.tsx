"use client";

import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OpcionFiltro = { id: string; nombre: string };

/**
 * Filtro desplegable que permite tildar más de una opción a la vez (en vez de
 * un <Select> de selección única). Sin nada tildado se interpreta como "todas".
 *
 * Las opciones se muestran en el orden en que se reciben, así que quien llama
 * a este componente debe pasarlas ya ordenadas.
 */
export function FiltroMultiple({
  id,
  label,
  opciones,
  value,
  onChange,
  etiquetaTodos,
  sustantivo,
  className,
}: {
  id: string;
  label: string;
  opciones: OpcionFiltro[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Texto del botón cuando no hay nada tildado, ej. "Todas las obras". */
  etiquetaTodos: string;
  /** Sustantivo plural para el contador, ej. "rubros" en "3 rubros". */
  sustantivo: string;
  className?: string;
}) {
  const toggle = (opcionId: string) => {
    onChange(value.includes(opcionId) ? value.filter((v) => v !== opcionId) : [...value, opcionId]);
  };

  const todosIds = opciones.map((o) => o.id);
  const todosSeleccionados = todosIds.length > 0 && todosIds.every((v) => value.includes(v));

  const etiqueta =
    value.length === 0
      ? etiquetaTodos
      : value.length === 1
        ? (opciones.find((o) => o.id === value[0])?.nombre ?? `1 ${sustantivo}`)
        : `${value.length} ${sustantivo}`;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              size="sm"
              className={cn("w-40 justify-between gap-1.5 font-normal", className)}
            >
              <span className="min-w-0 flex-1 truncate text-left">{etiqueta}</span>
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {opciones.length} {sustantivo}
            </span>
            <div className="flex items-center gap-2">
              {!todosSeleccionados && (
                <button
                  type="button"
                  onClick={() => onChange(todosIds)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Tildar todos
                </button>
              )}
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {opciones.map((o) => (
              <label
                key={o.id}
                className="flex cursor-default items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox
                  checked={value.includes(o.id)}
                  onCheckedChange={() => toggle(o.id)}
                  className="mt-0.5"
                />
                <span className="break-words">{o.nombre}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
