import { prisma } from "./db";

/**
 * Las tablas con las que arranca Cómputos 2 en cada obra.
 *
 * Es la ALBAÑILERÍA que se armó y se dio por buena en CONDARCO: las tres
 * secciones de materiales, con sus ítems, la unidad, el desperdicio y la
 * conversión a palets. Sólo la estructura: ningún número medido, que es de
 * cada obra.
 *
 * Vive en código y no se lee de CONDARCO a propósito: si mañana alguien
 * cambia o borra algo en esa obra, las obras nuevas no tienen por qué
 * heredarlo sin que nadie lo decida.
 */
type ItemPlantilla = {
  nombre: string;
  unidad: "M2";
  desperdicio?: number;
  rinde?: number;
  rindeUnidad?: "UN";
  porBulto?: number;
  bultoNombre?: string;
};

type SeccionPlantilla = {
  /** Se busca sin tildes ni mayúsculas entre los rubros que se computan. */
  rubro: string;
  tipo: "MATERIALES";
  nombre: string;
  items: ItemPlantilla[];
};

const ladrillo = (nombre: string, porBulto: number): ItemPlantilla => ({
  nombre,
  unidad: "M2",
  desperdicio: 10,
  rinde: 15,
  rindeUnidad: "UN",
  porBulto,
  bultoNombre: "Palet",
});

const m2 = (nombre: string): ItemPlantilla => ({ nombre, unidad: "M2" });

export const PLANTILLA_COMPUTOS2: SeccionPlantilla[] = [
  {
    rubro: "ALBANILERIA",
    tipo: "MATERIALES",
    nombre: "MAMPOSTERÍA",
    items: [
      ladrillo("Ladrillo Hueco del 8", 198),
      ladrillo("Ladrillo Hueco del 12", 144),
      ladrillo("Ladrillo Portante del 12", 140),
      ladrillo("Ladrillo Portante del 18", 90),
    ],
  },
  {
    rubro: "ALBANILERIA",
    tipo: "MATERIALES",
    nombre: "REVOQUES",
    items: [
      m2("Revoque Interior"),
      m2("Revoque Exterior 3 en 1"),
      m2("Revoque Bajo Revestimiento"),
      m2("Revoque Proyectado Medianera"),
    ],
  },
  {
    rubro: "ALBANILERIA",
    tipo: "MATERIALES",
    nombre: "CONTRAPISOS / CARPETAS",
    items: [
      m2("Interior"),
      m2("Interior p/ losa radiante"),
      m2("Impermeable (manta + pintura)"),
      m2("Impermeable (membrana)"),
    ],
  },
];

const sinTildes = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/**
 * Agrega a una obra las secciones de la plantilla que le falten en
 * Cómputos 2, con sus ítems.
 *
 * Una sección que la obra ya tiene (mismo rubro, lado y nombre) no se toca:
 * ni se le agregan ítems ni se le cambia nada, porque puede estar armada
 * a propósito distinta. Así se puede correr de nuevo sin duplicar nada.
 *
 * Devuelve los nombres de las secciones que creó (o que crearía, con
 * `simular`).
 */
export async function aplicarPlantillaComputos2(
  proyectoId: string,
  { simular = false }: { simular?: boolean } = {}
): Promise<string[]> {
  const rubros = await prisma.rubro.findMany({
    where: { seComputa: true },
    select: { id: true, nombre: true },
  });
  const rubroDe = (nombre: string) =>
    rubros.find((r) => sinTildes(r.nombre) === sinTildes(nombre)) ?? null;

  const creadas: string[] = [];

  for (const seccion of PLANTILLA_COMPUTOS2) {
    const rubro = rubroDe(seccion.rubro);
    if (!rubro) continue;

    const existentes = await prisma.computoSeccion.findMany({
      where: { proyectoId, rubroId: rubro.id, tipo: seccion.tipo, esComputos2: true },
      select: { nombre: true, orden: true },
    });
    if (existentes.some((s) => sinTildes(s.nombre) === sinTildes(seccion.nombre))) continue;

    creadas.push(`${rubro.nombre} / ${seccion.nombre}`);
    if (simular) continue;

    const ultimoItem = await prisma.computoItem.findFirst({
      where: { proyectoId },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    const desde = (ultimoItem?.orden ?? -1) + 1;

    await prisma.computoSeccion.create({
      data: {
        proyectoId,
        rubroId: rubro.id,
        tipo: seccion.tipo,
        nombre: seccion.nombre,
        esComputos2: true,
        orden: Math.max(-1, ...existentes.map((s) => s.orden)) + 1,
        items: {
          create: seccion.items.map((item, i) => ({
            proyectoId,
            rubroId: rubro.id,
            nombre: item.nombre,
            unidad: item.unidad,
            desperdicio: item.desperdicio ?? null,
            rinde: item.rinde ?? null,
            rindeUnidad: item.rindeUnidad ?? null,
            porBulto: item.porBulto ?? null,
            bultoNombre: item.bultoNombre ?? null,
            orden: desde + i,
          })),
        },
      },
    });
  }

  return creadas;
}
