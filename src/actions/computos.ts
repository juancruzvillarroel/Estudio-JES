"use server";

import { revalidatePath } from "next/cache";

import { requireSeccion } from "@/lib/dal";
import { prisma } from "@/lib/db";
import {
  creaCiclo,
  mapFilaExtra,
  mapItem,
  mapItemTipo,
  mapMedicion,
  mapSeccion,
  TIPOS_COMPUTO,
  UNIDADES,
  type ClaveFila,
  type FilaExtraOpcion,
  type ItemOpcion,
  type ItemTipoOpcion,
  type MedicionOpcion,
  type SeccionOpcion,
  type TipoComputo,
  type UnidadComputo,
} from "@/lib/computos";

type Result = { success: true } | { success: false; error: string };
type ResultItem = { success: true; item: ItemOpcion } | { success: false; error: string };
type ResultItems = { success: true; items: ItemOpcion[] } | { success: false; error: string };
type ResultMedicion =
  | { success: true; medicion: MedicionOpcion }
  | { success: false; error: string };
type ResultTipo = { success: true; tipo: ItemTipoOpcion } | { success: false; error: string };
type ResultSeccion =
  | { success: true; seccion: SeccionOpcion }
  | { success: false; error: string };
type ResultFilaExtra =
  | { success: true; fila: FilaExtraOpcion }
  | { success: false; error: string };

/**
 * Lo que se trae de un ítem en todos lados: sus filas, en orden, con la
 * cantidad de repeticiones del nivel de cada fila (para "planta tipo" x4,
 * ver parcialMedicion en lib/computos.ts).
 */
const incluirMediciones = {
  mediciones: {
    orderBy: { orden: "asc" } as const,
    include: { nivel: { select: { repeticiones: true } } },
  },
};

const esUnidad = (v: string): v is UnidadComputo => (UNIDADES as string[]).includes(v);

const esTipoComputo = (v: string): v is TipoComputo =>
  (TIPOS_COMPUTO as string[]).includes(v);

/**
 * Valida una dimensión que llega del cliente.
 *
 * Vacía es válida (la medida todavía no se cargó); lo que se rechaza es un
 * número que no sea positivo. Devuelve el valor ya normalizado a null para que
 * quien llama no tenga que distinguir entre undefined, "" y null.
 */
function normalizarDimension(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return { ok: true as const, valor: null };
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false as const, valor: null };
  return { ok: true as const, valor };
}

/**
 * Resuelve el nivel que llega del cliente contra los niveles de ESTA obra.
 *
 * Vacío es null, que quiere decir "no es de ninguna planta" (la excavación, el
 * obrador, el cerco). Cualquier otro valor tiene que ser un nivel cargado en el
 * proyecto: la fila no tiene proyectoId propio, así que este es el único lugar
 * donde se puede impedir que el cómputo de una obra quede colgado del nivel de
 * otra.
 */
async function resolverNivel(proyectoId: string, valor: string | null | undefined) {
  const limpio = (valor ?? "").trim();
  if (!limpio) return { ok: true as const, valor: null };

  const nivel = await prisma.nivelProyecto.findFirst({
    where: { id: limpio, proyectoId },
    select: { id: true },
  });
  if (!nivel) return { ok: false as const, valor: null };
  return { ok: true as const, valor: nivel.id };
}

/**
 * Traduce la fila de la grilla a las dos columnas con las que se guarda.
 *
 * En la pantalla la fila es una sola cosa; en la base son dos campos excluyentes
 * (nivelId, filaExtraId) y el par "los dos en null" es "toda la obra". Traducir
 * en un solo lugar es lo que impide que aparezca por ahí una medida colgada de
 * un nivel y de una fila extra al mismo tiempo.
 *
 * Las dos ramas validan pertenencia, y no por trámite: ni la medición ni la fila
 * extra tienen proyectoId propio, así que este es el único punto donde se puede
 * impedir que el cómputo de una obra quede colgado del nivel de otra, o que una
 * columna de MUROS escriba en una fila que es de REVOQUES.
 */
async function resolverFila(proyectoId: string, seccionId: string | null, fila: ClaveFila) {
  if (fila.tipo === "general") {
    return { ok: true as const, nivelId: null, filaExtraId: null };
  }

  if (fila.tipo === "nivel") {
    const nivel = await resolverNivel(proyectoId, fila.id);
    if (!nivel.ok || !nivel.valor) {
      return { ok: false as const, error: "Ese nivel no es de esta obra." };
    }
    return { ok: true as const, nivelId: nivel.valor, filaExtraId: null };
  }

  const extra = await prisma.computoFilaExtra.findFirst({
    where: { id: fila.id, seccionId: seccionId ?? "" },
    select: { id: true },
  });
  if (!extra) return { ok: false as const, error: "Esa fila no es de esta sección." };
  return { ok: true as const, nivelId: null, filaExtraId: extra.id };
}

/**
 * Siguiente número de orden dentro de un grupo.
 *
 * Las altas se numeran al final para que la lista quede como la fue escribiendo
 * el usuario y no por fecha de creación. Se lee el máximo en vez de contar las
 * filas porque después de borrar una del medio el conteo repetiría un orden.
 */
