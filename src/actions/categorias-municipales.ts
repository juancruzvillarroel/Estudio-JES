"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { CategoriaMunicipalSchema } from "@/lib/validations/categoria-municipal";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return CategoriaMunicipalSchema.safeParse({ nombre: formData.get("nombre") });
}

export async function createCategoriaMunicipal(
  proyectoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSeccion("proyectos");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const ultima = await prisma.categoriaMunicipal.findFirst({ orderBy: { orden: "desc" } });

  try {
    await prisma.categoriaMunicipal.create({
      data: { nombre: validated.data.nombre, orden: (ultima?.orden ?? 0) + 1 },
    });
  } catch {
    return { error: "Ya existe una categoría con ese nombre." };
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

export async function updateCategoriaMunicipal(
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
    await prisma.categoriaMunicipal.update({ where: { id }, data: { nombre: validated.data.nombre } });
  } catch {
    return { error: "Ya existe una categoría con ese nombre." };
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

// Si la categoría ya tiene tipos de trámite cargados no se puede borrar
// (rompería esos tipos), así que en ese caso se la oculta del listado.
export async function deleteCategoriaMunicipal(id: string, proyectoId: string): Promise<ActionState> {
  await requireSeccion("proyectos");

  try {
    await prisma.categoriaMunicipal.delete({ where: { id } });
  } catch {
    await prisma.categoriaMunicipal.update({ where: { id }, data: { activo: false } });
  }

  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}
