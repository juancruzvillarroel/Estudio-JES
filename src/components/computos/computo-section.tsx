import { ComputoBoard } from "@/components/computos/computo-board";
import { mapFilaExtra, mapItem, mapSeccion } from "@/lib/computos";
import { mapNivel } from "@/lib/niveles";
import { prisma } from "@/lib/db";

export async function ComputoSection({
  proyectoId,
  proyectoNombre,
}: {
  proyectoId: string;
  proyectoNombre: string;
}) {
  const [niveles, rubros, secciones, filasExtra, items] = await Promise.all([
    // Las filas de cada grilla: se cargan a mano en "Editar datos", con el
    // nombre que tienen en la obra ("PLANTA TIPO", "4TO PISO").
    prisma.nivelProyecto.findMany({
      where: { proyectoId },
      orderBy: { orden: "asc" },
    }),
    // Sólo los rubros de obra, de ESTRUCTURA H°A a REVESTIMIENTOS. Van todos,
    // tengan o no algo cargado: la lista es el índice de lo que hay que
    // computar, y el rubro vacío es justamente el que hay que mirar.
    prisma.rubro.findMany({
      where: { seComputa: true },
      orderBy: { orden: "asc" },
      select: {
        id: true,
        nombre: true,
        // Para el informe impreso, que todavía agrupa por subrubro.
        subrubros: {
          orderBy: { orden: "asc" },
          select: { id: true, nombre: true },
        },
      },
    }),
    prisma.computoSeccion.findMany({
      where: { proyectoId },
      orderBy: { orden: "asc" },
    }),
    // Las filas puntuales de cada sección ("SALA DE MÁQUINAS" adentro de MUROS).
    // Se traen de toda la obra de una y después cada grilla toma las suyas.
    prisma.computoFilaExtra.findMany({
      where: { seccion: { proyectoId } },
      orderBy: { orden: "asc" },
    }),
    prisma.computoItem.findMany({
      where: { proyectoId },
      orderBy: { orden: "asc" },
      include: { mediciones: { orderBy: { orden: "asc" } } },
    }),
  ]);

  return (
    <ComputoBoard
      proyectoId={proyectoId}
      proyectoNombre={proyectoNombre}
      niveles={niveles.map(mapNivel)}
      rubros={rubros}
      secciones={secciones.map(mapSeccion)}
      filasExtra={filasExtra.map(mapFilaExtra)}
      items={items.map(mapItem)}
    />
  );
}