async function siguienteOrdenItem(proyectoId: string) {
  const ultimo = await prisma.computoItem.findFirst({
    where: { proyectoId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultimo?.orden ?? -1) + 1;
}

async function siguienteOrdenMedicion(itemId: string) {
  const ultima = await prisma.computoMedicion.findFirst({
    where: { itemId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultima?.orden ?? -1) + 1;
}

/**
 * Marca como modificado el cómputo (rubro + lado) al que pertenece un ítem.
 *
 * Un "cómputo" es un rubro de un lado —materiales o mano de obra— y esta es
 * la fecha que se ve arriba a la derecha de esa grilla y la que se imprime en
 * el informe. Se llama desde cualquier acción que cambie un número: la celda,
 * el detalle por ambiente o una cuenta derivada; no cuando sólo se edita el
 * nombre o la unidad de un ítem.
 *
 * El lado sale de la sección del ítem. Sin sección (todavía no tiene grilla)
 * se cuenta como materiales, la misma convención que usa la pantalla para
 * mostrar esos ítems sueltos bajo ese switch.
 *
 * No hace falta que el ítem exista todavía con certeza acá: si no se
 * encuentra, no hay nada que tocar y se vuelve en silencio. El que llama ya
 * validó el ítem antes de escribir la medida.
 */
async function tocarFechaComputo(proyectoId: string, itemId: string) {
  const item = await prisma.computoItem.findUnique({
    where: { id: itemId },
    select: { rubroId: true, seccion: { select: { tipo: true } } },
  });
  if (!item) return;

  const tipo = item.seccion?.tipo ?? "MATERIALES";
  await prisma.computoFecha.upsert({
    where: { proyectoId_rubroId_tipo: { proyectoId, rubroId: item.rubroId, tipo } },
    create: { proyectoId, rubroId: item.rubroId, tipo },
    update: { modificadoEl: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

/**
 * El orden es por rubro Y por lado: cada grilla se numera desde cero.
 *
 * Si no se filtrara por tipo, la primera sección de mano de obra nacería con el
 * orden que sigue al de los materiales y aparecería al fondo de una lista en la
 * que es la única.
 */
async function siguienteOrdenSeccion(
  proyectoId: string,
  rubroId: string,
  tipo: TipoComputo
) {
  const ultima = await prisma.computoSeccion.findFirst({
    where: { proyectoId, rubroId, tipo },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultima?.orden ?? -1) + 1;
}

/**
 * Crea una sección adentro de un rubro: MUROS dentro de ALBAÑILERÍA.
 *
 * Es de esta obra y no del catálogo: las secciones se arman mirando la obra que
 * se está computando, y recién cuando sirven se copian a las demás.
 *
 * El rubro tiene que ser uno de los que se computan. No es una formalidad: los
 * rubros que quedan afuera (el terreno, la gestoría, los honorarios) no tienen
 * nada que medir, y una sección colgada de uno de ellos no se vería en ninguna
 * pantalla.
 *
 * El tipo dice de qué lado del switch nace, y no se puede cambiar después: una
 * sección de materiales que pasara a mano de obra se llevaría puestos sus ítems,
 * que están medidos en las unidades del otro lado.
 */
export async function crearSeccion(
  proyectoId: string,
  rubroId: string,
  tipo: string,
  nombre: string
): Promise<ResultSeccion> {
  await requireSeccion("proyectos");

  const limpio = nombre.trim();
  if (!limpio) return { success: false, error: "Poné un nombre para la sección." };
  if (!esTipoComputo(tipo)) return { success: false, error: "Ese tipo de cómputo no existe." };

  try {
    const rubro = await prisma.rubro.findFirst({
      where: { id: rubroId, seComputa: true },
      select: { id: true },
    });
    if (!rubro) return { success: false, error: "Ese rubro no se computa." };

    // El nombre sólo choca del mismo lado: HORMIGÓN puede estar en los dos.
    const repetida = await prisma.computoSeccion.findFirst({
      where: { proyectoId, rubroId, tipo, nombre: limpio },
      select: { id: true },
    });
    if (repetida) {
      return { success: false, error: `Ya hay una sección "${limpio}" en este rubro.` };
    }

    const seccion = await prisma.computoSeccion.create({
      data: {
        proyectoId,
        rubroId,
        tipo,
        nombre: limpio,
        orden: await siguienteOrdenSeccion(proyectoId, rubroId, tipo),
      },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, seccion: mapSeccion(seccion) };
  } catch (error) {
    console.error("crearSeccion", error);
    return { success: false, error: "No se pudo crear la sección." };
  }
}

export async function renombrarSeccion(
  proyectoId: string,
  seccionId: string,
  nombre: string
): Promise<ResultSeccion> {
  await requireSeccion("proyectos");

  const limpio = nombre.trim();
  if (!limpio) return { success: false, error: "Poné un nombre para la sección." };

  try {
    const existente = await prisma.computoSeccion.findFirst({
      where: { id: seccionId, proyectoId },
      select: { id: true, rubroId: true, tipo: true },
    });
    if (!existente) return { success: false, error: "No se encontró la sección." };

    // Choca contra las de su propio lado: el nombre puede repetirse en el otro.
    const repetida = await prisma.computoSeccion.findFirst({
      where: {
        proyectoId,
        rubroId: existente.rubroId,
        tipo: existente.tipo,
        nombre: limpio,
        id: { not: seccionId },
      },
      select: { id: true },
    });
    if (repetida) {
      return { success: false, error: `Ya hay una sección "${limpio}" en este rubro.` };
    }

    const seccion = await prisma.computoSeccion.update({
      where: { id: seccionId },
      data: { nombre: limpio },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, seccion: mapSeccion(seccion) };
  } catch (error) {
    console.error("renombrarSeccion", error);
    return { success: false, error: "No se pudo renombrar la sección." };
  }
}

/**
 * Borra una sección.
 *
 * Con ítems adentro no se borra: en la base la relación es Cascade, así que
 * borrarla se llevaría las columnas y todo lo medido en ellas de una sola vez y
 * sin avisar. Vaciarla primero obliga a mirar qué se está tirando.
 */
export async function eliminarSeccion(
  proyectoId: string,
  seccionId: string
): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    const seccion = await prisma.computoSeccion.findFirst({
      where: { id: seccionId, proyectoId },
      select: { id: true, _count: { select: { items: true } } },
    });
    if (!seccion) return { success: false, error: "No se encontró la sección." };

    const items = seccion._count.items;
    if (items > 0) {
      return {
        success: false,
        error:
          items === 1
            ? "La sección tiene 1 ítem. Borralo primero."
            : `La sección tiene ${items} ítems. Borralos primero.`,
      };
    }

    await prisma.computoSeccion.delete({ where: { id: seccionId } });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("eliminarSeccion", error);
    return { success: false, error: "No se pudo eliminar la sección." };
  }
}

export async function reordenarSecciones(
  proyectoId: string,
  rubroId: string,
  ids: string[]
): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    await prisma.$transaction(
      ids.map((id, orden) =>
        prisma.computoSeccion.update({
          where: { id, proyectoId, rubroId },
          data: { orden },
        })
      )
    );
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("reordenarSecciones", error);
    return { success: false, error: "No se pudo guardar el orden." };
  }
}

/**
 * Guarda en qué orden se leen las filas de una grilla.
 *
 * Recibe las claves ya armadas ("nivel:abc", "extra:def") y las escribe tal
 * cual: es un orden de pantalla, no un vínculo, y por eso no se valida que cada
 * una siga existiendo. Una clave muerta no rompe nada — al dibujar se ignora lo
 * que no está — y validarlas obligaría a ir a buscar dos tablas para guardar
 * algo que se rehace con un arrastre.
 *
 * Lo que sí se comprueba es que la sección sea de esta obra: sin eso, el orden
 * de una grilla se podría escribir desde el cómputo de otra.
 */
export async function reordenarFilasSeccion(
  proyectoId: string,
  seccionId: string,
  claves: string[]
): Promise<ResultSeccion> {
  await requireSeccion("proyectos");

  try {
    const existente = await prisma.computoSeccion.findFirst({
      where: { id: seccionId, proyectoId },
      select: { id: true },
    });
    if (!existente) return { success: false, error: "No se encontró la sección." };

    const seccion = await prisma.computoSeccion.update({
      where: { id: seccionId },
      data: { ordenFilas: claves },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, seccion: mapSeccion(seccion) };
  } catch (error) {
    console.error("reordenarFilasSeccion", error);
    return { success: false, error: "No se pudo guardar el orden." };
  }
}

// ---------------------------------------------------------------------------
// Filas extra
// ---------------------------------------------------------------------------

async function siguienteOrdenFilaExtra(seccionId: string) {
  const ultima = await prisma.computoFilaExtra.findFirst({
    where: { seccionId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultima?.orden ?? -1) + 1;
}

/**
 * Agrega una fila a UNA sección: "SALA DE MÁQUINAS" adentro de MUROS.
 *
 * Los niveles de la obra ya aparecen solos en todas las grillas, y está bien que
 * así sea: si hay un 4° piso, hay 4° piso en muros, en revoques y en pisos. Esto
 * es para el caso que existe en un solo lado, y queda en un solo lado
 * justamente para no llenar de renglones vacíos a las demás secciones.
 */
export async function crearFilaExtra(
  proyectoId: string,
  seccionId: string,
  nombre: string
): Promise<ResultFilaExtra> {
  await requireSeccion("proyectos");

  const limpio = nombre.trim();
  if (!limpio) return { success: false, error: "Poné un nombre para la fila." };

  try {
    const seccion = await prisma.computoSeccion.findFirst({
      where: { id: seccionId, proyectoId },
      select: { id: true },
    });
    if (!seccion) return { success: false, error: "No se encontró la sección." };

    const repetida = await prisma.computoFilaExtra.findFirst({
      where: { seccionId, nombre: limpio },
      select: { id: true },
    });
    if (repetida) {
      return { success: false, error: `Ya hay una fila "${limpio}" en esta sección.` };
    }

    const fila = await prisma.computoFilaExtra.create({
      data: {
        seccionId,
        nombre: limpio,
        orden: await siguienteOrdenFilaExtra(seccionId),
      },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, fila: mapFilaExtra(fila) };
  } catch (error) {
    console.error("crearFilaExtra", error);
    return { success: false, error: "No se pudo crear la fila." };
  }
}

export async function renombrarFilaExtra(
  proyectoId: string,
  filaId: string,
  nombre: string
): Promise<ResultFilaExtra> {
  await requireSeccion("proyectos");

  const limpio = nombre.trim();
  if (!limpio) return { success: false, error: "Poné un nombre para la fila." };

  try {
    const existente = await prisma.computoFilaExtra.findFirst({
      where: { id: filaId, seccion: { proyectoId } },
      select: { id: true, seccionId: true },
    });
    if (!existente) return { success: false, error: "No se encontró la fila." };

    const repetida = await prisma.computoFilaExtra.findFirst({
      where: { seccionId: existente.seccionId, nombre: limpio, id: { not: filaId } },
      select: { id: true },
    });
    if (repetida) {
      return { success: false, error: `Ya hay una fila "${limpio}" en esta sección.` };
    }

    const fila = await prisma.computoFilaExtra.update({
      where: { id: filaId },
      data: { nombre: limpio },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, fila: mapFilaExtra(fila) };
  } catch (error) {
    console.error("renombrarFilaExtra", error);
    return { success: false, error: "No se pudo renombrar la fila." };
  }
}

/**
 * Borra una fila extra.
 *
 * Con algo medido no se borra. En la base la relación es Cascade, así que
 * borrarla se llevaría lo cargado en todas las columnas de esa fila de una sola
 * vez y sin avisar; acá se frena y se dice cuántas celdas hay que vaciar
 * primero, para que tirar una medida sea siempre una decisión y no un efecto.
 */
export async function eliminarFilaExtra(
  proyectoId: string,
  filaId: string
): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    const fila = await prisma.computoFilaExtra.findFirst({
      where: { id: filaId, seccion: { proyectoId } },
      select: { id: true, _count: { select: { mediciones: true } } },
    });
    if (!fila) return { success: false, error: "No se encontró la fila." };

    const medidas = fila._count.mediciones;
    if (medidas > 0) {
      return {
        success: false,
        error:
          medidas === 1
            ? "La fila tiene 1 celda cargada. Vaciala primero."
            : `La fila tiene ${medidas} celdas cargadas. Vacialas primero.`,
      };
    }

    await prisma.computoFilaExtra.delete({ where: { id: filaId } });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("eliminarFilaExtra", error);
    return { success: false, error: "No se pudo eliminar la fila." };
  }
}

// ---------------------------------------------------------------------------
// Ítems
// ---------------------------------------------------------------------------

/**
 * Agrega una columna a una sección.
 *
 * La unidad y el desperdicio se cargan acá, una sola vez, porque son del
 * material y no de la pared: un ladrillo se rompe siempre igual, se lo esté
 * poniendo en la planta baja o en la azotea. Después el ítem aparece en todas
 * las filas de la grilla y lo único que queda por hacer es medir.
 *
 * El rubro no se pide: es el de la sección. Que el ítem quede en otro rubro que
 * la grilla donde se ve no tendría cómo ser cierto.
 */
export async function crearItemEnSeccion(
  proyectoId: string,
  seccionId: string,
  input: {
    nombre: string;
    unidad: string;
    desperdicio?: number | null;
    modelo?: string | null;
  } & ConversionInput
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  const nombre = input.nombre.trim();
  if (!nombre) return { success: false, error: "El nombre del ítem es obligatorio." };
  if (!esUnidad(input.unidad)) return { success: false, error: "La unidad no es válida." };
  const desperdicio = normalizarDesperdicio(input.desperdicio);
  if (!desperdicio.ok) {
    return { success: false, error: "El desperdicio tiene que estar entre 0 y 100." };
  }
  const conversion = normalizarConversion(input);
  if (!conversion.ok) return { success: false, error: conversion.error };

  try {
    const seccion = await prisma.computoSeccion.findFirst({
      where: { id: seccionId, proyectoId },
      select: { id: true, rubroId: true },
    });
    if (!seccion) return { success: false, error: "No se encontró la sección." };

    const item = await prisma.computoItem.create({
      data: {
        proyectoId,
        rubroId: seccion.rubroId,
        seccionId: seccion.id,
        nombre,
        unidad: input.unidad,
        desperdicio: desperdicio.valor,
        modelo: input.modelo?.trim() || null,
        ...conversion.valor,
        orden: await siguienteOrdenItem(proyectoId),
      },
      include: incluirMediciones,
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapItem(item) };
  } catch (error) {
    console.error("crearItemEnSeccion", error);
    return { success: false, error: "No se pudo crear el ítem." };
  }
}

/**
 * Edita el nombre, la unidad y el desperdicio de una columna.
 *
 * La unidad se puede cambiar con la columna ya medida y no se borra nada: pasar
 * de m² a m³ deja largo y ancho como estaban y sólo suma el alto, que es lo que
 * uno quiere cuando se dio cuenta tarde de que el ítem era volumétrico.
 *
 * La sección no se cambia acá. Mover una columna de MUROS a REVOQUES es mover
 * lo medido con ella, y eso no puede pasar de costado al corregir un nombre.
 */
export async function actualizarItemSeccion(
  proyectoId: string,
  itemId: string,
  input: {
    nombre: string;
    unidad: string;
    desperdicio?: number | null;
    modelo?: string | null;
  } & ConversionInput
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  const nombre = input.nombre.trim();
  if (!nombre) return { success: false, error: "El nombre del ítem es obligatorio." };
  if (!esUnidad(input.unidad)) return { success: false, error: "La unidad no es válida." };
  const desperdicio = normalizarDesperdicio(input.desperdicio);
  if (!desperdicio.ok) {
    return { success: false, error: "El desperdicio tiene que estar entre 0 y 100." };
  }
  const conversion = normalizarConversion(input);
  if (!conversion.ok) return { success: false, error: conversion.error };

  try {
    const item = await prisma.computoItem.update({
      where: { id: itemId, proyectoId },
      data: {
        nombre,
        unidad: input.unidad,
        desperdicio: desperdicio.valor,
        modelo: input.modelo?.trim() || null,
        ...conversion.valor,
      },
      include: incluirMediciones,
    });

    // El desperdicio y la conversión a material son números que cambian el
    // total que se compra, aunque no toquen ninguna celda: también cuentan
    // como "se modificó un número" de este cómputo.
    await tocarFechaComputo(proyectoId, itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapItem(item) };
  } catch (error) {
    console.error("actualizarItemSeccion", error);
    return { success: false, error: "No se pudo guardar el ítem." };
  }
}

/**
 * Escribe lo medido en una celda de la grilla: un ítem en una fila.
 *
 * Una celda es una fila de medición, no un campo del ítem. Parece un rodeo para
 * guardar un número, pero es lo que deja abrir después la celda en el detalle
 * por ambiente —tres renglones adentro de "4° piso"— sin migrar nada: la celda
 * pasa a mostrar la suma y el total de arriba no se entera.
 *
 * Vacío borra la fila, y no guarda un 0. Un cero medido y una planta que
 * todavía no se computó son cosas distintas, y en la grilla se leen distinto:
 * "0" contra "—".
 *
 * Devuelve el ítem entero y no la fila porque el que llama necesita recalcular
 * la columna y el total de la sección, y con la fila sola tendría que
 * reconstruirlo a mano.
 */
export async function guardarCelda(
  proyectoId: string,
  itemId: string,
  fila: ClaveFila,
  valor: number | null
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) {
    return { success: false, error: "La cantidad tiene que ser mayor a 0." };
  }

  try {
    const existe = await prisma.computoItem.findFirst({
      where: { id: itemId, proyectoId },
      select: { id: true, seccionId: true },
    });
    if (!existe) return { success: false, error: "No se encontró el ítem." };

    const donde = await resolverFila(proyectoId, existe.seccionId, fila);
    if (!donde.ok) return { success: false, error: donde.error };

    const cargadas = await prisma.computoMedicion.findMany({
      where: { itemId, nivelId: donde.nivelId, filaExtraId: donde.filaExtraId },
      orderBy: { orden: "asc" },
      select: { id: true, origenId: true },
    });

    // Una fila derivada sale de una cuenta sobre otro ítem, no de una medida.
    // Pisarla con un número tipeado borraría la cuenta sin que se vea.
    if (cargadas.some((f) => f.origenId !== null)) {
      return {
        success: false,
        error: "Esta celda sale de una cuenta sobre otro ítem. No se escribe a mano.",
      };
    }
    // Más de una fila sólo puede venir del detalle por ambiente. Ahí el número
    // de la celda es una suma, y no hay una fila obvia a la que mandar el valor.
    if (cargadas.length > 1) {
      return {
        success: false,
        error: "Esta celda tiene varias filas cargadas. Editalas desde el detalle.",
      };
    }

    const medicion = cargadas[0];
    if (valor === null) {
      if (medicion) await prisma.computoMedicion.delete({ where: { id: medicion.id } });
    } else if (medicion) {
      await prisma.computoMedicion.update({
        where: { id: medicion.id },
        data: { cantidad: valor },
      });
    } else {
      await prisma.computoMedicion.create({
        data: {
          itemId,
          nivelId: donde.nivelId,
          filaExtraId: donde.filaExtraId,
          cantidad: valor,
          orden: await siguienteOrdenMedicion(itemId),
        },
      });
    }

    await tocarFechaComputo(proyectoId, itemId);

    const item = await prisma.computoItem.findUniqueOrThrow({
      where: { id: itemId },
      include: incluirMediciones,
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapItem(item) };
  } catch (error) {
    console.error("guardarCelda", error);
    return { success: false, error: "No se pudo guardar la medida." };
  }
}

/**
 * Guarda un cajón (C10 o C15) de una celda de la grilla de PUERTAS.
 *
 * Vive en la misma fila que la cantidad de puertas de esa celda (ver
 * ComputoMedicion.cajonC10/cajonC15 en el schema), pero es un número
 * independiente: una celda puede tener puertas sin cajones contados todavía,
 * o cajones contados antes que las puertas. Por eso, a diferencia de
 * `guardarCelda`, esto puede crear una fila sin tocar `cantidad` (queda en 0,
 * que para cajones no se confunde con "medido": el que se lee como medida es
 * la columna de puertas, no ésta) y la borra si queda sin nada cargado.
 */
export async function guardarCajon(
  proyectoId: string,
  itemId: string,
  fila: ClaveFila,
  campo: "cajonC10" | "cajonC15",
  valor: number | null
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) {
    return { success: false, error: "La cantidad tiene que ser mayor a 0." };
  }

  try {
    const existe = await prisma.computoItem.findFirst({
      where: { id: itemId, proyectoId },
      select: { id: true, seccionId: true },
    });
    if (!existe) return { success: false, error: "No se encontró el ítem." };

    const donde = await resolverFila(proyectoId, existe.seccionId, fila);
    if (!donde.ok) return { success: false, error: donde.error };

    const cargadas = await prisma.computoMedicion.findMany({
      where: { itemId, nivelId: donde.nivelId, filaExtraId: donde.filaExtraId },
      orderBy: { orden: "asc" },
      select: { id: true, origenId: true, cantidad: true, cajonC10: true, cajonC15: true },
    });

    if (cargadas.some((f) => f.origenId !== null)) {
      return {
        success: false,
        error: "Esta celda sale de una cuenta sobre otro ítem. No se escribe a mano.",
      };
    }
    if (cargadas.length > 1) {
      return {
        success: false,
        error: "Esta celda tiene varias filas cargadas. Editalas desde el detalle.",
      };
    }

    const medicion = cargadas[0];
    if (medicion) {
      const otroCajon = campo === "cajonC10" ? medicion.cajonC15 : medicion.cajonC10;
      // Si la fila se queda sin cantidad de puertas, sin el otro cajón y sin
      // éste, no representa nada: se borra en vez de dejar un renglón vacío.
      if (valor === null && otroCajon === null && Number(medicion.cantidad) === 0) {
        await prisma.computoMedicion.delete({ where: { id: medicion.id } });
      } else {
        await prisma.computoMedicion.update({
          where: { id: medicion.id },
          data: { [campo]: valor },
        });
      }
    } else if (valor !== null) {
      await prisma.computoMedicion.create({
        data: {
          itemId,
          nivelId: donde.nivelId,
          filaExtraId: donde.filaExtraId,
          cantidad: 0,
          [campo]: valor,
          orden: await siguienteOrdenMedicion(itemId),
        },
      });
    }

    await tocarFechaComputo(proyectoId, itemId);

    const item = await prisma.computoItem.findUniqueOrThrow({
      where: { id: itemId },
      include: incluirMediciones,
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapItem(item) };
  } catch (error) {
    console.error("guardarCajon", error);
    return { success: false, error: "No se pudo guardar el cajón." };
  }
}

// ---------------------------------------------------------------------------
// Detalle de una celda
// ---------------------------------------------------------------------------
//
// Una celda puede ser un número suelto ("38 m³ de bases en la planta baja") o
// abrirse en renglones: "Base B1 — 12", "Base B2 — 14", "Base B3 — 12". El
// número de la celda es la suma y no se escribe: sale de los renglones, igual
// que el total de la columna sale de las celdas.
//
// Cada renglón lleva una descripción y el número ya hecho, sin medidas. Es lo
// que se decidió: el volumen de cada base suele venir calculado de la planilla
// del estructuralista, y pedir largo × ancho × alto obligaría a rehacer a mano
// una cuenta que ya está hecha.
//
// Las tres devuelven el ítem entero y no el renglón, porque la pantalla trabaja
// con el ítem: el total de la celda, el de la columna y lo que dependa de él
// por una derivada tienen que quedar todos al día de una sola vez.

/** El ítem con sus filas, que es lo que la grilla necesita después de tocar algo. */
async function itemConMediciones(itemId: string) {
  const item = await prisma.computoItem.findUniqueOrThrow({
    where: { id: itemId },
    include: incluirMediciones,
  });
  return mapItem(item);
}

/**
 * Busca un renglón del detalle, acotado a la obra y con su ítem.
 *
 * ComputoMedicion no tiene proyectoId propio, así que este es el punto donde se
 * impide tocar el cómputo de otra obra. De paso trae el origenId, que es lo que
 * distingue un renglón cargado a mano de una cuenta sobre otro ítem.
 */
async function renglonDeLaObra(proyectoId: string, medicionId: string) {
  return prisma.computoMedicion.findFirst({
    where: { id: medicionId, item: { proyectoId } },
    select: { id: true, itemId: true, origenId: true },
  });
}

export async function agregarDetalle(
  proyectoId: string,
  itemId: string,
  fila: ClaveFila,
  descripcion: string,
  valor: number
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  const limpio = descripcion.trim();
  if (!limpio) return { success: false, error: "Poné un nombre para el renglón." };
  if (!Number.isFinite(valor) || valor <= 0) {
    return { success: false, error: "La cantidad tiene que ser mayor a 0." };
  }

  try {
    const existe = await prisma.computoItem.findFirst({
      where: { id: itemId, proyectoId },
      select: { id: true, seccionId: true },
    });
    if (!existe) return { success: false, error: "No se encontró el ítem." };

    const donde = await resolverFila(proyectoId, existe.seccionId, fila);
    if (!donde.ok) return { success: false, error: donde.error };

    // Una celda derivada no se desglosa: su número sale de otro ítem, y sumarle
    // renglones a mano daría un total que no es ni la cuenta ni lo cargado.
    const derivada = await prisma.computoMedicion.findFirst({
      where: {
        itemId,
        nivelId: donde.nivelId,
        filaExtraId: donde.filaExtraId,
        origenId: { not: null },
      },
      select: { id: true },
    });
    if (derivada) {
      return {
        success: false,
        error: "Esta celda sale de una cuenta sobre otro ítem. No se desglosa.",
      };
    }

    await prisma.computoMedicion.create({
      data: {
        itemId,
        nivelId: donde.nivelId,
        filaExtraId: donde.filaExtraId,
        descripcion: limpio,
        cantidad: valor,
        orden: await siguienteOrdenMedicion(itemId),
      },
    });

    await tocarFechaComputo(proyectoId, itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: await itemConMediciones(itemId) };
  } catch (error) {
    console.error("agregarDetalle", error);
    return { success: false, error: "No se pudo agregar el renglón." };
  }
}

export async function guardarDetalle(
  proyectoId: string,
  medicionId: string,
  descripcion: string,
  valor: number
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  const limpio = descripcion.trim();
  if (!limpio) return { success: false, error: "Poné un nombre para el renglón." };
  if (!Number.isFinite(valor) || valor <= 0) {
    return { success: false, error: "La cantidad tiene que ser mayor a 0." };
  }

  try {
    const renglon = await renglonDeLaObra(proyectoId, medicionId);
    if (!renglon) return { success: false, error: "No se encontró el renglón." };
    if (renglon.origenId) {
      return {
        success: false,
        error: "Este renglón sale de una cuenta sobre otro ítem. No se escribe a mano.",
      };
    }

    await prisma.computoMedicion.update({
      where: { id: medicionId },
      data: { descripcion: limpio, cantidad: valor },
    });

    await tocarFechaComputo(proyectoId, renglon.itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: await itemConMediciones(renglon.itemId) };
  } catch (error) {
    console.error("guardarDetalle", error);
    return { success: false, error: "No se pudo guardar el renglón." };
  }
}

export async function borrarDetalle(
  proyectoId: string,
  medicionId: string
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  try {
    const renglon = await renglonDeLaObra(proyectoId, medicionId);
    if (!renglon) return { success: false, error: "No se encontró el renglón." };

    await prisma.computoMedicion.delete({ where: { id: medicionId } });

    await tocarFechaComputo(proyectoId, renglon.itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: await itemConMediciones(renglon.itemId) };
  } catch (error) {
    console.error("borrarDetalle", error);
    return { success: false, error: "No se pudo eliminar el renglón." };
  }
}

export async function crearItem(
  proyectoId: string,
  input: {
    nombre: string;
    unidad: string;
    rubroId: string;
    subrubroId?: string | null;
    notas?: string | null;
    tipoId?: string | null;
  }
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  const nombre = input.nombre.trim();
  if (!nombre) return { success: false, error: "El nombre del ítem es obligatorio." };
  if (!esUnidad(input.unidad)) return { success: false, error: "La unidad no es válida." };
  if (!input.rubroId) return { success: false, error: "Elegí un rubro." };

  try {
    const item = await prisma.computoItem.create({
      data: {
        proyectoId,
        rubroId: input.rubroId,
        subrubroId: input.subrubroId || null,
        tipoId: input.tipoId || null,
        nombre,
        unidad: input.unidad,
        notas: input.notas?.trim() || null,
        orden: await siguienteOrdenItem(proyectoId),
      },
      include: incluirMediciones,
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapItem(item) };
  } catch (error) {
    console.error("crearItem", error);
    return { success: false, error: "No se pudo crear el ítem." };
  }
}

/**
 * Edita un ítem.
 *
 * La unidad se puede cambiar aunque ya tenga filas cargadas, y a propósito no
 * se borra nada al hacerlo: pasar de m² a m³ deja largo y ancho como estaban y
 * sólo suma el alto, que es lo que uno quiere cuando se dio cuenta tarde de que
 * el ítem era volumétrico. Las dimensiones que la unidad nueva no usa quedan
 * guardadas sin molestar y vuelven a contar si se deshace el cambio.
 */
export async function actualizarItem(
  proyectoId: string,
  itemId: string,
  input: {
    nombre: string;
    unidad: string;
    rubroId: string;
    subrubroId?: string | null;
    notas?: string | null;
  }
): Promise<ResultItem> {
  await requireSeccion("proyectos");

  const nombre = input.nombre.trim();
  if (!nombre) return { success: false, error: "El nombre del ítem es obligatorio." };
  if (!esUnidad(input.unidad)) return { success: false, error: "La unidad no es válida." };
  if (!input.rubroId) return { success: false, error: "Elegí un rubro." };

  try {
    const item = await prisma.computoItem.update({
      // El proyectoId en el where y no sólo el id: sin eso, un id de otra obra
      // colado en el payload se escribiría igual.
      where: { id: itemId, proyectoId },
      data: {
        rubroId: input.rubroId,
        subrubroId: input.subrubroId || null,
        nombre,
        unidad: input.unidad,
        notas: input.notas?.trim() || null,
      },
      include: incluirMediciones,
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapItem(item) };
  } catch (error) {
    console.error("actualizarItem", error);
    return { success: false, error: "No se pudo guardar el ítem." };
  }
}

export async function eliminarItem(proyectoId: string, itemId: string): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    // Borrar un ítem que alimenta a otros se lleva puestas esas filas derivadas
    // (Cascade). Se avisa antes en vez de dejar que el otro cómputo baje sin
    // explicación: el usuario tiene que poder decidir con el número a la vista.
    const derivadas = await prisma.computoMedicion.count({
      where: { origenId: itemId, item: { proyectoId } },
    });
    if (derivadas > 0) {
      return {
        success: false,
        error:
          derivadas === 1
            ? "Hay 1 fila de otro ítem que sale de éste. Borrala primero."
            : `Hay ${derivadas} filas de otros ítems que salen de éste. Borralas primero.`,
      };
    }

    await prisma.computoItem.delete({ where: { id: itemId, proyectoId } });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("eliminarItem", error);
    return { success: false, error: "No se pudo eliminar el ítem." };
  }
}

/**
 * Persiste el orden de los ítems después de arrastrar uno.
 *
 * En transacción, igual que el reacomodo del presupuesto: si falla a mitad de
 * camino, media lista reordenada y media como estaba es peor que no haber
 * tocado nada.
 */
export async function reordenarItems(proyectoId: string, ids: string[]): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    await prisma.$transaction(
      ids.map((id, orden) =>
        prisma.computoItem.update({ where: { id, proyectoId }, data: { orden } })
      )
    );
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("reordenarItems", error);
    return { success: false, error: "No se pudo guardar el orden." };
  }
}

// ---------------------------------------------------------------------------
// Filas medidas
// ---------------------------------------------------------------------------

export async function crearMedicion(
  proyectoId: string,
  itemId: string,
  input: {
    descripcion?: string | null;
    nivelId?: string | null;
    cantidad: number;
    largo?: number | null;
    ancho?: number | null;
    alto?: number | null;
    deduccion?: boolean;
  }
): Promise<ResultMedicion> {
  await requireSeccion("proyectos");

  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    return { success: false, error: "La cantidad tiene que ser mayor a 0." };
  }
  const largo = normalizarDimension(input.largo);
  const ancho = normalizarDimension(input.ancho);
  const alto = normalizarDimension(input.alto);
  if (!largo.ok || !ancho.ok || !alto.ok) {
    return { success: false, error: "Las medidas tienen que ser mayores a 0." };
  }

  try {
    const nivel = await resolverNivel(proyectoId, input.nivelId);
    if (!nivel.ok) return { success: false, error: "Ese nivel no es de esta obra." };

    // El ítem se busca acotado al proyecto antes de escribir: la fila no tiene
    // proyectoId propio, así que este es el único lugar donde se puede
    // comprobar que no se está cargando en el cómputo de otra obra.
    const item = await prisma.computoItem.findFirst({
      where: { id: itemId, proyectoId },
      select: { id: true },
    });
    if (!item) return { success: false, error: "No se encontró el ítem." };

    const medicion = await prisma.computoMedicion.create({
      data: {
        itemId,
        descripcion: input.descripcion?.trim() || null,
        nivelId: nivel.valor,
        cantidad: input.cantidad,
        largo: largo.valor,
        ancho: ancho.valor,
        alto: alto.valor,
        deduccion: input.deduccion ?? false,
        orden: await siguienteOrdenMedicion(itemId),
      },
    });

    await tocarFechaComputo(proyectoId, itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, medicion: mapMedicion(medicion) };
  } catch (error) {
    console.error("crearMedicion", error);
    return { success: false, error: "No se pudo agregar la medición." };
  }
}

export async function actualizarMedicion(
  proyectoId: string,
  medicionId: string,
  input: {
    descripcion?: string | null;
    nivelId?: string | null;
    cantidad: number;
    largo?: number | null;
    ancho?: number | null;
    alto?: number | null;
    deduccion?: boolean;
  }
): Promise<ResultMedicion> {
  await requireSeccion("proyectos");

  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    return { success: false, error: "La cantidad tiene que ser mayor a 0." };
  }
  const largo = normalizarDimension(input.largo);
  const ancho = normalizarDimension(input.ancho);
  const alto = normalizarDimension(input.alto);
  if (!largo.ok || !ancho.ok || !alto.ok) {
    return { success: false, error: "Las medidas tienen que ser mayores a 0." };
  }

  try {
    const nivel = await resolverNivel(proyectoId, input.nivelId);
    if (!nivel.ok) return { success: false, error: "Ese nivel no es de esta obra." };

    const existente = await prisma.computoMedicion.findFirst({
      where: { id: medicionId, item: { proyectoId } },
      select: { id: true, itemId: true },
    });
    if (!existente) return { success: false, error: "No se encontró la medición." };

    const medicion = await prisma.computoMedicion.update({
      where: { id: medicionId },
      data: {
        descripcion: input.descripcion?.trim() || null,
        nivelId: nivel.valor,
        cantidad: input.cantidad,
        largo: largo.valor,
        ancho: ancho.valor,
        alto: alto.valor,
        deduccion: input.deduccion ?? false,
      },
    });

    await tocarFechaComputo(proyectoId, existente.itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, medicion: mapMedicion(medicion) };
  } catch (error) {
    console.error("actualizarMedicion", error);
    return { success: false, error: "No se pudo guardar la medición." };
  }
}

export async function eliminarMedicion(
  proyectoId: string,
  medicionId: string
): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    const existente = await prisma.computoMedicion.findFirst({
      where: { id: medicionId, item: { proyectoId } },
      select: { id: true, itemId: true },
    });
    if (!existente) return { success: false, error: "No se encontró la fila." };

    await prisma.computoMedicion.delete({ where: { id: medicionId } });
    await tocarFechaComputo(proyectoId, existente.itemId);
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("eliminarMedicion", error);
    return { success: false, error: "No se pudo eliminar la fila." };
  }
}

export async function reordenarMediciones(
  proyectoId: string,
  itemId: string,
  ids: string[]
): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    const item = await prisma.computoItem.findFirst({
      where: { id: itemId, proyectoId },
      select: { id: true },
    });
    if (!item) return { success: false, error: "No se encontró el ítem." };

    await prisma.$transaction(
      ids.map((id, orden) =>
        prisma.computoMedicion.update({ where: { id, itemId }, data: { orden } })
      )
    );
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("reordenarMediciones", error);
    return { success: false, error: "No se pudo guardar el orden." };
  }
}

// ---------------------------------------------------------------------------
// Filas derivadas
// ---------------------------------------------------------------------------

/**
 * Trae todo el cómputo de la obra para poder chequear ciclos.
 *
 * Se lee entero y no sólo la cadena que interesa porque `creaCiclo` camina el
 * grafo hacia arriba y necesita ver los orígenes de los orígenes. Son unas
 * pocas decenas de filas por obra: no vale la pena una consulta recursiva.
 */
async function itemsDelProyecto(proyectoId: string) {
  const items = await prisma.computoItem.findMany({
    where: { proyectoId },
    include: incluirMediciones,
  });
  return items.map(mapItem);
}

/**
 * Agrega a un ítem una fila que sale de la cantidad de otro.
 *
 * Es la segunda etapa del cómputo: los ladrillos no se vuelven a medir, se
 * calculan sobre los m² de mampostería que ya están computados. Un mismo
 * material puede tener varias filas de este tipo, una por cada trabajo que lo
 * consume, y el total las suma.
 *
 * Los dos ítems tienen que ser de la misma obra, y la cuenta no puede volver
 * sobre sí misma: si A sale de B, B no puede salir de A ni de nada que dependa
 * de A. Eso se valida acá, con todo el cómputo a la vista, porque es el único
 * lugar donde se conoce el grafo entero.
 */
export async function crearDerivada(
  proyectoId: string,
  itemId: string,
  input: {
    origenId: string;
    descripcion?: string | null;
    cantidad: number;
    desperdicio?: number | null;
    deduccion?: boolean;
  }
): Promise<ResultMedicion> {
  await requireSeccion("proyectos");

  if (!input.origenId) return { success: false, error: "Elegí de qué ítem sale." };
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    return { success: false, error: "El coeficiente tiene que ser mayor a 0." };
  }
  const desperdicio = normalizarDesperdicio(input.desperdicio);
  if (!desperdicio.ok) {
    return { success: false, error: "El desperdicio tiene que estar entre 0 y 100." };
  }

  try {
    const items = await itemsDelProyecto(proyectoId);
    const destino = items.find((i) => i.id === itemId);
    const origen = items.find((i) => i.id === input.origenId);
    if (!destino) return { success: false, error: "No se encontró el ítem." };
    if (!origen) return { success: false, error: "No se encontró el ítem de origen." };
    if (creaCiclo(items, itemId, origen.id)) {
      return {
        success: false,
        error: "Esa cuenta se muerde la cola: el origen ya depende de este ítem.",
      };
    }

    const medicion = await prisma.computoMedicion.create({
      data: {
        itemId,
        origenId: origen.id,
        descripcion: input.descripcion?.trim() || null,
        cantidad: input.cantidad,
        desperdicio: desperdicio.valor,
        deduccion: input.deduccion ?? false,
        orden: await siguienteOrdenMedicion(itemId),
      },
    });

    await tocarFechaComputo(proyectoId, itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, medicion: mapMedicion(medicion) };
  } catch (error) {
    console.error("crearDerivada", error);
    return { success: false, error: "No se pudo agregar la cuenta." };
  }
}

/**
 * Cambia el coeficiente o el desperdicio de una fila derivada.
 *
 * El origen no se toca acá: cambiarlo es cambiar de qué sale el número, y eso
 * se hace borrando la fila y armando otra, donde el chequeo de ciclos vuelve a
 * correr sobre el grafo nuevo.
 */
export async function actualizarDerivada(
  proyectoId: string,
  medicionId: string,
  input: {
    descripcion?: string | null;
    cantidad: number;
    desperdicio?: number | null;
    deduccion?: boolean;
  }
): Promise<ResultMedicion> {
  await requireSeccion("proyectos");

  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    return { success: false, error: "El coeficiente tiene que ser mayor a 0." };
  }
  const desperdicio = normalizarDesperdicio(input.desperdicio);
  if (!desperdicio.ok) {
    return { success: false, error: "El desperdicio tiene que estar entre 0 y 100." };
  }

  try {
    const existente = await prisma.computoMedicion.findFirst({
      where: { id: medicionId, item: { proyectoId }, origenId: { not: null } },
      select: { id: true, itemId: true },
    });
    if (!existente) return { success: false, error: "No se encontró la cuenta." };

    const medicion = await prisma.computoMedicion.update({
      where: { id: medicionId },
      data: {
        descripcion: input.descripcion?.trim() || null,
        cantidad: input.cantidad,
        desperdicio: desperdicio.valor,
        deduccion: input.deduccion ?? false,
      },
    });

    await tocarFechaComputo(proyectoId, existente.itemId);

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, medicion: mapMedicion(medicion) };
  } catch (error) {
    console.error("actualizarDerivada", error);
    return { success: false, error: "No se pudo guardar la cuenta." };
  }
}

