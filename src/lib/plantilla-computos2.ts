import { prisma } from "./db";

/**
 * Las tablas con las que arranca Cómputos 2 en cada obra.
 *
 * Es la ALBAÑILERÍA que se armó y se dio por buena en CONDARCO: las tres
 * secciones de materiales, con sus ítems, la unidad, el desperdicio y la
 * conversión a palets. Y la ESTRUCTURA H°A tal como está en "Cómputo" en
 * todas las obras: HORMIGÓN, HIERRO (con su peso por metro y las barras) y
 * MANO DE OBRA, con la fila extra FUNDACIONES arriba de los niveles. Sólo la
 * estructura: ningún número medido, que es de cada obra.
 *
 * Vive en código y no se lee de CONDARCO a propósito: si mañana alguien
 * cambia o borra algo en esa obra, las obras nuevas no tienen por qué
 * heredarlo sin que nadie lo decida.
 */
type ItemPlantilla = {
  nombre: string;
  unidad: "M2" | "M3" | "ML";
  desperdicio?: number;
  rinde?: number;
  rindeUnidad?: "UN" | "KG";
  porBulto?: number;
  bultoNombre?: string;
};

type SeccionPlantilla = {
  /** Se busca sin tildes ni mayúsculas entre los rubros que se computan. */
  rubro: string;
  tipo: "MATERIALES" | "MANO_DE_OBRA";
  nombre: string;
  items: ItemPlantilla[];
  /** Filas que no son niveles de la obra; van arriba de los niveles. */
  filasExtra?: string[];
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
const m3 = (nombre: string): ItemPlantilla => ({ nombre, unidad: "M3" });
const ml = (nombre: string): ItemPlantilla => ({ nombre, unidad: "ML" });

/** Hierro: se mide en metros, se pide en kilos y se compra en barras de 12 m. */
const hierro = (diametro: number, kgPorMetro: number, kgPorBarra: number): ItemPlantilla => ({
  nombre: `Ø${diametro}`,
  unidad: "ML",
  rinde: kgPorMetro,
  rindeUnidad: "KG",
  porBulto: kgPorBarra,
  bultoNombre: "barra",
});

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
      m2("Revoque Caja de Escaleras"),
    ],
  },
  {
    rubro: "ALBANILERIA",
    tipo: "MATERIALES",
    nombre: "CONTRAPISOS / CARPETAS",
    items: [
      m2("Interior"),
      m2("Interior p/ losa radiante"),
      m2("Impermeable (locales húmedos)"),
      m2("Impermeable (manta + pintura)"),
      m2("Impermeable (membrana)"),
    ],
  },
  {
    rubro: "ESTRUCTURA_H°A",
    tipo: "MATERIALES",
    nombre: "HORMIGÓN",
    filasExtra: ["FUNDACIONES"],
    items: [
      m3("Columnas"),
      m3("Vigas"),
      m3("Losas"),
      m3("Escaleras"),
      m3("Tabiques"),
      m3("Bases"),
    ],
  },
  {
    rubro: "ESTRUCTURA_H°A",
    tipo: "MATERIALES",
    nombre: "HIERRO",
    filasExtra: ["FUNDACIONES"],
    items: [
      hierro(6, 0.2217, 2.66),
      hierro(8, 0.395, 4.74),
      hierro(10, 0.6167, 7.4),
      hierro(12, 0.8917, 10.7),
      hierro(16, 1.575, 18.9),
      hierro(20, 2.4667, 29.6),
      hierro(25, 3.85, 46.2),
    ],
  },
  {
    rubro: "ESTRUCTURA_H°A",
    tipo: "MANO_DE_OBRA",
    nombre: "MANO DE OBRA",
    items: [
      m2("Losa vista"),
      m2("Tabique"),
      ml("Viga vista"),
      m2("Losa, viga, columna (no visto)"),
    ],
  },
];

const sinTildes = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

const datosItem = (proyectoId: string, rubroId: string, item: ItemPlantilla, orden: number) => ({
  proyectoId,
  rubroId,
  nombre: item.nombre,
  unidad: item.unidad,
  desperdicio: item.desperdicio ?? null,
  rinde: item.rinde ?? null,
  rindeUnidad: item.rindeUnidad ?? null,
  porBulto: item.porBulto ?? null,
  bultoNombre: item.bultoNombre ?? null,
  orden,
});

