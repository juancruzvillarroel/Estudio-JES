"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import {
  TareaSchema,
  TareaUpdateSchema,
  type TareaInput,
  type TareaUpdateInput,
} from "@/lib/validations/tarea";
import { mapTarea, tareaInclude, type TareaOpcion } from "@/lib/tareas";

export type ActionResult =
  | { success: true; item: TareaOpcion }
  | { success: false; error: string };

/**
 * Las tareas se ven desde dos lugares: la pestaña del proyecto y la vista
 * global. Cualquier cambio tiene que refrescar las dos.
 */
function revalidar(proyectoId: string) {
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath("/tareas");
}

type ChecklistInput = {
  items: { id?: string; texto: string }[];
  secciones: { id?: string; titulo: string; items: { id?: string; texto: string }[] }[];
};

/**
 * Deja el checklist de la tarea igual a lo que llegó del formulario.
 *
 * No se puede borrar todo y recrearlo: se perdería qué sub ítems estaban
 * tildados. Los que traen `id` ya existen y se actualizan; los que no, se
 * crean. Lo mismo con las secciones.
 *
 * El orden de los pasos importa: las secciones que sobran se borran al final,
 * después de reacomodar los ítems. Si se borraran antes, un ítem que el usuario
 * sacó de una sección para dejarlo suelto se lo llevaría puesto la cascada.
 */
async function sincronizarChecklist(
  tx: Prisma.TransactionClient,
  tareaId: string,
  { items, secciones }: ChecklistInput
) {
  // Primero las secciones, para tener el id real de las nuevas antes de
  // colgarles los ítems.
  const seccionIds: string[] = [];
  for (const [orden, s] of secciones.entries()) {
    if (s.id) {
      await tx.tareaSeccion.update({ where: { id: s.id }, data: { titulo: s.titulo, orden } });
      seccionIds.push(s.id);
    } else {
      const creada = await tx.tareaSeccion.create({
        data: { tareaId, titulo: s.titulo, orden },
        select: { id: true },
      });
      seccionIds.push(creada.id);
    }
  }

  // Sueltos y de secciones se tratan igual: lo único que cambia es el
  // `seccionId`, null para los sueltos.
  const todos = [
    ...items.map((i, orden) => ({ ...i, orden, seccionId: null as string | null })),
    ...secciones.flatMap((s, i) =>
      s.items.map((it, orden) => ({ ...it, orden, seccionId: seccionIds[i] }))
    ),
  ];

  await tx.tareaItem.deleteMany({
    where: { tareaId, id: { notIn: todos.flatMap((i) => (i.id ? [i.id] : [])) } },
  });

  for (const i of todos) {
    const datos = { texto: i.texto, orden: i.orden, seccionId: i.seccionId };
    if (i.id) {
      await tx.tareaItem.update({ where: { id: i.id }, data: datos });
    } else {
      await tx.tareaItem.create({ data: { ...datos, tareaId } });
    }
  }

  await tx.tareaSeccion.deleteMany({ where: { tareaId, id: { notIn: seccionIds } } });
}

