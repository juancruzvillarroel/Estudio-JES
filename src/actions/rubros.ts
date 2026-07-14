"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { RubroSchema } from "@/lib/validations/rubro";
import { generarPrefijoRubro } from "@/lib/codigos";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  const codigoPrefijoRaw = formData.get("codigoPrefijo");
  return RubroSchema.safeParse({
    nombre: formData.get("nombre"),
    codigoPrefijo:
      codigoPrefijoRaw && String(codigoPrefijoRaw).trim() !== "" ? codigoPrefijoRaw : undefined,
  });
}

export async function createRubro(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proveedores");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const codigoPrefijo = await generarPrefijoRubro();
    await prisma.rubro.create({ data: { ...validated.data, codigoPrefijo } });
  } catch {
    return { error: "Ya existe un rubro con ese nombre." };
  }

  revalidatePath("/proveedores");
  return { success: true };
}

export async function updateRubro(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proveedores");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.rubro.update({ where: { id }, data: validated.data });
  } catch (e) {
    const target = (e as { meta?: { target?: string[] } })?.meta?.target;
    if (target?.includes("codigoPrefijo")) {
      return { error: "Ya existe un rubro con ese prefijo." };
    }
    return { error: "Ya existe un rubro con ese nombre." };
  }

  revalidatePath("/proveedores");
  return { success: true };
}

export async function deleteRubro(id: string): Promise<ActionState> {
  await requireSeccion("proveedores");

  const materialesCount = await prisma.material.count({ where: { rubroId: id } });
  if (materialesCount > 0) {
    return { error: "No se puede eliminar: el rubro tiene materiales asociados." };
  }

  await prisma.rubro.delete({ where: { id } });
  revalidatePath("/proveedores");
  return { success: true };
}
