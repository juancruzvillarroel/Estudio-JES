import type { Acopio, Pedido, PedidoItem } from "@/generated/prisma/client";

type AcopioConPedidos = Pick<Acopio, "tipo"> & {
  pedidos: (Pick<Pedido, "id"> & {
    items: Pick<PedidoItem, "cantidadPedida" | "precioUnitario">[];
  })[];
};

export function calcularConsumido(acopio: AcopioConPedidos): number {
  const items = acopio.pedidos.flatMap((p) => p.items);
  if (acopio.tipo === "MONTO") {
    return items.reduce(
      (acc, i) => acc + Number(i.cantidadPedida) * Number(i.precioUnitario ?? 0),
      0
    );
  }
  return items.reduce((acc, i) => acc + Number(i.cantidadPedida), 0);
}
