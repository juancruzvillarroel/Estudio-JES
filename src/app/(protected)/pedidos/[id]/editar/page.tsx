import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { EditarPedidoForm } from "@/components/pedidos/editar-pedido-form";
import type { AcopioOpcion } from "@/actions/acopios";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSeccion("pedidos");

  const { id } = await params;

  const [pedido, proyectos, rubros, materiales, acopios] = await Promise.all([
    prisma.pedido.findUnique({
      where: { id },
      include: {
        proyecto: true,
        items: { include: { material: true } },
        _count: { select: { entregas: true } },
      },
    }),
    prisma.proyecto.findMany({ where: { estado: "ACTIVO" }, orderBy: { nombre: "asc" } }),
    prisma.rubro.findMany({ include: { proveedores: true }, orderBy: { orden: "asc" } }),
    prisma.material.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.acopio.findMany({
      include: {
        material: true,
        precios: { include: { material: true } },
        pedidos: { where: { estado: { not: "CANCELADO" } }, include: { items: true } },
      },
      orderBy: { fecha: "desc" },
    }),
  ]);

  if (!pedido) {
    notFound();
  }

  // Si el proyecto del pedido ya no está activo, lo agregamos igual para
  // que el selector no quede vacío.
  const proyectosDisponibles = proyectos.some((p) => p.id === pedido.proyectoId)
    ? proyectos
    : [...proyectos, { id: pedido.proyectoId, nombre: pedido.proyecto.nombre }];

  const rubroInicial = rubros.find((r) => r.proveedores.some((p) => p.id === pedido.proveedorId));

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
      <h1 className="text-3xl font-semibold tracking-tight">Editar pedido</h1>
      <p className="text-sm text-muted-foreground">Modificá los datos del pedido.</p>
      <div className="mt-6 max-w-2xl">
        <EditarPedidoForm
          pedidoId={pedido.id}
          proyectos={proyectosDisponibles}
          rubros={rubros}
          materiales={materiales}
          acopios={acopiosOpciones}
          hasEntregas={pedido._count.entregas > 0}
          initial={{
            proyectoId: pedido.proyectoId,
            rubroId: rubroInicial?.id ?? "",
            proveedorId: pedido.proveedorId,
            acopioId: pedido.acopioId ?? "",
            fechaISO: pedido.fecha.toISOString(),
            notas: pedido.notas ?? "",
            archivoUrl: pedido.archivoUrl,
            items: pedido.items.map((item) => ({
              id: item.id,
              materialId: item.materialId,
              cantidad: Number(item.cantidadPedida),
              cantidadEntregada: Number(item.cantidadEntregada),
            })),
          }}
        />
      </div>
    </div>
  );
}
