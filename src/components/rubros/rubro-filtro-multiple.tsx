"use client";

import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type RubroOpcion = { id: string; nombre: string };

/** Valor sentinela para representar "sin rubro asignado" dentro del filtro. */
export const SIN_RUBRO = "sin-rubro";

/**
 * Filtro de rubros que permite tildar más de uno a la vez (en vez de un
 * <Select> de selección única). Los rubros se muestran en el mismo orden en
 * que se reciben, así que quien llama a este componente debe pasarlos ya
 * ordenados (por código/orden).
 */
export function RubroFiltroMultiple({
  id,
  label = "Rubro",
  rubros,
  value,
  onChange,
  incluirSinRubro = false,
}: {
  id: string;
  label?: string;
  rubros: RubroOpcion[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Agrega una opción extra "Sin rubro" identificada con SIN_RUBRO. */
  incluirSinRubro?: boolean;
}) {
  const toggle = (rubroId: string) => {
    onChange(value.includes(rubroId) ? value.filter((v) => v !== rubroId) : [...value, rubroId]);
  };

  const etiquetaDe = (rubroId: string) =>
    rubroId === SIN_RUBRO ? "Sin rubro" : (rubros.find((r) => r.id === rubroId)?.nombre ?? "1 rubro");

  const etiqueta =
    value.length === 0
      ? "Todos los rubros"
      : value.length === 1
        ? etiquetaDe(value[0])
        : `${value.length} rubros`;

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
              className="w-40 justify-between gap-1.5 font-normal"
            >
              <span className="min-w-0 flex-1 truncate text-left">{etiqueta}</span>
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {rubros.length} rubros
            </span>
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
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {rubros.map((r) => (
              <label
                key={r.id}
                className="flex cursor-default items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Checkbox
                  checked={value.includes(r.id)}
                  onCheckedChange={() => toggle(r.id)}
                  className="mt-0.5"
                />
                <span className="break-words">{r.nombre}</span>
              </label>
            ))}
            {incluirSinRubro && (
              <label className="flex cursor-default items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
                <Checkbox
                  checked={value.includes(SIN_RUBRO)}
                  onCheckedChange={() => toggle(SIN_RUBRO)}
                  className="mt-0.5"
                />
                <span className="break-words">Sin rubro</span>
              </label>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
