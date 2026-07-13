"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { EditarEntregaDialog } from "@/components/pedidos/editar-entrega-dialog";
import { deleteEntrega } from "@/actions/entregas";

export function EntregaCardAcciones({
  entregaId,
  fechaISO,
  numeroRemito,
  notas,
}: {
  entregaId: string;
  fechaISO: string;
  numeroRemito: string | null;
  notas: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <EditarEntregaDialog
        entregaId={entregaId}
        fechaISO={fechaISO}
        numeroRemito={numeroRemito}
        notas={notas}
        trigger={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar entrega">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DeleteButton
        iconOnly
        action={() => deleteEntrega(entregaId)}
        confirmMessage="¿Eliminar esta entrega? Se revertirá la cantidad entregada del pedido y, si sumó stock al inventario, también se revertirá. Esta acción no se puede deshacer."
      />
    </div>
  );
}
