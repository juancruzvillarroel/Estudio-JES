"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  UnidadProyectoSchema,
  UnidadProyectoUpdateSchema,
  type UnidadProyectoInput,
  type UnidadProyectoUpdateInput,
} from "@/lib/validations/unidad-proyecto";
import { mapUnidadProyecto, type UnidadProyectoOpcion } from "@/lib/flujo-fondos";

export type ActionResult =
  | { success: true; item: UnidadProyectoOpcion }
  | { success: false; error: string };

export async function createUnidadProyecto(input: UnidadProyectoInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");
  const validated = UnidadProyectoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const item = await prisma.unidadProyecto.create({ data: validated.data });
    revalidatePath(`/proyectos/${validated.data.proyectoId}`);
    return { success: true, item: mapUnidadProyecto(item) };
  } catch {
    return { success: false, error: "Ya hay una unidad con ese nombre en este proyecto." };
  }
}

export async function updateUnidadProyecto(id: string, input: UnidadProyectoUpdateInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");
  const validated = UnidadProyectoUpdateSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const item = await prisma.unidadProyecto.update({
      where: { id },
      data: {
        nombre: validated.data.nombre,
        tipo: validated.data.tipo || null,
        m2: validated.data.m2 ?? null,
        estado: validated.data.estado,
      },
    });
    revalidatePath(`/proyectos/${item.proyectoId}`);
    return { success: true, item: mapUnidadProyecto(item) };
  } catch {
    return { success: false, error: "Ya hay una unidad con ese nombre en este proyecto." };
  }
}

export async function deleteUnidadProyecto(id: string): Promise<{ error?: string; success?: boolean }> {
  await requireSeccion("flujo-fondos");
  const item = await prisma.unidadProyecto.delete({ where: { id } });
  revalidatePath(`/proyectos/${item.proyectoId}`);
  return { success: true };
}
