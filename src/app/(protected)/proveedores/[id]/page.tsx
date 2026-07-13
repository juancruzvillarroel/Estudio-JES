import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { formatMonto } from "@/lib/utils";
import { ProveedorDialog } from "@/components/proveedores/proveedor-dialog";
import { CuentaCorrienteFiltro } from "@/components/proveedores/cuenta-corriente-filtro";
import {
  CuentaCorrienteLista,
  type Movimiento,
} from "@/components/proveedores/cuenta-corriente-lista";
import { ExportarCuentaCorrienteBoton } from "@/components/proveedores/exportar-cuenta-corriente-boton";
import { NuevoAcopioBoton } from "@/components/proveedores/nuevo-acopio-boton";
import type { AcopioOpcion } from "@/actions/acopios";

function labelAcopio(a: AcopioOpcion) {
  return a.tipo === "MATERIAL"
    ? `${a.materialNombre} — ${(a.cantidadTotal ?? 0) - a.consumido} ${a.unidad} restantes`
    : `Monto — ${formatMonto((a.montoTotal ?? 0) - a.consumido)} restantes`;
}

export default async function ProveedorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    proyectoId?: string;
    acopioId?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const { id } = await params;
  const { proyectoId, acopioId, desde, hasta } = await searchParams;

  const [proveedor, rubros] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id }, include: { rubros: true } }),
    prisma.rubro.findMany({ orderBy: { orden: "asc" } }),
  ]);
  if (!proveedor) {
    notFound();
  }

  const proyectoFiltro = proyectoId && proyectoId !== "todos" ? proyectoId : undefined;
  const acopioFiltro = acopioId && acopioId !== "todos" ? acopioId : undefined;
  const fechaFiltro =
    desde || hasta
      ? {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(hasta ? { lte: new Date(`${hasta}T23:59:59`) } : {}),
        }
      : undefined;

  const [materiales, proyectos, acopios, pedidos, entregas] = await Promise.all([
    prisma.material.findMany({ orderBy: { nombre: "asc" } }),
    prisma.proyecto.findMany({ orderBy: { nombre: "asc" } }),
    prisma.acopio.findMany({
      where: { proveedorId: id },
      include: {
        material: true,
        precios: { include: { material: true } },
        pedidos: { where: { estado: { not: "CANCELADO" } }, include: { items: true } },
      },
      orderBy: { fecha: "desc" },
    }),
    prisma.pedido.findMany({
      where: {
        proveedorId: id,
        ...(proyectoFiltro ? { proyectoId: proyectoFiltro } : {}),
        ...(fechaFiltro ? { fecha: fechaFiltro } : {}),
        ...(acopioFiltro ? { acopioId: acopioFiltro } : {}),
      },
      include: { proyecto: true, items: { include: { material: true } } },
      orderBy: { fecha: "desc" },
    }),
    prisma.entrega.findMany({
      where: {
        pedido: {
          proveedorId: id,
          ...(proyectoFiltro ? { proyectoId: proyectoFiltro } : {}),
          ...(acopioFiltro ? { acopioId: acopioFiltro } : {}),
        },
        ...(fechaFiltro ? { fecha: fechaFiltro } : {}),
      },
      include: {
        pedido: { include: { proyecto: true } },
        items: { include: { pedidoItem: { include: { material: true } } } },
      },
      orderBy: { fecha: "desc" },
    }),
  ]);

  const acopiosOpciones: AcopioOpcion[] = acopios.map((a) => {
    const items = a.pedidos.flatMap((p) => p.items);
    const consumido =
      a.tipo === "MATERIAL"
        ? items
            .filter((i) => i.materialId === a.materialId)
            .reduce((sum, i) => sum + Number(i.cantidadPedida), 0)
        : items.reduce((sum, i) => sum + Number(i.cantidadPedida) * Number(i.precioUnitario ?? 0), 0);

    return {
      id: a.id,
      proyectoId: a.proyectoId,
      proveedorId: a.proveedorId,
      tipo: a.tipo,
      notas: a.notas,
      materialId: a.materialId,
      materialNombre: a.material?.nombre ?? null,
      unidad: a.unidad,
      cantidadTotal: a.cantidadTotal ? Number(a.cantidadTotal) : null,
      montoTotal: a.montoTotal ? Number(a.montoTotal) : null,
      precios: a.precios.map((p) => ({
        materialId: p.materialId,
        materialNombre: p.material.nombre,
        unidad: p.material.unidad,
        precioUnitario: Number(p.precioUnitario),
      })),
      consumido,
    };
  });

  const acopiosFiltroOpciones = acopiosOpciones.map((a) => ({ id: a.id, label: labelAcopio(a) }));

  const movimientos: Movimiento[] = [
    ...pedidos.map((p) => ({
      id: `pedido-${p.id}`,
      tipo: "PEDIDO" as const,
      fecha: p.fecha.toISOString(),
      proyectoId: p.proyectoId,
      proyectoNombre: p.proyecto.nombre,
      numero: p.numero,
      estado: p.estado,
      items: p.items.map((i) => ({
        id: i.id,
        material: i.material.nombre,
        cantidad: Number(i.cantidadPedida),
        unidad: i.unidad,
      })),
    })),
    ...entregas.map((e) => ({
      id: `entrega-${e.id}`,
      tipo: "ENTREGA" as const,
      fecha: e.fecha.toISOString(),
      proyectoId: e.pedido.proyectoId,
      proyectoNombre: e.pedido.proyecto.nombre,
      numero: e.pedido.numero,
      numeroRemito: e.numeroRemito,
      items: e.items.map((i) => ({
        id: i.id,
        material: i.pedidoItem.material.nombre,
        cantidad: Number(i.cantidad),
        unidad: i.pedidoItem.unidad,
      })),
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{proveedor.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {proveedor.contacto ?? "Sin contacto"} · {proveedor.telefono ?? "Sin teléfono"}
          </p>
        </div>
        <ProveedorDialog
          proveedor={proveedor}
          rubros={rubros}
          trigger={<Button variant="outline">Editar datos</Button>}
        />
      </div>

      <h2 className="mt-8 text-lg font-medium">Cuenta corriente de materiales</h2>
      <p className="text-sm text-muted-foreground">
        Historial de pedidos hechos a este proveedor en todos los proyectos.
      </p>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <CuentaCorrienteFiltro
          proyectos={proyectos}
          acopios={acopiosFiltroOpciones}
          proyectoId={proyectoId}
          acopioId={acopioId}
          desde={desde}
          hasta={hasta}
        />
        <div className="flex flex-wrap items-end gap-3">
          <ExportarCuentaCorrienteBoton movimientos={movimientos} proveedorNombre={proveedor.nombre} />
          <NuevoAcopioBoton proveedorId={id} proyectos={proyectos} materiales={materiales} />
        </div>
      </div>

      <div className="mt-4">
        <CuentaCorrienteLista movimientos={movimientos} />
      </div>
    </div>
  );
}
