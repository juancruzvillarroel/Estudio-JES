"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  mapPresupuestoItem,
  type CurvaPresupuesto,
  type PresupuestoItemOpcion,
} from "@/lib/presupuesto";

type ResultItem =
  | { success: true; item: PresupuestoItemOpcion }
  | { success: false; error: string };

type Result = { success: true } | { success: false; error: string };

/**
 * Guarda la línea de presupuesto de un rubro o subrubro.
 *
 * Es un upsert hecho a mano y no un `prisma.upsert` porque la clave natural
 * —proyecto + rubro + subrubro— tiene el subrubro en null cuando la línea es del
 * rubro entero, y Postgres considera distintos a dos NULL: un índice único no
 * impediría dos líneas del mismo rubro. Se busca primero y se decide acá.
 */
export async function guardarPresupuestoItem(
  proyectoId: string,
  input: {
    rubroId: string;
    subrubroId: string | null;
    montoUSD: number;
    mesInicio: number;
    duracionMeses: number;
    curva: CurvaPresupuesto;
    notas?: string | null;
  }
): Promise<ResultItem> {
  await requireSeccion("flujo-fondos");

  if (!Number.isFinite(input.montoUSD) || input.montoUSD < 0) {
    return { success: false, error: "El monto tiene que ser un número positivo." };
  }
  if (!Number.isInteger(input.mesInicio) || input.mesInicio < 0) {
    return { success: false, error: "El mes de inicio no es válido." };
  }
  if (!Number.isInteger(input.duracionMeses) || input.duracionMeses < 1) {
    return { success: false, error: "La duración tiene que ser de al menos un mes." };
  }

  try {
    const existente = await prisma.presupuestoItem.findFirst({
      where: {
        proyectoId,
        rubroId: input.rubroId,
        subrubroId: input.subrubroId,
      },
    });

    const data = {
      montoUSD: input.montoUSD,
      mesInicio: input.mesInicio,
      duracionMeses: input.duracionMeses,
      curva: input.curva,
      notas: input.notas?.trim() || null,
    };

    const item = existente
      ? await prisma.presupuestoItem.update({ where: { id: existente.id }, data })
      : await prisma.presupuestoItem.create({
          data: {
            proyectoId,
            rubroId: input.rubroId,
            subrubroId: input.subrubroId,
            ...data,
          },
        });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapPresupuestoItem(item) };
  } catch (error) {
    console.error("guardarPresupuestoItem", error);
    return { success: false, error: "No se pudo guardar la línea del presupuesto." };
  }
}

/**
 * Mueve o estira una barra en la línea de tiempo.
 *
 * Va separado de `guardarPresupuestoItem` porque es lo que dispara cada arrastre
 * y solo toca el tramo: mandar el monto en cada movimiento haría que un error de
 * red mientras se arrastra pudiera pisar una cifra que el usuario no tocó.
 */
export async function moverPresupuestoItem(
  proyectoId: string,
  itemId: string,
  mesInicio: number,
  duracionMeses: number
): Promise<ResultItem> {
  await requireSeccion("flujo-fondos");

  if (!Number.isInteger(mesInicio) || mesInicio < 0) {
    return { success: false, error: "El mes de inicio no es válido." };
  }
  if (!Number.isInteger(duracionMeses) || duracionMeses < 1) {
    return { success: false, error: "La duración tiene que ser de al menos un mes." };
  }

  try {
    const item = await prisma.presupuestoItem.update({
      where: { id: itemId },
      data: { mesInicio, duracionMeses },
    });

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, item: mapPresupuestoItem(item) };
  } catch (error) {
    console.error("moverPresupuestoItem", error);
    return { success: false, error: "No se pudo mover la línea." };
  }
}

/**
 * Reacomoda varias líneas de una sola vez, para el botón que arma el estimado
 * de toda la obra.
 *
 * Va en una transacción y no en un `Promise.all` de updates sueltos: si a mitad
 * de camino falla uno, quedaría medio cronograma reordenado y medio como
 * estaba, que es peor que no haber tocado nada. El usuario apretó un botón que
 * dice "reacomodar todo" y espera todo o nada.
 *
 * Los tramos los calcula el cliente, que es quien conoce los nombres de los
 * rubros; acá solo se validan y se persisten.
 */
export async function reacomodarPresupuesto(
  proyectoId: string,
  tramos: { itemId: string; mesInicio: number; duracionMeses: number; curva: CurvaPresupuesto }[]
): Promise<{ success: true; items: PresupuestoItemOpcion[] } | { success: false; error: string }> {
  await requireSeccion("flujo-fondos");

  for (const t of tramos) {
    if (!Number.isInteger(t.mesInicio) || t.mesInicio < 0) {
      return { success: false, error: "Hay un mes de inicio inválido." };
    }
    if (!Number.isInteger(t.duracionMeses) || t.duracionMeses < 1) {
      return { success: false, error: "Hay una duración inválida." };
    }
  }

  try {
    const items = await prisma.$transaction(
      tramos.map((t) =>
        prisma.presupuestoItem.update({
          // El `proyectoId` en el where y no solo el id: sin eso, un id de otro
          // proyecto colado en el payload se escribiría igual.
          where: { id: t.itemId, proyectoId },
          data: { mesInicio: t.mesInicio, duracionMeses: t.duracionMeses, curva: t.curva },
        })
      )
    );

    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true, items: items.map(mapPresupuestoItem) };
  } catch (error) {
    console.error("reacomodarPresupuesto", error);
    return { success: false, error: "No se pudo reacomodar el presupuesto." };
  }
}

export async function eliminarPresupuestoItem(
  proyectoId: string,
  itemId: string
): Promise<Result> {
  await requireSeccion("flujo-fondos");

  try {
    await prisma.presupuestoItem.delete({ where: { id: itemId } });
    revalidatePath(`/proyectos/${proyectoId}`);
    return { success: true };
  } catch (error) {
    console.error("eliminarPresupuestoItem", error);
    return { success: false, error: "No se pudo eliminar la línea." };
  }
}
