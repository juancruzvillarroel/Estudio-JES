"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  ProyectoSchema,
  ProyectoM2VendiblesSchema,
  ProyectoPorcentajeHonorariosSchema,
  ProyectoFechaObraSchema,
  type ProyectoM2VendiblesInput,
  type ProyectoPorcentajeHonorariosInput,
  type ProyectoFechaObraInput,
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

/**
 * Sube el folleto de venta de la obra, si vino uno en el formulario.
 *
 * Devuelve también el nombre original. La URL del blob le pega un sufijo
 * aleatorio al nombre del archivo, así que no sirve para mostrar en pantalla
 * cuál es el brochure cargado.
 */
async function subirBrochure(
  formData: FormData
): Promise<{ brochureUrl: string; brochureNombre: string } | undefined> {
  const archivo = formData.get("brochure");
  if (!(archivo instanceof File) || archivo.size === 0) return undefined;
  const blob = await put(`proyectos/brochures/${crypto.randomUUID()}-${archivo.name}`, archivo, {
    access: "public",
  });
  return { brochureUrl: blob.url, brochureNombre: archivo.name };
}

export async function createProyecto(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireSeccion("proyectos");

  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const imagenUrl = await subirImagen(formData);
  const brochure = await subirBrochure(formData);
  const proyecto = await prisma.proyecto.create({
    data: { ...validated.data, imagenUrl, ...brochure },
  });
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
  const brochure = await subirBrochure(formData);
  const quitarBrochure = formData.get("quitarBrochure") === "on";

  await prisma.proyecto.update({
    where: { id },
    data: {
      ...validated.data,
      ...(imagenUrl ? { imagenUrl } : quitarImagen ? { imagenUrl: null } : {}),
      // Subir uno nuevo gana sobre el tilde de "quitar": si el usuario marcó
      // los dos, lo que quiso fue reemplazarlo.
      ...(brochure
        ? brochure
        : quitarBrochure
          ? { brochureUrl: null, brochureNombre: null }
          : {}),
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

export type FechaObraResult =
  | { success: true; fechaInicio: string | null; duracionMeses: number | null }
  | { success: false; error: string };

/**
 * Guarda el arranque y el largo de la obra, los dos datos que definen el eje de
 * tiempo del presupuesto.
 *
 * Van juntos en una sola action, y no uno por campo como m² u honorarios,
 * porque solos no sirven: una fecha de inicio sin duración no dibuja ninguna
 * línea de tiempo. Guardarlos de a uno dejaría al proyecto en un estado a medio
 * cargar que la pantalla tendría que saber explicar.
 *
 * La fecha se arma a mediodía UTC a propósito. Si se guardara a medianoche,
 * cualquier huso al oeste de Greenwich la leería como el día anterior y una
 * obra que arranca el 1 de marzo pasaría a arrancar en febrero. A mediodía hay
 * doce horas de colchón para cada lado y el día no se corre nunca.
 */
export async function updateFechaObra(
  id: string,
  input: ProyectoFechaObraInput
): Promise<FechaObraResult> {
  await requireSeccion("flujo-fondos");

  const validated = ProyectoFechaObraSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { fechaInicio, duracionMeses } = validated.data;

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: {
      fechaInicio: fechaInicio ? new Date(`${fechaInicio}T12:00:00.000Z`) : null,
      duracionMeses,
    },
    select: { fechaInicio: true, duracionMeses: true },
  });

  revalidatePath(`/proyectos/${id}`);
  return {
    success: true,
    // Se devuelve "AAAA-MM-DD" y no el Date para que el input de la pantalla lo
    // pueda usar tal cual. `toISOString` es seguro acá justamente porque la
    // fecha quedó guardada al mediodía.
    fechaInicio: proyecto.fechaInicio ? proyecto.fechaInicio.toISOString().slice(0, 10) : null,
    duracionMeses: proyecto.duracionMeses,
  };
}
