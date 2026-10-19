import { prisma } from "@/lib/db";
import { DocumentacionBoard } from "./documentacion-board";

export async function DocumentacionSection({ proyectoId }: { proyectoId: string }) {
  const [categorias, tipos, reemplazos, documentosRaw, tareasActivas, rubros, usuarios] =
    await Promise.all([
      prisma.documentoCategoria.findMany({
        where: { activo: true },
        orderBy: { orden: "asc" },
      }),
      prisma.documentoTipo.findMany({
        where: { activo: true, OR: [{ proyectoId: null }, { proyectoId }] },
        orderBy: { orden: "asc" },
      }),
      // Sin filtrar por activo a propósito: si la copia se eliminó, el
      // compartido tiene que seguir tapado. Si no, borrar un documento que
      // habías renombrado haría reaparecer al original con el nombre viejo.
      prisma.documentoTipo.findMany({
        where: { proyectoId, reemplazaTipoId: { not: null } },
        select: { reemplazaTipoId: true },
      }),
      prisma.documento.findMany({
        where: { proyectoId },
      }),
      // La tarea activa (sin completar) de cada plano que tiene una
      // vinculada: de ahí sale el amarillo/rojo del puntito cuando el plano
      // todavía no está presentado. Filtrado a "no completada" porque un
      // plano no puede tener más de una tarea activa a la vez (ver
      // crearTarea en actions/tareas.ts), así que alcanza con una por
      // documento.
      prisma.tarea.findMany({
        where: { proyectoId, documentoId: { not: null }, estado: { not: "COMPLETADA" } },
        select: { id: true, documentoId: true, estado: true, aCorregir: true, titulo: true },
      }),
      // Para el <Select> de rubro al crear una tarea desde un plano (ver botón
      // "Nueva tarea" en DocumentoItemCard).
      prisma.rubro.findMany({ orderBy: { orden: "asc" }, select: { id: true, nombre: true } }),
      prisma.user.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    ]);

  // De cada documento compartido que esta obra se despegó se lista la copia
  // propia, que es la que trae el nombre y el orden que se le puso acá.
  const reemplazados = new Set(reemplazos.map((r) => r.reemplazaTipoId));

  const tareaActivaPorDocumento = new Map(tareasActivas.map((t) => [t.documentoId!, t]));
  const documentos = documentosRaw.map((d) => ({
    ...d,
    tareaActiva: tareaActivaPorDocumento.get(d.id) ?? null,
  }));

  return (
    <DocumentacionBoard
      proyectoId={proyectoId}
      categorias={categorias}
      tipos={tipos.filter((t) => !reemplazados.has(t.id))}
      documentos={documentos}
      rubros={rubros}
      usuarios={usuarios}
    />
  );
}
