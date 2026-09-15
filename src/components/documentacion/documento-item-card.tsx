"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  actualizarEstadoDocumento,
  eliminarTipoDocumento,
  renombrarTipoDocumento,
} from "@/actions/documentos";
import { cn } from "@/lib/utils";
import { BotonRenombrar, RenombrarFila } from "./renombrar-fila";

export function DocumentoItemCard({
  proyectoId,
  tipoId,
  nombre,
  descripcion,
  estado,
  compartido,
  dragHandle,
}: {
  proyectoId: string;
  tipoId: string;
  nombre: string;
  descripcion: string | null;
  estado: "PENDIENTE" | "PRESENTADO";
  /** Si viene del catálogo global, para avisar que al renombrarlo se despega. */
  compartido?: boolean;
  dragHandle?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      await actualizarEstadoDocumento(proyectoId, tipoId, checked);
    });
  };

  if (editando) {
    return (
      <div className="rounded-md border">
        <RenombrarFila
          inicial={nombre}
          aviso={
            compartido
              ? "Viene del listado compartido: al renombrarlo queda una copia propia de esta obra y las demás no se enteran."
              : undefined
          }
          onGuardar={(valor) => renombrarTipoDocumento(proyectoId, tipoId, valor)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border p-2.5 transition-colors",
        estado === "PRESENTADO" && "border-success/30 bg-success-bg"
      )}
    >
      {dragHandle}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{nombre}</p>
        {descripcion && <p className="truncate text-xs text-muted-foreground">{descripcion}</p>}
      </div>
      <BotonRenombrar nombre={nombre} onClick={() => setEditando(true)} />
      <DeleteButton
        iconOnly
        action={() => eliminarTipoDocumento(proyectoId, tipoId)}
        confirmMessage={`¿Eliminar "${nombre}" del listado de documentos?`}
      />
      <Checkbox
        checked={estado === "PRESENTADO"}
        onCheckedChange={(checked) => handleToggle(checked === true)}
        disabled={pending}
        aria-label={`Marcar "${nombre}" como presentado`}
      />
    </div>
  );
}