/**
 * Lleva una obra a la plantilla en Cómputos 2.
 *
 * - Una sección que falta se crea entera, con sus ítems.
 * - Una sección que ya está recibe sólo los ítems de la plantilla que le
 *   falten (comparando el nombre sin tildes ni mayúsculas), y sus ítems se
 *   reordenan como en la plantilla, con los propios de la obra al final.
 *   No se borra ni se cambia ningún ítem que ya esté.
 *
 * Así se puede correr de nuevo sin duplicar nada: correrlo dos veces da lo
 * mismo que una.
 *
 * Devuelve qué agregó (o qué agregaría, con `simular`).
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

  const cambios: string[] = [];

  const niveles = await prisma.nivelProyecto.findMany({
    where: { proyectoId },
    orderBy: { orden: "asc" },
    select: { id: true },
  });

  /**
   * Agrega a la sección las filas extra de la plantilla que le falten, arriba
   * de todo (como FUNDACIONES en "Cómputo"). Si la sección no tenía orden
   * propio, se le arma uno: las extra primero y después los niveles.
   */
  const completarFilasExtra = async (
    seccionId: string,
    plantilla: SeccionPlantilla,
    tiene: { nombre: string }[],
    ordenFilas: string[]
  ) => {
    const faltan = (plantilla.filasExtra ?? []).filter(
      (f) => !tiene.some((t) => sinTildes(t.nombre) === sinTildes(f))
    );
    if (faltan.length === 0) return [];
    if (simular) return faltan;
    const claves: string[] = [];
    for (const [i, nombre] of faltan.entries()) {
      const fila = await prisma.computoFilaExtra.create({
        data: { seccionId, nombre, orden: i },
        select: { id: true },
      });
      claves.push(`extra:${fila.id}`);
    }
    const resto = ordenFilas.length > 0 ? ordenFilas : niveles.map((n) => `nivel:${n.id}`);
    await prisma.computoSeccion.update({
      where: { id: seccionId },
      data: { ordenFilas: [...claves, ...resto] },
    });
    return faltan;
  };

  const siguienteOrden = async () => {
    const ultimo = await prisma.computoItem.findFirst({
      where: { proyectoId },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    return (ultimo?.orden ?? -1) + 1;
  };

  for (const seccion of PLANTILLA_COMPUTOS2) {
    const rubro = rubroDe(seccion.rubro);
    if (!rubro) continue;

    const existentes = await prisma.computoSeccion.findMany({
      where: { proyectoId, rubroId: rubro.id, tipo: seccion.tipo, esComputos2: true },
      select: {
        id: true,
        nombre: true,
        orden: true,
        ordenFilas: true,
        filasExtra: { select: { nombre: true } },
        items: { select: { id: true, nombre: true, orden: true }, orderBy: { orden: "asc" } },
      },
    });
    const yaEsta = existentes.find((s) => sinTildes(s.nombre) === sinTildes(seccion.nombre));

    if (!yaEsta) {
      cambios.push(`${seccion.nombre} (tabla nueva)`);
      if (simular) continue;
      const desde = await siguienteOrden();
      const creada = await prisma.computoSeccion.create({
        data: {
          proyectoId,
          rubroId: rubro.id,
          tipo: seccion.tipo,
          nombre: seccion.nombre,
          esComputos2: true,
          orden: Math.max(-1, ...existentes.map((s) => s.orden)) + 1,
          items: {
            create: seccion.items.map((item, i) => datosItem(proyectoId, rubro.id, item, desde + i)),
          },
        },
        select: { id: true },
      });
      await completarFilasExtra(creada.id, seccion, [], []);
      continue;
    }

    const filasNuevas = await completarFilasExtra(
      yaEsta.id,
      seccion,
      yaEsta.filasExtra,
      yaEsta.ordenFilas
    );
    if (filasNuevas.length > 0) {
      cambios.push(`${seccion.nombre}: fila ${filasNuevas.join(", ")}`);
    }

    const faltan = seccion.items.filter(
      (item) => !yaEsta.items.some((i) => sinTildes(i.nombre) === sinTildes(item.nombre))
    );
    if (faltan.length === 0) continue;
    cambios.push(`${seccion.nombre}: ${faltan.map((i) => i.nombre).join(", ")}`);
    if (simular) continue;

    let desde = await siguienteOrden();
    const creados = new Map<string, string>();
    for (const item of faltan) {
      const nuevo = await prisma.computoItem.create({
        data: { ...datosItem(proyectoId, rubro.id, item, desde++), seccionId: yaEsta.id },
        select: { id: true },
      });
      creados.set(sinTildes(item.nombre), nuevo.id);
    }

    // El orden de la plantilla, y después los ítems propios de la obra en el
    // orden que ya tenían. Arranca desde donde arrancaba la sección.
    const idDe = (nombre: string) =>
      creados.get(sinTildes(nombre)) ??
      yaEsta.items.find((i) => sinTildes(i.nombre) === sinTildes(nombre))!.id;
    const deLaPlantilla = seccion.items.map((item) => idDe(item.nombre));
    const propios = yaEsta.items.map((i) => i.id).filter((id) => !deLaPlantilla.includes(id));
    const base = Math.min(desde, ...yaEsta.items.map((i) => i.orden));
    await prisma.$transaction(
      [...deLaPlantilla, ...propios].map((id, i) =>
        prisma.computoItem.update({ where: { id }, data: { orden: base + i } })
      )
    );
  }

  return cambios;
}
