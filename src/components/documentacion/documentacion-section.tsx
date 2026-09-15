import { prisma } from "@/lib/db";
import { DocumentacionBoard } from "./documentacion-board";

export async function DocumentacionSection({ proyectoId }: { proyectoId: string }) {
  const [categorias, tipos, reemplazos, documentos] = await Promise.all([
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
  ]);

  // De cada documento compartido que esta obra se despegó se lista la copia
  // propia, que es la que trae el nombre y el orden que se le puso acá.
  const reemplazados = new Set(reemplazos.map((r) => r.reemplazaTipoId));

  return (
    <DocumentacionBoard
      proyectoId={proyectoId}
      categorias={categorias}
      tipos={tipos.filter((t) => !reemplazados.has(t.id))}
      documentos={documentos}
    />
  );
}