export async function crearTarea(input: TareaInput): Promise<ActionResult> {
  const session = await verifySession();
  const validated = TareaSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { proyectoId, titulo, descripcion, rubroId, prioridad, asignadoIds, items, secciones } =
    validated.data;

  try {
    // La tarea se crea primero y el checklist se arma después, porque los
    // ítems de una sección necesitan tanto el id de la sección como el de la
    // tarea, y ninguno existe hasta que se graba. Va todo en una transacción
    // para no dejar una tarea a medio armar si algo falla.
    const item = await prisma.$transaction(async (tx) => {
      const creada = await tx.tarea.create({
        data: {
          proyectoId,
          titulo,
          descripcion: descripcion || null,
          rubroId: rubroId || null,
          prioridad,
          creadoPorId: session.userId,
          asignados: { create: asignadoIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });
      await sincronizarChecklist(tx, creada.id, { items, secciones });
      return tx.tarea.findUniqueOrThrow({ where: { id: creada.id }, include: tareaInclude });
    });
    revalidar(proyectoId);
    return { success: true, item: mapTarea(item) };
  } catch {
    return { success: false, error: "No se pudo crear la tarea." };
  }
}

export async function actualizarTarea(
  id: string,
  input: TareaUpdateInput
): Promise<ActionResult> {
  await verifySession();
  const validated = TareaUpdateSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { titulo, descripcion, rubroId, prioridad, asignadoIds, items, secciones } =
    validated.data;

  try {
    const item = await prisma.$transaction(async (tx) => {
      // Los asignados se reemplazan por completo: es más simple y más barato
      // que calcular el diff, porque son pocos por tarea. El checklist no,
      // porque hay que conservar qué estaba tildado (ver sincronizarChecklist).
      await tx.tarea.update({
        where: { id },
        data: {
          titulo,
          descripcion: descripcion || null,
          rubroId: rubroId || null,
          prioridad,
          asignados: {
            deleteMany: {},
            create: asignadoIds.map((userId) => ({ userId })),
          },
        },
      });
      await sincronizarChecklist(tx, id, { items, secciones });
      return tx.tarea.findUniqueOrThrow({ where: { id }, include: tareaInclude });
    });
    revalidar(item.proyectoId);
    return { success: true, item: mapTarea(item) };
  } catch {
    return { success: false, error: "No se pudo guardar la tarea." };
  }
}

/**
 * Marca o desmarca la tarea como completada. Arrastra al checklist entero: si
 * la tarea está hecha, sus sub ítems también lo están, y al reabrirla vuelven
 * todos a pendiente. Si no, quedaría un "5/5" colgado en una tarea abierta.
 */
export async function cambiarEstadoTarea(
  id: string,
  completada: boolean
): Promise<ActionResult> {
  await verifySession();
  try {
    const item = await prisma.tarea.update({
      where: { id },
      data: {
        estado: completada ? "COMPLETADA" : "PENDIENTE",
        completadaEl: completada ? new Date() : null,
        items: { updateMany: { where: {}, data: { completado: completada } } },
      },
      include: tareaInclude,
    });
    revalidar(item.proyectoId);
    return { success: true, item: mapTarea(item) };
  } catch {
    return { success: false, error: "No se pudo actualizar la tarea." };
  }
}

/**
 * Tilda o destilda un sub ítem del checklist y recalcula el estado de la
 * tarea: se completa sola cuando queda todo tildado, y vuelve a pendiente en
 * cuanto se destilda alguno.
 */
export async function cambiarEstadoItemTarea(
  itemId: string,
  completado: boolean
): Promise<ActionResult> {
  await verifySession();
  try {
    const { tareaId } = await prisma.tareaItem.update({
      where: { id: itemId },
      data: { completado },
      select: { tareaId: true },
    });

    const tarea = await prisma.tarea.findUniqueOrThrow({
      where: { id: tareaId },
      select: { estado: true, items: { select: { completado: true } } },
    });
    const todosHechos = tarea.items.every((i) => i.completado);
    const estado = todosHechos ? "COMPLETADA" : "PENDIENTE";

    const item =
      estado === tarea.estado
        ? // El estado no cambió (ej. quedan sub ítems sueltos): no hace falta
          // tocar la tarea, pero igual hay que devolverla al cliente con el
          // checklist actualizado.
          await prisma.tarea.findUniqueOrThrow({ where: { id: tareaId }, include: tareaInclude })
        : await prisma.tarea.update({
            where: { id: tareaId },
            data: { estado, completadaEl: todosHechos ? new Date() : null },
            include: tareaInclude,
          });
    revalidar(item.proyectoId);
    return { success: true, item: mapTarea(item) };
  } catch {
    return { success: false, error: "No se pudo actualizar el sub ítem." };
  }
}

export async function eliminarTarea(id: string): Promise<{ error?: string; success?: boolean }> {
  await verifySession();
  try {
    const item = await prisma.tarea.delete({ where: { id } });
    revalidar(item.proyectoId);
    return { success: true };
  } catch {
    return { error: "No se pudo eliminar la tarea." };
  }
}
