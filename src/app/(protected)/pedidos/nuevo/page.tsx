import { prisma } from "@/lib/db";
import { MovimientoForm } from "@/components/movimientos/movimiento-form";
import type { AcopioOpcion } from "@/actions/acopios";

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const tipoInicial = tipo === "ENTREGA" ? "ENTREGA" : "PEDIDO";

  const [proyectos, rubros, materiales, pedidosAbiertos, acopios] = await Promise.all([
    prisma.proyecto.findMany({ where: { estado: "ACTIVO" }, orderBy: { nombre: "asc" } }),
    prisma.rubro.findMany({ include: { proveedores: true }, orderBy: { orden: "asc" } }),
    prisma.material.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.pedido.findMany({
      where: { estado: { in: ["PENDIENTE", "PARCIAL"] } },
      include: { items: { include: { material: true } } },
      orderBy: { fecha: "desc" },
    }),
    prisma.acopio.findMany({
      include: {
        material: true,
        precios: { include: { material: true } },
        pedidos: { where: { estado: { not: "CANCELADO" } }, include: { items: true } },
      },
      orderBy: { fecha: "desc" },
    }),
  ]);

  const pedidosAbiertosPlanos = pedidosAbiertos.map((p) => ({
    id: p.id,
    numero: p.numero,
    proyectoId: p.proyectoId,
    proveedorId: p.proveedorId,
    items: p.items
      .map((i) => ({
        pedidoItemId: i.id,
        materialNombre: i.material.nombre,
        unidad: i.unidad,
        restante: Number(i.cantidadPedida) - Number(i.cantidadEntregada),
        pesoPorBarra: i.material.pesoPorBarra ? Number(i.material.pesoPorBarra) : null,
      }))
      .filter((i) => i.restante > 0),
  }));

  const materialesPlanos = materiales.map((m) => ({
    ...m,
    pesoPorBarra: m.pesoPorBarra ? Number(m.pesoPorBarra) : null,
  }));

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

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {tipoInicial === "ENTREGA" ? "Nueva entrega" : "Nuevo pedido"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {tipoInicial === "ENTREGA"
          ? "Registrá la entrega de un pedido existente."
          : "Cargá un pedido nuevo para un proveedor."}
      </p>
      <div className="mt-6 max-w-2xl">
        <MovimientoForm
          proyectos={proyectos}
          rubros={rubros}
          materiales={materialesPlanos}
          pedidosAbiertos={pedidosAbiertosPlanos}
          acopios={acopiosOpciones}
          tipoInicial={tipoInicial}
        />
      </div>
    </div>
  );
}
