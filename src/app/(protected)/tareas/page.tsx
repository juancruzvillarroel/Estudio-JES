import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { TareasGlobal } from "@/components/tareas/tareas-global";
import { mapTarea, tareaInclude } from "@/lib/tareas";

export default async function TareasPage() {
  // Las tareas no están detrás de un permiso de sección: las ve cualquier
  // usuario logueado (ver NAV_ITEMS, la entrada va sin `key`).
  await verifySession();

  const [tareasRaw, proyectos, rubros, usuarios] = await Promise.all([
    prisma.tarea.findMany({ include: tareaInclude, orderBy: { createdAt: "desc" } }),
    prisma.proyecto.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.rubro.findMany({ orderBy: { orden: "asc" }, select: { id: true, nombre: true } }),
    prisma.user.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return (
    <div>
      <div className="border-b border-neutral-800 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">Tareas</h1>
        <p className="text-sm text-muted-foreground">
          Pendientes de todas las obras. Filtrá por obra, rubro o persona asignada.
        </p>
      </div>

      <div className="mt-6">
        <TareasGlobal
          tareas={tareasRaw.map(mapTarea)}
          proyectos={proyectos}
          rubros={rubros}
          usuarios={usuarios}
        />
      </div>
    </div>
  );
}
