import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProyectoDialog } from "@/components/proyectos/proyecto-dialog";
import { TipoMovimientoBadge } from "@/components/movimientos/tipo-movimiento-badge";
import { capitalizarOracion, formatFecha } from "@/lib/utils";

const ESTADO_LABELS = {
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  FINALIZADO: "Finalizado",
};

type MovimientoRow = {
  key: string;
  tipo: "PEDIDO" | "ENTREGA";
  fecha: Date;
  pedidoId: string;
  proveedorNombre: string;
  itemsResumen: string;
};

function resumirItems(nombres: string[]) {
  if (nombres.length === 0) return "Sin ítems";
  const visibles = nombres.slice(0, 3).join(", ");
  return nombres.length > 3 ? `${visibles} y ${nombres.length - 3} más` : visibles;
}

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSeccion("proyectos");

  const { id } = await params;
  const [proyecto, pedidos, entregas] = await Promise.all([
    prisma.proyecto.findUnique({ where: { id } }),
    prisma.pedido.findMany({
      where: { proyectoId: id },
      include: { proveedor: true, items: { include: { material: true } } },
    }),
    prisma.entrega.findMany({
      where: { pedido: { proyectoId: id } },
      include: {
        pedido: { include: { proveedor: true } },
        items: { include: { pedidoItem: { include: { material: true } } } },
      },
    }),
  ]);

  if (!proyecto) {
    notFound();
  }

  const movimientos: MovimientoRow[] = [
    ...pedidos.map((p) => ({
      key: `pedido-${p.id}`,
      tipo: "PEDIDO" as const,
      fecha: p.fecha,
      pedidoId: p.id,
      proveedorNombre: p.proveedor.nombre,
      itemsResumen: resumirItems(p.items.map((i) => i.material.nombre)),
    })),
    ...entregas.map((e) => ({
      key: `entrega-${e.id}`,
      tipo: "ENTREGA" as const,
      fecha: e.fecha,
      pedidoId: e.pedidoId,
      proveedorNombre: e.pedido.proveedor.nombre,
      itemsResumen: resumirItems(e.items.map((i) => i.pedidoItem.material.nombre)),
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <div>
      {proyecto.imagenUrl ? (
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-xl sm:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proyecto.imagenUrl}
            alt={proyecto.nombre}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white">{proyecto.nombre}</h1>
                <Badge variant={proyecto.estado === "ACTIVO" ? "secondary" : "outline"}>
                  {ESTADO_LABELS[proyecto.estado]}
                </Badge>
              </div>
              {proyecto.barrio && (
                <p className="text-sm text-white/80">{capitalizarOracion(proyecto.barrio)}</p>
              )}
              <p className="text-sm text-white/80">
                {proyecto.direccion ? capitalizarOracion(proyecto.direccion) : "Sin dirección"}
              </p>
            </div>
            <ProyectoDialog
              proyecto={proyecto}
              trigger={<Button variant="outline">Editar datos</Button>}
            />
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{proyecto.nombre}</h1>
              <Badge variant={proyecto.estado === "ACTIVO" ? "secondary" : "outline"}>
                {ESTADO_LABELS[proyecto.estado]}
              </Badge>
            </div>
            {proyecto.barrio && (
              <p className="text-sm text-muted-foreground">{capitalizarOracion(proyecto.barrio)}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {proyecto.direccion ? capitalizarOracion(proyecto.direccion) : "Sin dirección"}
            </p>
          </div>
          <ProyectoDialog
            proyecto={proyecto}
            trigger={<Button variant="outline">Editar datos</Button>}
          />
        </div>
      )}

      {proyecto.descripcion && (
        <p className="mt-4 text-sm text-muted-foreground">{proyecto.descripcion}</p>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-medium">Movimientos</h2>
      </div>

      {movimientos.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Todavía no hay pedidos ni entregas cargados para este proyecto.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {movimientos.map((m) => (
            <Link
              key={m.key}
              href={`/pedidos/${m.pedidoId}`}
              className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TipoMovimientoBadge tipo={m.tipo} />
                  <p className="font-medium">{m.proveedorNombre}</p>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{m.itemsResumen}</p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {formatFecha(m.fecha)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
