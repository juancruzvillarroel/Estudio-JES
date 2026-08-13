import { prisma } from "@/lib/db";
import { mapTarea, tareaInclude } from "@/lib/tareas";
import { TareasBoard } from "./tareas-board";

export async function TareasSection({ proyectoId }: { proyectoId: string }) {
  const [tareasRaw, rubros, usuarios] = await Promise.all([
    prisma.tarea.findMany({
      where: { proyectoId },
      include: tareaInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.rubro.findMany({ orderBy: { orden: "asc" }, select: { id: true, nombre: true } }),
    prisma.user.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return (
    <TareasBoard
      proyectoId={proyectoId}
      tareas={tareasRaw.map(mapTarea)}
      rubros={rubros}
      usuarios={usuarios}
    />
  );
}
