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
 * Se trabaja por diferencia contra lo que hay guardado, en vez de mandar un
 * UPDATE por cada renglón. Cada consulta a la base cuesta unos 60 ms, así que
 * una tarea con 20 sub ítems y 8 secciones se iba a más de 4 segundos y
 * quedaba pegada contra el límite de la transacción. Guardar sin haber tocado
 * nada ahora no escribe nada.
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
  const [seccionesGuardadas, itemsGuardados] = await Promise.all([
    tx.tareaSeccion.findMany({ where: { tareaId }, select: { id: true, titulo: true, orden: true } }),
    tx.tareaItem.findMany({
      where: { tareaId },
      select: { id: true, texto: true, orden: true, seccionId: true },
    }),
  ]);
  const seccionPorId = new Map(seccionesGuardadas.map((s) => [s.id, s]));
  const itemPorId = new Map(itemsGuardados.map((i) => [i.id, i]));

  // Primero las secciones, para tener el id real de las nuevas antes de
  // colgarles los ítems.
  //
  // Un id que ya no está en la base se trata como si no hubiera venido: puede
  // pasar si el diálogo quedó abierto mientras se borraba la sección desde otro
  // lado. Antes eso reventaba la transacción entera.
  const seccionIds: string[] = [];
  for (const [orden, s] of secciones.entries()) {
    const guardada = s.id ? seccionPorId.get(s.id) : undefined;
    if (guardada) {
      if (guardada.titulo !== s.titulo || guardada.orden !== orden) {
        await tx.tareaSeccion.update({ where: { id: guardada.id }, data: { titulo: s.titulo, orden } });
      }
      seccionIds.push(guardada.id);
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

  const conservados = todos.flatMap((i) => (i.id && itemPorId.has(i.id) ? [i.id] : []));
  const aBorrar = itemsGuardados.filter((i) => !conservados.includes(i.id)).map((i) => i.id);
  if (aBorrar.length > 0) {
    await tx.tareaItem.deleteMany({ where: { tareaId, id: { in: aBorrar } } });
  }

  const nuevos: { tareaId: string; texto: string; orden: number; seccionId: string | null }[] = [];
  for (const i of todos) {
    const datos = { texto: i.texto, orden: i.orden, seccionId: i.seccionId };
    const guardado = i.id ? itemPorId.get(i.id) : undefined;
    if (!guardado) {
      nuevos.push({ ...datos, tareaId });
    } else if (
      guardado.texto !== datos.texto ||
      guardado.orden !== datos.orden ||
      guardado.seccionId !== datos.seccionId
    ) {
      await tx.tareaItem.update({ where: { id: guardado.id }, data: datos });
    }
  }
  // Todos los nuevos entran en un solo INSERT.
  if (nuevos.length > 0) {
    await tx.tareaItem.createMany({ data: nuevos });
  }

  const seccionesABorrar = seccionesGuardadas
    .filter((s) => !seccionIds.includes(s.id))
    .map((s) => s.id);
  if (seccionesABorrar.length > 0) {
    await tx.tareaSeccion.deleteMany({ where: { tareaId, id: { in: seccionesABorrar } } });
  }
}

/**
 * Margen holgado sobre los 5 s por defecto de Prisma. Con el guardado por
 * diferencia una tarea grande no llega ni cerca, pero si algún día alguien
 * carga un checklist enorme conviene que tarde y no que falle.
 */
const OPCIONES_TX = { timeout: 15000, maxWait: 10000 } as const;

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
    }, OPCIONES_TX);
    revalidar(proyectoId);
    return { success: true, item: mapTarea(item) };
  } catch (error) {
    // Sin esto el motivo real se pierde y del lado del usuario solo queda un
    // "no se pudo": queda en el log del servidor para poder diagnosticarlo.
    console.error("crearTarea", error);
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
    }, OPCIONES_TX);
    revalidar(item.proyectoId);
    return { success: true, item: mapTarea(item) };
  } catch (error) {
    console.error("actualizarTarea", error);
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
  } catch (error) {
    console.error("cambiarEstadoTarea", error);
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
  } catch (error) {
    console.error("cambiarEstadoItemTarea", error);
    return { success: false, error: "No se pudo actualizar el sub ítem." };
  }
}

export async function eliminarTarea(id: string): Promise<{ error?: string; success?: boolean }> {
  await verifySession();
  try {
    const item = await prisma.tarea.delete({ where: { id } });
    revalidar(item.proyectoId);
    return { success: true };
  } catch (error) {
    console.error("eliminarTarea", error);
    return { error: "No se pudo eliminar la tarea." };
  }
}
