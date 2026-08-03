"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { SubrubroSchema } from "@/lib/validations/subrubro";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return SubrubroSchema.safeParse({ nombre: formData.get("nombre") });
}

export async function createSubrubro(
  rubroId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSeccion("proveedores");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const count = await prisma.subrubro.count({ where: { rubroId } });

  try {
    await prisma.subrubro.create({
      data: { rubroId, nombre: validated.data.nombre, orden: count },
    });
  } catch {
    return { error: "Ya existe un subrubro con ese nombre en este rubro." };
  }

  revalidatePath("/proveedores");
  return { success: true };
}

export async function updateSubrubro(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSeccion("proveedores");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.subrubro.update({ where: { id }, data: { nombre: validated.data.nombre } });
  } catch {
    return { error: "Ya existe un subrubro con ese nombre en este rubro." };
  }

  revalidatePath("/proveedores");
  return { success: true };
}

export async function deleteSubrubro(id: string): Promise<ActionState> {
  await requireSeccion("proveedores");

  await prisma.subrubro.delete({ where: { id } });
  revalidatePath("/proveedores");
  return { success: true };
}
