"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  ProyectoInversorSchema,
  ProyectoInversorUpdateSchema,
  type ProyectoInversorInput,
  type ProyectoInversorUpdateInput,
} from "@/lib/validations/proyecto-inversor";
import { mapProyectoInversor, type ProyectoInversorOpcion } from "@/lib/flujo-fondos";

export type ActionResult =
  | { success: true; item: ProyectoInversorOpcion }
  | { success: false; error: string };

export async function createProyectoInversor(input: ProyectoInversorInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = ProyectoInversorSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const item = await prisma.proyectoInversor.create({ data: validated.data });

    revalidatePath(`/proyectos/${validated.data.proyectoId}`);
    return { success: true, item: mapProyectoInversor(item) };
  } catch {
    return { success: false, error: "Ya hay un inversor con ese nombre en este proyecto." };
  }
}

export async function updateProyectoInversor(
  id: string,
  input: ProyectoInversorUpdateInput
): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = ProyectoInversorUpdateSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const item = await prisma.proyectoInversor.update({
      where: { id },
      data: validated.data,
    });

    revalidatePath(`/proyectos/${item.proyectoId}`);
    return { success: true, item: mapProyectoInversor(item) };
  } catch {
    return { success: false, error: "Ya hay un inversor con ese nombre en este proyecto." };
  }
}

export async function deleteProyectoInversor(id: string): Promise<{ error?: string; success?: boolean }> {
  await requireSeccion("flujo-fondos");

  const movimientosCount = await prisma.movimientoFondo.count({ where: { proyectoInversorId: id } });
  if (movimientosCount > 0) {
    return { error: "No se puede quitar: el inversor tiene aportes cargados en este proyecto." };
  }

  const item = await prisma.proyectoInversor.delete({ where: { id } });
  revalidatePath(`/proyectos/${item.proyectoId}`);
  return { success: true };
}
