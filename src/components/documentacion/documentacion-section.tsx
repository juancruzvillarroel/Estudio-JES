import { prisma } from "@/lib/db";
import { DocumentacionBoard } from "./documentacion-board";

export async function DocumentacionSection({ proyectoId }: { proyectoId: string }) {
  const [categorias, tipos, documentos] = await Promise.all([
    prisma.documentoCategoria.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
    }),
    prisma.documentoTipo.findMany({
      where: { activo: true, OR: [{ proyectoId: null }, { proyectoId }] },
      orderBy: { orden: "asc" },
    }),
    prisma.documento.findMany({
      where: { proyectoId },
    }),
  ]);

  return (
    <DocumentacionBoard
      proyectoId={proyectoId}
      categorias={categorias}
      tipos={tipos}
      documentos={documentos}
    />
  );
}
