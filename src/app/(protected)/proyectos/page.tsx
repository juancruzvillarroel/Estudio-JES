import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ProyectoDialog } from "@/components/proyectos/proyecto-dialog";
import { capitalizarOracion } from "@/lib/utils";

export default async function ProyectosPage() {
  await requireSeccion("proyectos");

  const proyectos = await prisma.proyecto.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pedidos: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">Todas las obras del estudio.</p>
        </div>
        <ProyectoDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          }
        />
      </div>

      {proyectos.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Todavía no hay proyectos cargados.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((p) => {
            const tieneMovimientos = p._count.pedidos > 0;
            return (
              <Link key={p.id} href={`/proyectos/${p.id}`}>
                <Card size="sm" className="h-full overflow-hidden pt-0 transition-colors hover:bg-muted/50">
                  {p.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imagenUrl}
                      alt={p.nombre}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-t-xl bg-muted text-sm text-muted-foreground">
                      Sin imagen
                    </div>
                  )}
                  <CardContent className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-bold">{p.nombre}</CardTitle>
                      {p.barrio && (
                        <p className="truncate text-xs text-muted-foreground">
                          {capitalizarOracion(p.barrio)}
                        </p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">
                        {p.direccion ? capitalizarOracion(p.direccion) : "Sin dirección"}
                      </p>
                    </div>
                    <Badge variant={tieneMovimientos ? "success" : "secondary"} className="shrink-0">
                      {tieneMovimientos ? "Activo" : "Espera"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
