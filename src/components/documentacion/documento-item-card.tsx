"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "@/components/ui/delete-button";
import { actualizarEstadoDocumento, eliminarTipoDocumento } from "@/actions/documentos";
import { cn } from "@/lib/utils";

export function DocumentoItemCard({
  proyectoId,
  tipoId,
  nombre,
  descripcion,
  estado,
}: {
  proyectoId: string;
  tipoId: string;
  nombre: string;
  descripcion: string | null;
  estado: "PENDIENTE" | "PRESENTADO";
}) {
  const [pending, startTransition] = useTransition();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      await actualizarEstadoDocumento(proyectoId, tipoId, checked);
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border p-2.5 transition-colors",
        estado === "PRESENTADO" && "border-success/30 bg-success-bg"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{nombre}</p>
        {descripcion && <p className="truncate text-xs text-muted-foreground">{descripcion}</p>}
      </div>
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
