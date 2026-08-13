"use server";

import { revalidatePath } from "next/cache";
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

export async function crearTarea(input: TareaInput): Promise<ActionResult> {
  const session = await verifySession();
  const validated = TareaSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { proyectoId, titulo, descripcion, rubroId, prioridad, asignadoIds, items } =
    validated.data;

  try {
    const item = await prisma.tarea.create({
      data: {
        proyectoId,
        titulo,
        descripcion: descripcion || null,
        rubroId: rubroId || null,
        prioridad,
        creadoPorId: session.userId,
        asignados: { create: asignadoIds.map((userId) => ({ userId })) },
        items: { create: items.map((i, orden) => ({ texto: i.texto, orden })) },
      },
      include: tareaInclude,
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
  const { titulo, descripcion, rubroId, prioridad, asignadoIds, items } = validated.data;

  try {
    // Los asignados se reemplazan por completo: es más simple y más barato que
    // calcular el diff, porque son pocos por tarea.
    //
    // El checklist NO se puede reemplazar así: borrarlo y recrearlo perdería
    // qué sub ítems estaban tildados. Por eso se hace el diff a mano contra los
    // ids que mandó el formulario.
    const conservados = items.filter((i) => i.id).map((i) => i.id as string);
    const item = await prisma.tarea.update({
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
        items: {
          deleteMany: { id: { notIn: conservados } },
          update: items.flatMap((i, orden) =>
            i.id ? [{ where: { id: i.id }, data: { texto: i.texto, orden } }] : []
          ),
          create: items.flatMap((i, orden) => (i.id ? [] : [{ texto: i.texto, orden }])),
        },
      },
      include: tareaInclude,
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
