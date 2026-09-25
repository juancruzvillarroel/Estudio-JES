"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { mapNivel, type NivelOpcion } from "@/lib/niveles";
import { NivelProyectoSchema } from "@/lib/validations/nivel-proyecto";

export type Result = { success: true } | { success: false; error: string };

export type ResultNivel =
  | { success: true; nivel: NivelOpcion }
  | { success: false; error: string };

/**
 * Los niveles se cargan de abajo hacia arriba, así que uno nuevo va siempre al
 * final: es lo que se está construyendo encima de lo que ya hay. Si hace falta
 * meterlo en el medio (un subsuelo que aparece después), se arrastra.
 */
async function siguienteOrden(proyectoId: string) {
  const ultimo = await prisma.nivelProyecto.findFirst({
    where: { proyectoId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return (ultimo?.orden ?? -1) + 1;
}

export async function crearNivel(proyectoId: string, nombre: string): Promise<ResultNivel> {
  await requireSeccion("proyectos");

  const validated = NivelProyectoSchema.safeParse({ nombre });
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const nivel = await prisma.nivelProyecto.create({
      data: {
        proyectoId,
        nombre: validated.data.nombre,
        orden: await siguienteOrden(proyectoId),
      },
    });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, nivel: mapNivel(nivel) };
  } catch (error) {
    console.error("crearNivel", error);
    return { success: false, error: "Ya hay un nivel con ese nombre en esta obra." };
  }
}

export async function renombrarNivel(
  proyectoId: string,
  nivelId: string,
  nombre: string
): Promise<ResultNivel> {
  await requireSeccion("proyectos");

  const validated = NivelProyectoSchema.safeParse({ nombre });
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    // Acotado al proyecto, no sólo al id: renombrar es inofensivo, pero el
    // nivel de otra obra no tiene por qué ser alcanzable desde acá.
    const existente = await prisma.nivelProyecto.findFirst({
      where: { id: nivelId, proyectoId },
      select: { id: true },
    });
    if (!existente) return { success: false, error: "No se encontró el nivel." };

    const nivel = await prisma.nivelProyecto.update({
      where: { id: nivelId },
      data: { nombre: validated.data.nombre },
    });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, nivel: mapNivel(nivel) };
  } catch (error) {
    console.error("renombrarNivel", error);
    return { success: false, error: "Ya hay un nivel con ese nombre en esta obra." };
  }
}

/**
 * Borra un nivel, salvo que tenga cómputo cargado.
 *
 * El corte por nivel existe para poder contratar y pagar por planta. Si al
 * borrar el nivel sus filas se fueran calladas a "Toda la obra", el total del
 * ítem quedaría igual y nadie notaría que el detalle de esa planta desapareció.
 * Por eso se bloquea y se dice cuántas filas hay que mover primero: mover el
 * cómputo es una decisión, no un efecto secundario de borrar un nombre.
 */
export async function eliminarNivel(proyectoId: string, nivelId: string): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    const existente = await prisma.nivelProyecto.findFirst({
      where: { id: nivelId, proyectoId },
      select: { id: true },
    });
    if (!existente) return { success: false, error: "No se encontró el nivel." };

    const filas = await prisma.computoMedicion.count({ where: { nivelId } });
    if (filas > 0) {
      return {
        success: false,
        error:
          filas === 1
            ? "Hay 1 fila del cómputo en este nivel. Movela a otro nivel primero."
            : `Hay ${filas} filas del cómputo en este nivel. Movelas a otro nivel primero.`,
      };
    }

    await prisma.nivelProyecto.delete({ where: { id: nivelId } });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("eliminarNivel", error);
    return { success: false, error: "No se pudo eliminar el nivel." };
  }
}

/**
 * Persiste el orden después de arrastrar un nivel.
 *
 * En transacción, igual que el reordenado de los ítems del cómputo: si falla a
 * mitad de camino, media lista reordenada es peor que no haber tocado nada.
 */
export async function reordenarNiveles(proyectoId: string, ids: string[]): Promise<Result> {
  await requireSeccion("proyectos");

  try {
    await prisma.$transaction(
      ids.map((id, orden) =>
        prisma.nivelProyecto.update({ where: { id, proyectoId }, data: { orden } })
      )
    );
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("reordenarNiveles", error);
    return { success: false, error: "No se pudo guardar el orden." };
  }
}
