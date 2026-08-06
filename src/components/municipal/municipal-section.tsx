import { prisma } from "@/lib/db";
import { MunicipalBoard } from "./municipal-board";

export async function MunicipalSection({ proyectoId }: { proyectoId: string }) {
  const [categorias, etapas, tipos, tramites] = await Promise.all([
    prisma.categoriaMunicipal.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
    }),
    prisma.etapaMunicipal.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
    }),
    prisma.tramiteMunicipalTipo.findMany({
      where: { activo: true },
      orderBy: [{ orden: "asc" }],
    }),
    prisma.tramiteMunicipal.findMany({
      where: { proyectoId },
    }),
  ]);

  return (
    <MunicipalBoard
      proyectoId={proyectoId}
      categorias={categorias}
      etapas={etapas}
      tipos={tipos}
      tramites={tramites}
    />
  );
}