/**
 * Valida el porcentaje de desperdicio.
 *
 * A diferencia de las dimensiones, el 0 es válido: hay materiales sin merma, y
 * escribir 0 es decir algo distinto que dejarlo vacío.
 */
function normalizarDesperdicio(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return { ok: true as const, valor: null };
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    return { ok: false as const, valor: null };
  }
  return { ok: true as const, valor };
}

/** Lo que pide la conversión a material de un ítem. */
export type ConversionInput = {
  rinde?: number | null;
  rindeUnidad?: string | null;
  porBulto?: number | null;
  bultoNombre?: string | null;
};

/**
 * Valida y normaliza la conversión a material de un ítem.
 *
 * Los cuatro campos son uno solo partido en pedazos, así que se validan juntos.
 * Las reglas salen de qué significaría cada combinación:
 *
 * - Sin rinde no hay conversión, y entonces el bulto tampoco: un palet de nada
 *   no es nada. Por eso todo se limpia de una, y no queda un 198 escondido que
 *   reaparezca el día que alguien cargue el rinde.
 * - El rinde necesita su unidad. "×15" sin decir de qué es una columna de
 *   números sin nombre.
 * - Los dos números tienen que ser mayores a 0. Un rinde de 0 daría siempre
 *   cero ladrillos y un bulto de 0 sería una división por cero.
 */
