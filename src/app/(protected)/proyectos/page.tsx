import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProyectoDialog } from "@/components/proyectos/proyecto-dialog";

const ESTADO_LABELS = {
  ACTIVO: "Activo",
  PAUSADO: "Pausado",
  FINALIZADO: "Finalizado",
};

export default async function ProyectosPage() {
  await requireSeccion("proyectos");

  const proyectos = await prisma.proyecto.findMany({
    orderBy: { createdAt: "desc" },
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {proyectos.map((p) => (
            <Link key={p.id} href={`/proyectos/${p.id}`}>
              <Card className="h-full overflow-hidden pt-0 transition-colors hover:bg-muted/50">
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
                <CardHeader className="flex flex-row items-start justify-between">
                  <CardTitle className="text-base">{p.nombre}</CardTitle>
                  <Badge variant={p.estado === "ACTIVO" ? "secondary" : "outline"}>
                    {ESTADO_LABELS[p.estado]}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{p.direccion ?? "Sin dirección"}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
