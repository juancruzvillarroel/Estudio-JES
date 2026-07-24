"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";

export async function crearCategoriaDocumento(
  proyectoId: string,
  nombre: string,
  porPiso?: boolean
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return;

  const ultima = await prisma.documentoCategoria.findFirst({ orderBy: { orden: "desc" } });

  const categoria = await prisma.documentoCategoria.upsert({
    where: { nombre: nombreTrim },
    update: { activo: true },
    create: { nombre: nombreTrim, orden: (ultima?.orden ?? 0) + 1, porPiso: !!porPiso },
  });

  // Si la categoría es "por piso", generar de una los tipos para este
  // proyecto (Planta baja + pisos ya cargados).
  if (categoria.porPiso) {
    const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (proyecto) {
      await sincronizarDocumentosPorPiso(proyectoId, proyecto.cantidadPisos);
    }
  }
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Códigos cortos de piso (para nombres con prefijo, ej. "S/PB") y sus
// nombres largos equivalentes (ej. "Planta baja"), en orden.
function pisosDelProyecto(cantidadPisos: number) {
  return [
    { codigo: "PB", nombreLargo: "Planta baja" },
    ...Array.from({ length: cantidadPisos }, (_, i) => ({
      codigo: `${i + 1}°`,
      nombreLargo: `Piso ${i + 1}`,
    })),
    { codigo: "Azotea", nombreLargo: "Azotea" },
  ];
}

type TipoDeseado = { subSeccion: string | null; nombre: string };

// Tipos de documento a generar para una categoría "por piso", según su
// configuración: un documento por piso (con o sin prefijo) o, si tiene
// subTipos cargados (ej. instalaciones: sanitaria, gas, ...), cada sub-tipo
// se convierte en su propia subsección (DocumentoTipo.subSeccion), con un
// documento por piso (código corto: PB, 1°, 2°, ..., Azotea) adentro.
function nombresPorPiso(
  categoria: { prefijoPiso: string | null; subTipos: string[] },
  cantidadPisos: number
): TipoDeseado[] {
  const pisos = pisosDelProyecto(cantidadPisos);

  if (categoria.subTipos.length > 0) {
    return categoria.subTipos.flatMap((sub) =>
      pisos.map((p) => ({ subSeccion: sub, nombre: p.codigo }))
    );
  }

  const nombrePiso = (p: { codigo: string; nombreLargo: string }) =>
    categoria.prefijoPiso ? `${categoria.prefijoPiso}${p.codigo}` : p.nombreLargo;
  return pisos.map((p) => ({ subSeccion: null, nombre: nombrePiso(p) }));
}

// Genera (o ajusta) un tipo de documento por piso (y por sub-tipo, si la
// categoría los tiene) para cada categoría marcada como porPiso, scopeados
// a este proyecto puntual (DocumentoTipo.proyectoId). Se llama al
// crear/editar el proyecto (cuando cambia la cantidad de pisos) y al crear
// una categoría por piso nueva. Es idempotente.
export async function sincronizarDocumentosPorPiso(proyectoId: string, cantidadPisos: number) {
  const categoriasPorPiso = await prisma.documentoCategoria.findMany({
    where: { porPiso: true, activo: true },
  });
  if (categoriasPorPiso.length === 0) return;

  const clave = (t: { subSeccion: string | null; nombre: string }) => `${t.subSeccion ?? ""}::${t.nombre}`;

  for (const categoria of categoriasPorPiso) {
    const deseados = nombresPorPiso(categoria, cantidadPisos);
    const existentes = await prisma.documentoTipo.findMany({
      where: { categoriaId: categoria.id, proyectoId },
    });
    const existentesPorClave = new Map(existentes.map((t) => [clave(t), t]));

    for (let i = 0; i < deseados.length; i++) {
      const deseado = deseados[i];
      const existente = existentesPorClave.get(clave(deseado));
      if (existente) {
        // El usuario lo eliminó a mano: no se regenera solo.
        if (existente.excluido) continue;
        if (!existente.activo || existente.orden !== i) {
          await prisma.documentoTipo.update({
            where: { id: existente.id },
            data: { activo: true, orden: i },
          });
        }
      } else {
        await prisma.documentoTipo.create({
          data: {
            categoriaId: categoria.id,
            proyectoId,
            subSeccion: deseado.subSeccion,
            nombre: deseado.nombre,
            orden: i,
          },
        });
      }
    }

    // Los pisos que sobran (se redujo la cantidad de pisos, o cambió la
    // config de subTipos) se ocultan, o se borran si todavía no tienen
    // ningún documento cargado.
    const clavesDeseadas = new Set(deseados.map(clave));
    const sobrantes = existentes.filter((t) => !clavesDeseadas.has(clave(t)));
    for (const tipo of sobrantes) {
      try {
        await prisma.documentoTipo.delete({ where: { id: tipo.id } });
      } catch {
        await prisma.documentoTipo.update({ where: { id: tipo.id }, data: { activo: false } });
      }
    }
  }
}

// Si la categoría ya tiene tipos de documento cargados no se puede borrar
// (rompería esos tipos), así que en ese caso se la oculta del listado.
export async function eliminarCategoriaDocumento(proyectoId: string, categoriaId: string) {
  await requireSeccion("proyectos");

  try {
    await prisma.documentoCategoria.delete({ where: { id: categoriaId } });
  } catch {
    await prisma.documentoCategoria.update({ where: { id: categoriaId }, data: { activo: false } });
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

export async function crearTipoDocumento(
  proyectoId: string,
  categoriaId: string,
  nombre: string,
  descripcion: string | undefined,
  subSeccion?: string | null
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return;

  const categoria = await prisma.documentoCategoria.findUnique({ where: { id: categoriaId } });
  if (!categoria) return;

  // Las categorías "por piso" tienen su catálogo de tipos scopeado a este
  // proyecto puntual (no se comparten entre proyectos); el resto sigue
  // usando un catálogo global compartido (proyectoId null), como siempre.
  const proyectoIdTipo = categoria.porPiso ? proyectoId : null;
  const subSeccionValor = subSeccion ?? null;

  // Prisma no permite usar `null` dentro de una clave compuesta para
  // upsert, así que buscamos a mano el tipo (global o de este proyecto) con
  // ese nombre antes de crear o reactivar.
  const existente = await prisma.documentoTipo.findFirst({
    where: { categoriaId, proyectoId: proyectoIdTipo, subSeccion: subSeccionValor, nombre: nombreTrim },
  });

  if (existente) {
    await prisma.documentoTipo.update({
      where: { id: existente.id },
      data: { activo: true, excluido: false, descripcion: descripcion?.trim() || null },
    });
  } else {
    const ultimo = await prisma.documentoTipo.findFirst({
      where: { categoriaId, proyectoId: proyectoIdTipo, subSeccion: subSeccionValor },
      orderBy: { orden: "desc" },
    });
    await prisma.documentoTipo.create({
      data: {
        categoriaId,
        proyectoId: proyectoIdTipo,
        subSeccion: subSeccionValor,
        nombre: nombreTrim,
        descripcion: descripcion?.trim() || null,
        orden: (ultimo?.orden ?? 0) + 1,
      },
    });
  }
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Si el tipo es "de proyecto" (generado automáticamente por piso) se lo
// marca como excluido en vez de borrarlo, para que sincronizarDocumentosPorPiso
// no lo regenere solo la próxima vez que se guarde el proyecto. Si es del
// catálogo global y ya tiene instancias cargadas en algún otro proyecto no
// se puede borrar (rompería esos registros), así que en ese caso se lo
// oculta del listado en vez de eliminarlo.
export async function eliminarTipoDocumento(proyectoId: string, tipoId: string) {
  await requireSeccion("proyectos");

  const tipo = await prisma.documentoTipo.findUnique({ where: { id: tipoId } });
  if (!tipo) return { success: true };

  if (tipo.proyectoId) {
    await prisma.documentoTipo.update({
      where: { id: tipoId },
      data: { activo: false, excluido: true },
    });
  } else {
    try {
      await prisma.documentoTipo.delete({ where: { id: tipoId } });
    } catch {
      await prisma.documentoTipo.update({ where: { id: tipoId }, data: { activo: false } });
    }
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

async function getOrCreateDocumento(proyectoId: string, tipoId: string) {
  return prisma.documento.upsert({
    where: { proyectoId_tipoId: { proyectoId, tipoId } },
    update: {},
    create: { proyectoId, tipoId },
  });
}

// Tilda/destilda el documento a mano (checklist simple, sin archivo adjunto).
export async function actualizarEstadoDocumento(
  proyectoId: string,
  tipoId: string,
  presentado: boolean
) {
  await requireSeccion("proyectos");

  const documento = await getOrCreateDocumento(proyectoId, tipoId);
  await prisma.documento.update({
    where: { id: documento.id },
    data: { estado: presentado ? "PRESENTADO" : "PENDIENTE" },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function actualizarNotasDocumento(proyectoId: string, tipoId: string, notas: string) {
  await requireSeccion("proyectos");

  const documento = await getOrCreateDocumento(proyectoId, tipoId);
  await prisma.documento.update({
    where: { id: documento.id },
    data: { notas: notas.trim() || null },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Subir un archivo nuevo reemplaza al anterior (un solo archivo por
// documento) y marca automáticamente el documento como Presentado.
export async function subirArchivoDocumento(proyectoId: string, tipoId: string, archivo: File) {
  await requireSeccion("proyectos");

  if (!archivo || archivo.size === 0) return;

  const documento = await getOrCreateDocumento(proyectoId, tipoId);
  const blob = await put(`documentacion/${crypto.randomUUID()}-${archivo.name}`, archivo, {
    access: "public",
  });
  await prisma.documento.update({
    where: { id: documento.id },
    data: { archivoNombre: archivo.name, archivoUrl: blob.url, estado: "PRESENTADO" },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}

// Quitar el archivo vuelve a marcar el documento como Pendiente.
export async function eliminarArchivoDocumento(proyectoId: string, tipoId: string) {
  await requireSeccion("proyectos");

  const documento = await getOrCreateDocumento(proyectoId, tipoId);
  await prisma.documento.update({
    where: { id: documento.id },
    data: { archivoNombre: null, archivoUrl: null, estado: "PENDIENTE" },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
}
