import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { EntregaForm } from "@/components/pedidos/entrega-form";
import { formatNumeroPedido } from "@/lib/utils";

export default async function NuevaEntregaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { items: { include: { material: true } } },
  });

  if (!pedido) {
    notFound();
  }

  if (pedido.estado === "COMPLETO" || pedido.estado === "CANCELADO") {
    redirect(`/pedidos/${id}`);
  }

  const itemsPendientes = pedido.items
    .map((item) => ({
      pedidoItemId: item.id,
      materialNombre: item.material.nombre,
      unidad: item.unidad,
      restante: Number(item.cantidadPedida) - Number(item.cantidadEntregada),
    }))
    .filter((item) => item.restante > 0);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Registrar entrega — Pedido #{formatNumeroPedido(pedido.numero)}
      </h1>
      <p className="text-sm text-muted-foreground">
        Cargá lo que te entregó el proveedor. Podés registrar entregas parciales.
      </p>
      <div className="mt-6 max-w-xl">
        <EntregaForm pedidoId={pedido.id} itemsPendientes={itemsPendientes} />
      </div>
    </div>
  );
}
