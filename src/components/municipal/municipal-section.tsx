import { prisma } from "@/lib/db";
import { MunicipalBoard } from "./municipal-board";

export async function MunicipalSection({ proyectoId }: { proyectoId: string }) {
  const [tipos, tramites] = await Promise.all([
    prisma.tramiteMunicipalTipo.findMany({
      where: { activo: true },
      orderBy: [{ categoria: "asc" }, { etapa: "asc" }, { orden: "asc" }],
    }),
    prisma.tramiteMunicipal.findMany({
      where: { proyectoId },
    }),
  ]);

  return <MunicipalBoard proyectoId={proyectoId} tipos={tipos} tramites={tramites} />;
}