function normalizarConversion(input: ConversionInput) {
  const rinde = input.rinde ?? null;

  if (rinde === null) {
    return {
      ok: true as const,
      valor: { rinde: null, rindeUnidad: null, porBulto: null, bultoNombre: null },
    };
  }
  if (!Number.isFinite(rinde) || rinde <= 0) {
    return { ok: false as const, error: "El rinde tiene que ser mayor a 0." };
  }
  if (!input.rindeUnidad || !esUnidad(input.rindeUnidad)) {
    return { ok: false as const, error: "Elegí en qué unidad queda la conversión." };
  }

  const porBulto = input.porBulto ?? null;
  if (porBulto !== null && (!Number.isFinite(porBulto) || porBulto <= 0)) {
    return { ok: false as const, error: "Lo que viene por bulto tiene que ser mayor a 0." };
  }

  return {
    ok: true as const,
    valor: {
      rinde,
      rindeUnidad: input.rindeUnidad,
      porBulto,
      // Sin bulto no hay nombre que guardar, y si hay bulto pero nadie escribió
      // cómo se llama, "bulto" es honesto y se puede corregir después.
      bultoNombre:
        porBulto === null ? null : input.bultoNombre?.trim() || "bulto",
    },
  };
}

// ---------------------------------------------------------------------------
// Catálogo de ítems
// ---------------------------------------------------------------------------

