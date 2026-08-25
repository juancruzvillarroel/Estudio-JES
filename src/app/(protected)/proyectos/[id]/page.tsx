import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { ProyectoDialog } from "@/components/proyectos/proyecto-dialog";
import {
  ProyectoSecciones,
  type ResumenProyecto,
} from "@/components/proyectos/proyecto-secciones";
import { TipoMovimientoBadge } from "@/components/movimientos/tipo-movimiento-badge";
import { MunicipalSection } from "@/components/municipal/municipal-section";
import { DocumentacionSection } from "@/components/documentacion/documentacion-section";
import { TareasSection } from "@/components/tareas/tareas-section";
import { FlujoFondosSection } from "@/components/flujo-fondos/flujo-fondos-section";
import {
  movimientoFondoInclude,
  mapMovimientoFondo,
  mapProyectoInversor,
  mapMedioPago,
  mapUnidadProyecto,
} from "@/lib/flujo-fondos";
import { ventaInclude, mapVenta } from "@/lib/ventas";
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

function plural(cantidad: number, singular: string, plural: string) {
  return cantidad === 1 ? singular : plural;
}

/**
 * Suma los movimientos de fondos en dólares. Los que están en pesos sin tipo
 * de cambio cargado no se pueden convertir y quedan afuera, igual que en el
 * consolidado del resumen de Flujo de fondos.
 */
function sumarUSD(movimientos: { tipo: string; monto: number; moneda: string; tipoCambio: number | null }[]) {
  return movimientos.reduce((acc, m) => {
    if (m.moneda === "USD") return acc + m.monto;
    if (m.tipoCambio) return acc + m.monto / m.tipoCambio;
    return acc;
  }, 0);
}

