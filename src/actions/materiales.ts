"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { MaterialSchema } from "@/lib/validations/material";
import { generarCodigoMaterial } from "@/lib/codigos";

export type ActionState =
  | {
      error?: string;
      success?: boolean;
      material?: {
        id: string;
        nombre: string;
        unidad: string;
        codigo: string;
        pesoPorBarra: number | null;
      };
    }
  | undefined;

function parseForm(formData: FormData) {
  const pesoPorBarraRaw = formData.get("pesoPorBarra");
  const codigoRaw = formData.get("codigo");
  return MaterialSchema.safeParse({
    nombre: formData.get("nombre"),
    unidad: formData.get("unidad"),
    pesoPorBarra:
      pesoPorBarraRaw && String(pesoPorBarraRaw).trim() !== ""
        ? Number(pesoPorBarraRaw)
        : undefined,
    codigo: codigoRaw && String(codigoRaw).trim() !== "" ? codigoRaw : undefined,
  });
}

function parseRubroId(formData: FormData): string | null {
  const raw = formData.get("rubroId");
  return raw && raw !== "ninguno" ? String(raw) : null;
}

export async function createMaterial(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proveedores");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const rubroId = parseRubroId(formData);
  const codigo = await generarCodigoMaterial(rubroId);

  const material = await prisma.material.create({
    data: {
      ...validated.data,
      codigo,
      pesoPorBarra: validated.data.pesoPorBarra ?? null,
      rubroId,
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
      codigo: material.codigo,
      pesoPorBarra: material.pesoPorBarra ? Number(material.pesoPorBarra) : null,
    },
  };
}

export async function updateMaterial(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proveedores");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (!validated.data.codigo) {
    return { error: "El código no puede estar vacío." };
  }

  try {
    await prisma.material.update({
      where: { id },
      data: {
        ...validated.data,
        codigo: validated.data.codigo,
        pesoPorBarra: validated.data.pesoPorBarra ?? null,
        rubroId: parseRubroId(formData),
      },
    });
  } catch (e) {
    const target = (e as { meta?: { target?: string[] } })?.meta?.target;
    if (target?.includes("codigo")) {
      return { error: "Ya existe un material con ese código." };
    }
    throw e;
  }
  revalidatePath("/proveedores");
  return { success: true };
}

export async function toggleMaterialActivo(id: string, activo: boolean) {
  await requireSeccion("proveedores");

  await prisma.material.update({ where: { id }, data: { activo } });
  revalidatePath("/proveedores");
}

export async function deleteMaterial(id: string): Promise<ActionState> {
  await requireSeccion("proveedores");

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