/**
 * Trae ítems del catálogo al cómputo de una obra.
 *
 * Copia, no referencia: cada ítem nuevo guarda su origen en `tipoId` pero a
 * partir de ahí es suyo. Si en esta obra el contrapiso se mide distinto o se
 * llama de otra manera, se corrige acá sin tocar el catálogo ni las demás
 * obras. Es la misma decisión que los tipos de documento.
 *
 * Los tipos que ya estén en el cómputo se saltean en silencio: el caso normal
 * es abrir el catálogo, marcar cinco y traerlos, y frenar todo por uno repetido
 * sería molestar por algo que no es un problema.
 */
export async function traerItemsDelCatalogo(
  proyectoId: string,
  tipoIds: string[]
): Promise<ResultItems> {
  await requireSeccion("proyectos");

  if (tipoIds.length === 0) {
    return { success: false, error: "No elegiste ningún ítem." };
  }

  try {
    const tipos = await prisma.computoItemTipo.findMany({
      where: { id: { in: tipoIds }, activo: true },
      orderBy: { orden: "asc" },
    });
    if (tipos.length === 0) {
      return { success: false, error: "No se encontraron los ítems elegidos." };
    }

    const yaEstan = await prisma.computoItem.findMany({
      where: { proyectoId, tipoId: { in: tipos.map((t) => t.id) } },
      select: { tipoId: true },
    });
    const usados = new Set(yaEstan.map((i) => i.tipoId));
    const faltantes = tipos.filter((t) => !usados.has(t.id));

    if (faltantes.length === 0) {
      return { success: false, error: "Esos ítems ya están en el cómputo." };
    }

    let orden = await siguienteOrdenItem(proyectoId);
    const items: ItemOpcion[] = [];
    for (const tipo of faltantes) {
      const item = await prisma.computoItem.create({
        data: {
          proyectoId,
          rubroId: tipo.rubroId,
          subrubroId: tipo.subrubroId,
          tipoId: tipo.id,
          nombre: tipo.nombre,
          unidad: tipo.unidad,
          orden: orden++,
        },
        include: incluirMediciones,
      });
      items.push(mapItem(item));
    }

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, items };
  } catch (error) {
    console.error("traerItemsDelCatalogo", error);
    return { success: false, error: "No se pudieron traer los ítems." };
  }
}

