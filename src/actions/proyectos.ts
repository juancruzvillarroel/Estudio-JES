"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  ProyectoSchema,
  ProyectoM2VendiblesSchema,
  ProyectoPorcentajeHonorariosSchema,
  type ProyectoM2VendiblesInput,
  type ProyectoPorcentajeHonorariosInput,
} from "@/lib/validations/proyecto";
import { sincronizarDocumentosPorPiso } from "@/actions/documentos";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return ProyectoSchema.safeParse({
    nombre: formData.get("nombre"),
    barrio: formData.get("barrio") || undefined,
    direccion: formData.get("direccion") || undefined,
    estado: formData.get("estado") || undefined,
    descripcion: formData.get("descripcion") || undefined,
    cantidadPisos: formData.get("cantidadPisos") || undefined,
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
  const proyecto = await prisma.proyecto.create({ data: { ...validated.data, imagenUrl } });
  await sincronizarDocumentosPorPiso(proyecto.id, validated.data.cantidadPisos);
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
  await sincronizarDocumentosPorPiso(id, validated.data.cantidadPisos);
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export type M2VendiblesResult =
  | { success: true; m2Vendibles: number | null }
  | { success: false; error: string };

/**
 * Guarda los m² vendibles totales del proyecto. Vive en "flujo-fondos" (y no
 * en "proyectos") porque el campo se edita desde esa pestaña y es el divisor
 * de los costos por m² del resumen.
 */
export async function updateM2Vendibles(
  id: string,
  input: ProyectoM2VendiblesInput
): Promise<M2VendiblesResult> {
  await requireSeccion("flujo-fondos");

  const validated = ProyectoM2VendiblesSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: { m2Vendibles: validated.data.m2Vendibles },
    select: { m2Vendibles: true },
  });

  revalidatePath(`/proyectos/${id}`);
  return { success: true, m2Vendibles: proyecto.m2Vendibles ? Number(proyecto.m2Vendibles) : null };
}

export type PorcentajeHonorariosResult =
  | { success: true; porcentajeHonorarios: number | null }
  | { success: false; error: string };

/**
 * Guarda el porcentaje de honorarios que cobra el estudio en esta obra. Es el
 * multiplicador de la calculadora del resumen (ver src/lib/honorarios.ts).
 */
export async function updatePorcentajeHonorarios(
  id: string,
  input: ProyectoPorcentajeHonorariosInput
): Promise<PorcentajeHonorariosResult> {
  await requireSeccion("flujo-fondos");

  const validated = ProyectoPorcentajeHonorariosSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: { porcentajeHonorarios: validated.data.porcentajeHonorarios },
    select: { porcentajeHonorarios: true },
  });

  revalidatePath(`/proyectos/${id}`);
  return {
    success: true,
    // Ojo con `? :` sobre el Decimal: un 0 es un porcentaje válido, así que se
    // compara contra null en vez de mirar si es "falsy".
    porcentajeHonorarios:
      proyecto.porcentajeHonorarios === null ? null : Number(proyecto.porcentajeHonorarios),
  };
}
