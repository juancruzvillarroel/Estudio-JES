import { ComputoBoard } from "@/components/computos/computo-board";
import {
  incluirMediciones,
  mapFechaComputo,
  mapFilaExtra,
  mapItem,
  mapSeccion,
} from "@/lib/computos";
import { mapNivel } from "@/lib/niveles";
import { prisma } from "@/lib/db";

/**
 * "Cómputos 2": una grilla en paralelo a la de "Cómputo", para volver a
 * cargar un rubro de cero sin tocar lo que ya está armado del otro lado.
 *
 * Es el mismo tablero (`ComputoBoard`), los mismos rubros de siempre y los
 * mismos niveles y fechas de la obra —son de la obra entera, no de un área—,
 * pero sólo trae las secciones marcadas `esComputos2: true` y lo que cuelga
 * de ellas. Arranca vacío, rubro por rubro, igual que empezaría "Cómputo" si
 * se vaciara: las secciones (MUROS, HORMIGÓN, REVOQUES) se crean a mano
 * desde acá adentro, con el mismo botón "+ Sección" de siempre, y pueden
 * tener el mismo nombre que ya usa "Cómputo" sin chocar, porque la unicidad
 * del nombre está separada por área (ver ComputoSeccion.esComputos2).
 */
export async function ComputoSection2({
  proyectoId,
  proyectoNombre,
}: {
  proyectoId: string;
  proyectoNombre: string;
}) {
  const [niveles, rubros, secciones, filasExtra, items, fechas] = await Promise.all([
    prisma.nivelProyecto.findMany({
      where: { proyectoId },
      orderBy: { orden: "asc" },
    }),
    prisma.rubro.findMany({
      where: { seComputa: true },
      orderBy: { orden: "asc" },
      select: {
        id: true,
        nombre: true,
        subrubros: {
          orderBy: { orden: "asc" },
          select: { id: true, nombre: true },
        },
      },
    }),
    prisma.computoSeccion.findMany({
      where: { proyectoId, esComputos2: true },
      orderBy: { orden: "asc" },
    }),
    prisma.computoFilaExtra.findMany({
      where: { seccion: { proyectoId, esComputos2: true } },
      orderBy: { orden: "asc" },
    }),
    prisma.computoItem.findMany({
      where: { proyectoId, seccion: { esComputos2: true } },
      orderBy: { orden: "asc" },
      include: incluirMediciones,
    }),
    prisma.computoFecha.findMany({ where: { proyectoId } }),
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
      fechas={fechas.map(mapFechaComputo)}
      esComputos2
    />
  );
}
