import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { NuevoMovimientoButton } from "@/components/movimientos/nuevo-movimiento-button";
import {
  PedidosEntregasList,
  type EntregaRow,
  type PedidoRow,
} from "@/components/pedidos/pedidos-entregas-list";

export default async function PedidosPage() {
  await requireSeccion("pedidos");

  const [pedidos, entregas] = await Promise.all([
    prisma.pedido.findMany({
      orderBy: { fecha: "desc" },
      include: { proyecto: true, proveedor: true },
    }),
    prisma.entrega.findMany({
      orderBy: { fecha: "desc" },
      include: { pedido: { include: { proyecto: true, proveedor: true } } },
    }),
  ]);

  const pedidoRows: PedidoRow[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    proyectoId: p.proyectoId,
    proyectoNombre: p.proyecto.nombre,
    proveedorId: p.proveedorId,
    proveedorNombre: p.proveedor.nombre,
    fechaISO: p.fecha.toISOString(),
    estado: p.estado,
    notas: p.notas,
    archivoUrl: p.archivoUrl,
  }));

  const entregaRows: EntregaRow[] = entregas.map((e) => ({
    id: e.id,
    pedidoId: e.pedidoId,
    pedidoNumero: e.pedido.numero,
    proyectoId: e.pedido.proyectoId,
    proyectoNombre: e.pedido.proyecto.nombre,
    proveedorId: e.pedido.proveedorId,
    proveedorNombre: e.pedido.proveedor.nombre,
    fechaISO: e.fecha.toISOString(),
    estadoPedido: e.pedido.estado,
    numeroRemito: e.numeroRemito,
    remitoUrl: e.remitoUrl,
    notas: e.notas,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pedidos y entregas</h1>
          <p className="text-sm text-muted-foreground">
            Todos los pedidos de materiales y las entregas registradas.
          </p>
        </div>
        <NuevoMovimientoButton />
      </div>

      <div className="mt-6">
        <PedidosEntregasList pedidos={pedidoRows} entregas={entregaRows} />
      </div>
    </div>
  );
}
