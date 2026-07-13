"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { MaterialSchema } from "@/lib/validations/material";

export type ActionState =
  | {
      error?: string;
      success?: boolean;
      material?: { id: string; nombre: string; unidad: string; pesoPorBarra: number | null };
    }
  | undefined;

function parseForm(formData: FormData) {
  const pesoPorBarraRaw = formData.get("pesoPorBarra");
  return MaterialSchema.safeParse({
    nombre: formData.get("nombre"),
    unidad: formData.get("unidad"),
    pesoPorBarra:
      pesoPorBarraRaw && String(pesoPorBarraRaw).trim() !== ""
        ? Number(pesoPorBarraRaw)
        : undefined,
  });
}

function parseRubroId(formData: FormData): string | null {
  const raw = formData.get("rubroId");
  return raw && raw !== "ninguno" ? String(raw) : null;
}

export async function createMaterial(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const material = await prisma.material.create({
    data: {
      ...validated.data,
      pesoPorBarra: validated.data.pesoPorBarra ?? null,
      rubroId: parseRubroId(formData),
    },
  });
  revalidatePath("/proveedores");
  revalidatePath("/inventario");
  return {
    success: true,
    material: {
      id: material.id,
      nombre: material.nombre,
      unidad: material.unidad,
      pesoPorBarra: material.pesoPorBarra ? Number(material.pesoPorBarra) : null,
    },
  };
}

export async function updateMaterial(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  await prisma.material.update({
    where: { id },
    data: {
      ...validated.data,
      pesoPorBarra: validated.data.pesoPorBarra ?? null,
      rubroId: parseRubroId(formData),
    },
  });
  revalidatePath("/proveedores");
  return { success: true };
}

export async function toggleMaterialActivo(id: string, activo: boolean) {
  await prisma.material.update({ where: { id }, data: { activo } });
  revalidatePath("/proveedores");
}

export async function deleteMaterial(id: string): Promise<ActionState> {
  const pedidoItemsCount = await prisma.pedidoItem.count({ where: { materialId: id } });
  if (pedidoItemsCount > 0) {
    return {
      error: "No se puede eliminar: el material tiene pedidos registrados. Podés desactivarlo en su lugar.",
    };
  }

  await prisma.material.delete({ where: { id } });
  revalidatePath("/proveedores");
  return { success: true };
}
