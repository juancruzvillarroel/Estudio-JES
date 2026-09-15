"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * La fila convertida en un campo de texto mientras se le cambia el nombre.
 *
 * Reemplaza a la fila entera en vez de meterse adentro de ella: los títulos de
 * Documentación son el botón que abre el acordeón, y un lápiz ahí adentro sería
 * un botón dentro de otro botón, que ni es HTML válido ni se puede clickear sin
 * abrir y cerrar la sección de paso.
 */
export function RenombrarFila({
  inicial,
  aviso,
  onGuardar,
  onCancelar,
}: {
  inicial: string;
  /** Para avisar, por ejemplo, que el cambio le pega a todas las obras. */
  aviso?: string;
  onGuardar: (nombre: string) => Promise<{ error?: string; success?: boolean } | void>;
  onCancelar: () => void;
}) {
  const [valor, setValor] = useState(inicial);
  const [pending, startTransition] = useTransition();

  const guardar = () => {
    const nombre = valor.trim();
    if (!nombre || nombre === inicial) {
      onCancelar();
      return;
    }
    startTransition(async () => {
      const resultado = await onGuardar(nombre);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      onCancelar();
    });
  };

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <div className="flex items-center gap-2">
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar();
            }
            if (e.key === "Escape") onCancelar();
          }}
          autoFocus
          className="flex-1"
          aria-label={`Nuevo nombre para "${inicial}"`}
        />
        <Button type="button" size="sm" disabled={pending || !valor.trim()} onClick={guardar}>
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
      {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
    </div>
  );
}

/** El lápiz que abre la edición, igual en los cuatro niveles del listado. */
export function BotonRenombrar({ nombre, onClick }: { nombre: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Renombrar "${nombre}"`}
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}
