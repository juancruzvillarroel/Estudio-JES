"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { RubroSchema } from "@/lib/validations/rubro";

export type ActionState = { error?: string; success?: boolean } | undefined;

export async function createRubro(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = RubroSchema.safeParse({ nombre: formData.get("nombre") });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.rubro.create({ data: validated.data });
  } catch {
    return { error: "Ya existe un rubro con ese nombre." };
  }

  revalidatePath("/proveedores");
  return { success: true };
}

export async function updateRubro(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = RubroSchema.safeParse({ nombre: formData.get("nombre") });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.rubro.update({ where: { id }, data: validated.data });
  } catch {
    return { error: "Ya existe un rubro con ese nombre." };
  }

  revalidatePath("/proveedores");
  return { success: true };
}

export async function deleteRubro(id: string): Promise<ActionState> {
  const materialesCount = await prisma.material.count({ where: { rubroId: id } });
  if (materialesCount > 0) {
    return { error: "No se puede eliminar: el rubro tiene materiales asociados." };
  }

  await prisma.rubro.delete({ where: { id } });
  revalidatePath("/proveedores");
  return { success: true };
}
