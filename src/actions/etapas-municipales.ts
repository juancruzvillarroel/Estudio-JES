"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { EtapaMunicipalSchema } from "@/lib/validations/etapa-municipal";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return EtapaMunicipalSchema.safeParse({ nombre: formData.get("nombre") });
}

export async function createEtapaMunicipal(
  categoriaId: string,
  proyectoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSeccion("proyectos");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const ultima = await prisma.etapaMunicipal.findFirst({
    where: { categoriaId },
    orderBy: { orden: "desc" },
  });

  try {
    await prisma.etapaMunicipal.create({
      data: { categoriaId, nombre: validated.data.nombre, orden: (ultima?.orden ?? 0) + 1 },
    });
  } catch {
    return { error: "Ya existe una etapa con ese nombre en esta categoría." };
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

export async function updateEtapaMunicipal(
  id: string,
  proyectoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSeccion("proyectos");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await prisma.etapaMunicipal.update({ where: { id }, data: { nombre: validated.data.nombre } });
  } catch {
    return { error: "Ya existe una etapa con ese nombre en esta categoría." };
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

// Si la etapa ya tiene tipos de trámite cargados no se puede borrar (romperia
// esos tipos), así que en ese caso se la oculta del listado.
export async function deleteEtapaMunicipal(id: string, proyectoId: string): Promise<ActionState> {
  await requireSeccion("proyectos");

  try {
    await prisma.etapaMunicipal.delete({ where: { id } });
  } catch {
    await prisma.etapaMunicipal.update({ where: { id }, data: { activo: false } });
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}