/**
 * Guarda un ítem de la obra en el catálogo compartido, para reusarlo.
 *
 * Es el camino de vuelta: el catálogo se llena trabajando, no cargándolo de
 * antemano. Si el nombre ya existe en ese rubro no se duplica, se devuelve el
 * que había y se ata el ítem a él.
 */
export async function guardarItemEnCatalogo(
  proyectoId: string,
  itemId: string
): Promise<ResultTipo> {
  await requireSeccion("proyectos");

  try {
    const item = await prisma.computoItem.findFirst({
      where: { id: itemId, proyectoId },
    });
    if (!item) return { success: false, error: "No se encontró el ítem." };

    const existente = await prisma.computoItemTipo.findFirst({
      where: { rubroId: item.rubroId, nombre: item.nombre },
    });

    const tipo =
      existente ??
      (await prisma.computoItemTipo.create({
        data: {
          nombre: item.nombre,
          unidad: item.unidad,
          rubroId: item.rubroId,
          subrubroId: item.subrubroId,
          orden: await siguienteOrdenTipo(item.rubroId),
        },
      }));

    await prisma.computoItem.update({
      where: { id: item.id },
      data: { tipoId: tipo.id },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, tipo: mapItemTipo(tipo) };
  } catch (error) {
    console.error("guardarItemEnCatalogo", error);
    return { success: false, error: "No se pudo guardar el ítem en el catálogo." };
  }
}

async function siguienteOrdenTipo(rubroId: string) {
  const ultimo = await prisma.computoItemTipo.findFirst({
    where: { rubroId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultimo?.orden ?? -1) + 1;
}