function formatUSD(valor: number) {
  return `USD ${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSeccion("proyectos");
  const tieneFlujoFondos = session.esAdmin || session.paginasPermitidas.includes("flujo-fondos");

  const { id } = await params;
  const [
    proyecto,
    pedidos,
    entregas,
    rubros,
    proveedoresFondo,
    asignacionesRaw,
    movimientosRaw,
    mediosPagoRaw,
    unidadesRaw,
    ventasRaw,
    tareasPendientes,
    tareasTotal,
    tareasAlta,
    tramitesPresentados,
    tramitesTotal,
    documentosPresentados,
    documentosTotal,
  ] = await Promise.all([
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
      tieneFlujoFondos
        ? prisma.rubro.findMany({
            orderBy: { orden: "asc" },
            include: { subrubros: { orderBy: { orden: "asc" } } },
          })
        : Promise.resolve([]),
      tieneFlujoFondos
        ? prisma.proveedor.findMany({
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, rubros: { select: { id: true } } },
          })
        : Promise.resolve([]),
      tieneFlujoFondos
        ? prisma.proyectoInversor.findMany({ where: { proyectoId: id } })
        : Promise.resolve([]),
      tieneFlujoFondos
        ? prisma.movimientoFondo.findMany({
            where: { proyectoId: id },
            include: movimientoFondoInclude,
            orderBy: { fecha: "desc" },
          })
        : Promise.resolve([]),
      tieneFlujoFondos
        ? prisma.medioPago.findMany({ where: { proyectoId: id }, orderBy: { nombre: "asc" } })
        : Promise.resolve([]),
      tieneFlujoFondos
        ? prisma.unidadProyecto.findMany({ where: { proyectoId: id }, orderBy: { nombre: "asc" } })
        : Promise.resolve([]),
      tieneFlujoFondos
        ? prisma.venta.findMany({
            where: { proyectoId: id },
            include: ventaInclude,
            orderBy: { fecha: "desc" },
          })
        : Promise.resolve([]),
      // Conteos para las tarjetas de la portada. Van como `count` en vez de
      // traer las filas: la portada solo muestra el número.
      prisma.tarea.count({ where: { proyectoId: id, estado: "PENDIENTE" } }),
      prisma.tarea.count({ where: { proyectoId: id } }),
      prisma.tarea.count({
        where: { proyectoId: id, estado: "PENDIENTE", prioridad: "ALTA" },
      }),
      prisma.tramiteMunicipal.count({ where: { proyectoId: id, estado: "PRESENTADO" } }),
      prisma.tramiteMunicipalTipo.count({ where: { activo: true } }),
      prisma.documento.count({ where: { proyectoId: id, estado: "PRESENTADO" } }),
      prisma.documentoTipo.count({
        where: { activo: true, OR: [{ proyectoId: null }, { proyectoId: id }] },
      }),
    ]);

  if (!proyecto) {
    notFound();
  }

  // El diálogo de edición es un client component, así que le pasamos solo los
  // campos que usa: `m2Vendibles` es un Decimal de Prisma y React no puede
  // serializarlo al cruzar el borde server → client.
  const proyectoEditable = {
    id: proyecto.id,
    nombre: proyecto.nombre,
    barrio: proyecto.barrio,
    direccion: proyecto.direccion,
    estado: proyecto.estado,
    descripcion: proyecto.descripcion,
    imagenUrl: proyecto.imagenUrl,
    cantidadPisos: proyecto.cantidadPisos,
  };

  const asignaciones = asignacionesRaw.map(mapProyectoInversor);
  const movimientosFondo = movimientosRaw.map(mapMovimientoFondo);
  const mediosPago = mediosPagoRaw.map(mapMedioPago);
  const unidades = unidadesRaw.map(mapUnidadProyecto);
  const ventas = ventasRaw.map(mapVenta);
  const proveedoresConRubros = proveedoresFondo.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    rubroIds: p.rubros.map((r) => r.id),
  }));

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

  const aportadoUSD = sumarUSD(movimientosFondo.filter((m) => m.tipo === "APORTE"));
  const gastadoUSD = sumarUSD(movimientosFondo.filter((m) => m.tipo === "GASTO"));

  const saldoUSD = aportadoUSD - gastadoUSD;
  const ultimoMovimiento = movimientos[0];

  const resumen: ResumenProyecto = {
    movimientos: {
      valor: String(movimientos.length),
      detalle: movimientos.length === 1 ? "movimiento registrado" : "movimientos registrados",
      progreso: null,
      tono: "neutral",
      chips: [
        { etiqueta: "Pedidos", valor: String(pedidos.length) },
        { etiqueta: "Entregas", valor: String(entregas.length) },
        ...(ultimoMovimiento
          ? [{ etiqueta: "Último", valor: formatFecha(ultimoMovimiento.fecha) }]
          : []),
      ],
    },
    tareas: {
      valor: String(tareasPendientes),
      detalle: tareasTotal === 0 ? "sin tareas cargadas" : plural(tareasPendientes, "tarea pendiente", "tareas pendientes"),
      // El avance de tareas es cuántas se completaron sobre el total.
      progreso: tareasTotal > 0 ? { hechos: tareasTotal - tareasPendientes, total: tareasTotal } : null,
      tono: tareasPendientes === 0 ? "ok" : "alerta",
      chips: tareasAlta > 0 ? [{ etiqueta: "Prioridad alta", valor: String(tareasAlta) }] : [],
    },
    municipal: {
      valor: `${tramitesPresentados}/${tramitesTotal}`,
      detalle: "trámites presentados",
      progreso: { hechos: tramitesPresentados, total: tramitesTotal },
      tono: tramitesTotal > 0 && tramitesPresentados === tramitesTotal ? "ok" : "neutral",
      chips: [{ etiqueta: "Faltan", valor: String(Math.max(0, tramitesTotal - tramitesPresentados)) }],
    },
    documentacion: {
      valor: `${documentosPresentados}/${documentosTotal}`,
      detalle: "documentos cargados",
      progreso: { hechos: documentosPresentados, total: documentosTotal },
      tono: documentosTotal > 0 && documentosPresentados === documentosTotal ? "ok" : "neutral",
      chips: [
        { etiqueta: "Faltan", valor: String(Math.max(0, documentosTotal - documentosPresentados)) },
      ],
    },
    flujoFondos: tieneFlujoFondos
      ? {
          valor: formatUSD(saldoUSD),
          detalle: "saldo disponible",
          // El avance es cuánto del total aportado ya se gastó.
          progreso: aportadoUSD > 0 ? { hechos: gastadoUSD, total: aportadoUSD } : null,
          // Un saldo negativo es plata que falta, no algo a revisar: va en rojo
          // y no en el naranja que la app usa para "prestá atención".
          tono: saldoUSD < 0 ? "error" : "neutral",
          chips: [
            { etiqueta: "Aportado", valor: formatUSD(aportadoUSD) },
            { etiqueta: "Gastado", valor: formatUSD(gastadoUSD) },
          ],
        }
      : null,
  };

  return (
    <div>
      <div className="border-b border-neutral-800 pb-4">
        {proyecto.imagenUrl ? (
          <div className="relative h-64 w-full overflow-hidden rounded-xl sm:h-72">
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
                proyecto={proyectoEditable}
                trigger={<Button variant="outline">Editar datos</Button>}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
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
              proyecto={proyectoEditable}
              trigger={<Button variant="outline">Editar datos</Button>}
            />
          </div>
        )}

        {proyecto.descripcion && (
          <p className="mt-4 text-sm text-muted-foreground">{proyecto.descripcion}</p>
        )}
      </div>

      <ProyectoSecciones
        resumen={resumen}
        movimientos={
          movimientos.length === 0 ? (
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
          )
        }
        tareas={<TareasSection proyectoId={proyecto.id} />}
        municipal={<MunicipalSection proyectoId={proyecto.id} />}
        documentacion={<DocumentacionSection proyectoId={proyecto.id} />}
        flujoFondos={
          tieneFlujoFondos ? (
            <FlujoFondosSection
              proyectoId={proyecto.id}
              proyectoNombre={proyecto.nombre}
              rubros={rubros}
              proveedores={proveedoresConRubros}
              asignaciones={asignaciones}
              movimientos={movimientosFondo}
              mediosPago={mediosPago}
              unidades={unidades}
              ventas={ventas}
              m2Vendibles={proyecto.m2Vendibles ? Number(proyecto.m2Vendibles) : null}
            />
          ) : null
        }
      />
    </div>
  );
}
