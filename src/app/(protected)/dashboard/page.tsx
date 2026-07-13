import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const proyectos = await prisma.proyecto.findMany({
    where: { estado: "ACTIVO" },
    include: {
      pedidos: {
        where: { estado: { in: ["PENDIENTE", "PARCIAL"] } },
        include: { proveedor: true, items: { include: { material: true } } },
      },
    },
    orderBy: { nombre: "asc" },
  });

  const resumenes = proyectos.map((proyecto) => {
    const pendientes = proyecto.pedidos.filter((p) => p.estado === "PENDIENTE").length;
    const parciales = proyecto.pedidos.filter((p) => p.estado === "PARCIAL").length;

    const faltantesPorMaterial = new Map<
      string,
      { nombre: string; unidad: string; cantidad: number; proveedorNombre: string }
    >();
    for (const pedido of proyecto.pedidos) {
      for (const item of pedido.items) {
        const falta = Number(item.cantidadPedida) - Number(item.cantidadEntregada);
        if (falta <= 0) continue;
        const clave = `${item.materialId}-${pedido.proveedorId}`;
        const acumulado = faltantesPorMaterial.get(clave);
        if (acumulado) {
          acumulado.cantidad += falta;
        } else {
          faltantesPorMaterial.set(clave, {
            nombre: item.material.nombre,
            unidad: item.unidad,
            cantidad: falta,
            proveedorNombre: pedido.proveedor.nombre,
          });
        }
      }
    }

    return {
      proyecto,
      pendientes,
      parciales,
      faltantes: Array.from(faltantesPorMaterial.values()),
    };
  });

  const conAbastecimientoAbierto = resumenes.filter((r) => r.pendientes + r.parciales > 0);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Inicio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Abastecimiento de todos los proyectos activos, en un mismo lugar.
      </p>

      {conAbastecimientoAbierto.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No hay pedidos pendientes ni parciales en proyectos activos. Todo al día.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {conAbastecimientoAbierto.map(({ proyecto, pendientes, parciales, faltantes }) => (
            <Link key={proyecto.id} href={`/proyectos/${proyecto.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader className="flex flex-row items-start justify-between gap-2 bg-neutral-800 py-3">
                  <CardTitle className="text-base font-bold text-white">{proyecto.nombre}</CardTitle>
                  <div className="flex gap-1">
                    {pendientes > 0 && <Badge variant="secondary">{pendientes} pendientes</Badge>}
                    {parciales > 0 && <Badge variant="secondary">{parciales} parciales</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-medium text-muted-foreground">Faltan:</p>
                  <ul className="mt-1 text-sm text-error">
                    {faltantes.slice(0, 4).map((f) => (
                      <li key={`${f.nombre}-${f.proveedorNombre}`}>
                        {f.cantidad} {f.unidad} de {f.nombre}{" "}
                        <span className="font-medium text-foreground">— {f.proveedorNombre}</span>
                      </li>
                    ))}
                    {faltantes.length > 4 && (
                      <li className="text-muted-foreground">y {faltantes.length - 4} más...</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
