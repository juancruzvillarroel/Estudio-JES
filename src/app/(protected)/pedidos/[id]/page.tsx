import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoPedidoBadge } from "@/components/pedidos/estado-badge";
import { EliminarPedidoButton } from "@/components/pedidos/eliminar-pedido-button";
import { EntregaCardAcciones } from "@/components/pedidos/entrega-card-acciones";
import { cn, formatFecha, formatNumeroPedido } from "@/lib/utils";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      proyecto: true,
      proveedor: true,
      items: { include: { material: true } },
      entregas: {
        include: { items: { include: { pedidoItem: { include: { material: true } } } } },
        orderBy: { fecha: "desc" },
      },
    },
  });

  if (!pedido) {
    notFound();
  }

  const puedeRegistrarEntrega = pedido.estado === "PENDIENTE" || pedido.estado === "PARCIAL";

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Pedido <span className="font-mono tracking-[0.05em]">#{formatNumeroPedido(pedido.numero)}</span>
            </h1>
            <EstadoPedidoBadge estado={pedido.estado} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/proyectos/${pedido.proyectoId}`} className="hover:underline">
              {pedido.proyecto.nombre}
            </Link>
            {" · "}
            <Link href={`/proveedores/${pedido.proveedorId}`} className="hover:underline">
              {pedido.proveedor.nombre}
            </Link>
            {" · "}
            {formatFecha(pedido.fecha)}
          </p>
          {pedido.archivoUrl && (
            <p className="text-sm text-muted-foreground">
              <a
                href={pedido.archivoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Ver archivo adjunto
              </a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href={`/pedidos/${pedido.id}/editar`} />}
            nativeButton={false}
            type="button"
            variant="outline"
            size="icon"
            aria-label="Editar pedido"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <EliminarPedidoButton pedidoId={pedido.id} numero={formatNumeroPedido(pedido.numero)} />
          {puedeRegistrarEntrega && (
            <Button render={<Link href={`/pedidos/${pedido.id}/entregas/nueva`} />} nativeButton={false}>
              Registrar entrega
            </Button>
          )}
        </div>
      </div>

      {pedido.notas && <p className="mt-4 text-sm text-muted-foreground">{pedido.notas}</p>}

      <div className="mt-6 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Entregado</TableHead>
              <TableHead>Falta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedido.items.map((item) => {
              const pedida = Number(item.cantidadPedida);
              const entregada = Number(item.cantidadEntregada);
              const falta = pedida - entregada;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.material.nombre}</TableCell>
                  <TableCell>
                    {pedida} {item.unidad}
                  </TableCell>
                  <TableCell>
                    {entregada} {item.unidad}
                  </TableCell>
                  <TableCell className={cn(falta > 0 ? "text-error" : "text-success")}>
                    {falta > 0 ? `${falta} ${item.unidad}` : "Completo"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <h2 className="mt-8 text-lg font-medium">Entregas registradas</h2>
      {pedido.entregas.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no se registraron entregas.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {pedido.entregas.map((entrega) => (
            <div key={entrega.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {formatFecha(entrega.fecha)}
                  {entrega.numeroRemito && ` · Remito ${entrega.numeroRemito}`}
                  {entrega.remitoUrl && (
                    <>
                      {" · "}
                      <a
                        href={entrega.remitoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Ver remito
                      </a>
                    </>
                  )}
                </p>
                <EntregaCardAcciones
                  entregaId={entrega.id}
                  fechaISO={entrega.fecha.toISOString()}
                  numeroRemito={entrega.numeroRemito}
                  notas={entrega.notas}
                />
              </div>
              <ul className="mt-1 text-sm">
                {entrega.items.map((ei) => (
                  <li key={ei.id}>
                    {ei.pedidoItem.material.nombre}: {Number(ei.cantidad)} {ei.pedidoItem.unidad}
                  </li>
                ))}
              </ul>
              {entrega.notas && <p className="mt-1 text-sm text-muted-foreground">{entrega.notas}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
