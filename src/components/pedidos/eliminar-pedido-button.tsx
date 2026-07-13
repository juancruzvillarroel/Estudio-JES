"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/ui/delete-button";
import { deletePedido } from "@/actions/pedidos";

export function EliminarPedidoButton({
  pedidoId,
  numero,
}: {
  pedidoId: string;
  numero: string;
}) {
  const router = useRouter();

  return (
    <DeleteButton
      action={() => deletePedido(pedidoId)}
      confirmMessage={`¿Eliminar el pedido #${numero}? Esta acción no se puede deshacer.`}
      onDeleted={() => router.push("/pedidos")}
    />
  );
}
