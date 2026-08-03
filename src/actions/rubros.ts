"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { RubroSchema } from "@/lib/validations/rubro";
import { generarPrefijoRubro } from "@/lib/codigos";

export type ActionState = { error?: string; success?: boolean } | undefined;

const SUBRUBROS_DEFAULT = ["MATERIALES", "MANO DE OBRA"];

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
    const rubro = await prisma.rubro.create({ data: { ...validated.data, codigoPrefijo } });
    await prisma.subrubro.createMany({
      data: SUBRUBROS_DEFAULT.map((nombre, orden) => ({ rubroId: rubro.id, nombre, orden })),
    });
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

/**
 * Reordena los rubros según el arreglo de ids recibido (nuevo orden) y
 * renumera su código correlativo (00, 01, ...) para que refleje esa
 * posición. Se hace en dos pasadas porque `codigoPrefijo` es único: la
 * primera libera los valores actuales con un placeholder temporal para
 * evitar choques al reasignarlos en la segunda pasada.
 */
export async function reordenarRubros(idsEnOrden: string[]): Promise<ActionState> {
  await requireSeccion("proveedores");

  await prisma.$transaction(
    idsEnOrden.map((id, index) =>
      prisma.rubro.update({
        where: { id },
        data: { codigoPrefijo: `_tmp-${index}` },
      })
    )
  );

  await prisma.$transaction(
    idsEnOrden.map((id, index) =>
      prisma.rubro.update({
        where: { id },
        data: { orden: index, codigoPrefijo: String(index).padStart(2, "0") },
      })
    )
  );

  revalidatePath("/proveedores");
  return { success: true };
}
