import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { ProyectoDialog } from "@/components/proyectos/proyecto-dialog";
import { TipoMovimientoBadge } from "@/components/movimientos/tipo-movimiento-badge";
import { MunicipalSection } from "@/components/municipal/municipal-section";
import { DocumentacionSection } from "@/components/documentacion/documentacion-section";
import { capitalizarOracion, formatFecha, formatNumeroPedido } from "@/lib/utils";

const ESTADO_LABELS = {
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  FINALIZADO: "Finalizado",
};

type MovimientoItem = {
  id: string;
  nombre: string;
  cantidad: number;
  cantidadEntregada?: number;
  unidad: string;
};

type MovimientoRow = {
  key: string;
  tipo: "PEDIDO" | "ENTREGA";
  fecha: Date;
  pedidoId: string;
  numeroPedido: number;
  proveedorNombre: string;
  itemsResumen: string;
  items: MovimientoItem[];
  notas: string | null;
  archivoUrl: string | null;
  numeroRemito?: string | null;
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
      numeroPedido: p.numero,
      proveedorNombre: p.proveedor.nombre,
      itemsResumen: resumirItems(p.items.map((i) => i.material.nombre)),
      items: p.items.map((i) => ({
        id: i.id,
        nombre: i.material.nombre,
        cantidad: Number(i.cantidadPedida),
        cantidadEntregada: Number(i.cantidadEntregada),
        unidad: i.unidad,
      })),
      notas: p.notas,
      archivoUrl: p.archivoUrl,
    })),
    ...entregas.map((e) => ({
      key: `entrega-${e.id}`,
      tipo: "ENTREGA" as const,
      fecha: e.fecha,
      pedidoId: e.pedidoId,
      numeroPedido: e.pedido.numero,
      proveedorNombre: e.pedido.proveedor.nombre,
      itemsResumen: resumirItems(e.items.map((i) => i.pedidoItem.material.nombre)),
      items: e.items.map((i) => ({
        id: i.id,
        nombre: i.pedidoItem.material.nombre,
        cantidad: Number(i.cantidad),
        unidad: i.pedidoItem.unidad,
      })),
      notas: e.notas,
      archivoUrl: e.remitoUrl,
      numeroRemito: e.numeroRemito,
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

      <Tabs defaultValue="movimientos" className="mt-8">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="municipal">Municipal</TabsTrigger>
          <TabsTrigger value="documentacion">Documentación</TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="mt-4">
          {movimientos.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Todavía no hay pedidos ni entregas cargados para este proyecto.
            </div>
          ) : (
            <Accordion multiple className="flex flex-col gap-2">
              {movimientos.map((m) => (
                <div key={m.key} className="rounded-md border">
                  <AccordionItem value={m.key} className="border-0">
                    <AccordionTrigger className="px-3 py-3">
                      <div className="flex w-full min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <TipoMovimientoBadge tipo={m.tipo} />
                            <p className="font-medium">{m.proveedorNombre}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {m.itemsResumen}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatFecha(m.fecha)}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionPanel className="px-3">
                      <div className="flex flex-col gap-3 border-t pt-3">
                        <p className="text-xs text-muted-foreground">
                          Pedido #{formatNumeroPedido(m.numeroPedido)}
                          {m.tipo === "ENTREGA" && m.numeroRemito && ` · Remito ${m.numeroRemito}`}
                        </p>
                        <ul className="flex flex-col gap-1 text-sm">
                          {m.items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3">
                              <span>{item.nombre}</span>
                              <span className="shrink-0 text-muted-foreground">
                                {m.tipo === "PEDIDO"
                                  ? `${item.cantidadEntregada}/${item.cantidad} ${item.unidad}`
                                  : `${item.cantidad} ${item.unidad}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {m.notas && <p className="text-sm text-muted-foreground">{m.notas}</p>}
                        <div className="flex items-center gap-3 text-xs">
                          {m.archivoUrl && (
                            <a
                              href={m.archivoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              {m.tipo === "PEDIDO" ? "Ver archivo adjunto" : "Ver remito"}
                            </a>
                          )}
                          <Link href={`/pedidos/${m.pedidoId}`} className="ml-auto underline">
                            Ver pedido completo
                          </Link>
                        </div>
                      </div>
                    </AccordionPanel>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="municipal" className="mt-4">
          <MunicipalSection proyectoId={proyecto.id} />
        </TabsContent>

        <TabsContent value="documentacion" className="mt-4">
          <DocumentacionSection proyectoId={proyecto.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
