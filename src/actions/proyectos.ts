"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { ProyectoSchema } from "@/lib/validations/proyecto";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return ProyectoSchema.safeParse({
    nombre: formData.get("nombre"),
    direccion: formData.get("direccion") || undefined,
    estado: formData.get("estado") || undefined,
    descripcion: formData.get("descripcion") || undefined,
  });
}

async function subirImagen(formData: FormData): Promise<string | undefined> {
  const archivo = formData.get("imagen");
  if (!(archivo instanceof File) || archivo.size === 0) return undefined;
  const blob = await put(`proyectos/${crypto.randomUUID()}-${archivo.name}`, archivo, {
    access: "public",
  });
  return blob.url;
}

export async function createProyecto(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proyectos");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const imagenUrl = await subirImagen(formData);
  await prisma.proyecto.create({ data: { ...validated.data, imagenUrl } });
  revalidatePath("/proyectos");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateProyecto(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proyectos");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const imagenUrl = await subirImagen(formData);
  const quitarImagen = formData.get("quitarImagen") === "on";

  await prisma.proyecto.update({
    where: { id },
    data: {
      ...validated.data,
      ...(imagenUrl ? { imagenUrl } : quitarImagen ? { imagenUrl: null } : {}),
    },
  });
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}
