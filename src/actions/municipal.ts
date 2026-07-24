"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";

type TramiteCategoria = "ADMINISTRACION" | "DEMOLICION" | "OBRA";

export async function crearTipoTramite(
  proyectoId: string,
  categoria: TramiteCategoria,
  etapa: string,
  nombre: string,
  descripcion: string | undefined
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return;

  const ultimo = await prisma.tramiteMunicipalTipo.findFirst({
    where: { categoria, etapa },
    orderBy: { orden: "desc" },
  });

  await prisma.tramiteMunicipalTipo.upsert({
    where: { categoria_etapa_nombre: { categoria, etapa, nombre: nombreTrim } },
    update: { activo: true, descripcion: descripcion?.trim() || null },
    create: {
      categoria,
      etapa,
      nombre: nombreTrim,
      descripcion: descripcion?.trim() || null,
      orden: (ultimo?.orden ?? 0) + 1,
    },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Si el tipo de trámite ya tiene instancias cargadas en algún proyecto no se
// puede borrar (rompería esos registros), así que en ese caso se lo oculta
// del listado en vez de eliminarlo.
export async function eliminarTipoTramite(proyectoId: string, tipoId: string) {
  await requireSeccion("proyectos");

  try {
    await prisma.tramiteMunicipalTipo.delete({ where: { id: tipoId } });
  } catch {
    await prisma.tramiteMunicipalTipo.update({ where: { id: tipoId }, data: { activo: false } });
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

async function getOrCreateTramite(proyectoId: string, tipoId: string) {
  return prisma.tramiteMunicipal.upsert({
    where: { proyectoId_tipoId: { proyectoId, tipoId } },
    update: {},
    create: { proyectoId, tipoId },
  });
}

export async function actualizarNotasTramite(proyectoId: string, tipoId: string, notas: string) {
  await requireSeccion("proyectos");

  const tramite = await getOrCreateTramite(proyectoId, tipoId);
  await prisma.tramiteMunicipal.update({
    where: { id: tramite.id },
    data: { notas: notas.trim() || null },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Subir un archivo nuevo reemplaza al anterior (un solo archivo por trámite)
// y marca automáticamente el trámite como Presentado.
export async function subirArchivoTramite(proyectoId: string, tipoId: string, archivo: File) {
  await requireSeccion("proyectos");

  if (!archivo || archivo.size === 0) return;

  const tramite = await getOrCreateTramite(proyectoId, tipoId);
  const blob = await put(`municipal/${crypto.randomUUID()}-${archivo.name}`, archivo, {
    access: "public",
  });
  await prisma.tramiteMunicipal.update({
    where: { id: tramite.id },
    data: { archivoNombre: archivo.name, archivoUrl: blob.url, estado: "PRESENTADO" },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Quitar el archivo vuelve a marcar el trámite como Pendiente.
export async function eliminarArchivoTramite(proyectoId: string, tipoId: string) {
  await requireSeccion("proyectos");

  const tramite = await getOrCreateTramite(proyectoId, tipoId);
  await prisma.tramiteMunicipal.update({
    where: { id: tramite.id },
    data: { archivoNombre: null, archivoUrl: null, estado: "PENDIENTE" },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}
