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
    // Solo los de primer nivel: esta función genera pisos, nunca subitems.
    // Los subitems que el usuario haya agregado a mano adentro de un piso
    // (parentId con valor) no están en `deseados`, así que sin este filtro
    // caerían en la lista de "sobrantes" de más abajo y se borrarían solos
    // la próxima vez que se guarde el proyecto.
    const existentes = await prisma.documentoTipo.findMany({
      where: { categoriaId: categoria.id, proyectoId, parentId: null },
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
  subSeccion?: string | null,
  // Si viene, el tipo nuevo cuelga de ese otro tipo en vez de quedar suelto
  // en la subsección (ej. un subitem adentro de "Caldera").
  parentId?: string | null
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return null;

  const categoria = await prisma.documentoCategoria.findUnique({ where: { id: categoriaId } });
  if (!categoria) return null;

  // Las categorías "por piso" tienen su catálogo de tipos scopeado a este
  // proyecto puntual (no se comparten entre proyectos); el resto sigue
  // usando un catálogo global compartido (proyectoId null), como siempre.
  const proyectoIdTipo = categoria.porPiso ? proyectoId : null;
  const parentIdValor = parentId ?? null;

  // El subitem vive en la misma subsección que su padre, siempre. Si se
  // tomara la subsección que manda la UI, un padre podría terminar con
  // hijos colgados de otra subsección y el árbol quedaría inconsistente.
  const padre = parentIdValor
    ? await prisma.documentoTipo.findUnique({ where: { id: parentIdValor } })
    : null;
  // El padre se borró mientras el formulario estaba abierto: no hay dónde
  // colgar el subitem, y crearlo igual rompería la clave foránea.
  if (parentIdValor && !padre) return null;
  const subSeccionValor = padre ? padre.subSeccion : (subSeccion ?? null);

  // Prisma no permite usar `null` dentro de una clave compuesta para
  // upsert, así que buscamos a mano el tipo (global o de este proyecto) con
  // ese nombre antes de crear o reactivar.
  const existente = await prisma.documentoTipo.findFirst({
    where: {
      categoriaId,
      proyectoId: proyectoIdTipo,
      subSeccion: subSeccionValor,
      parentId: parentIdValor,
      nombre: nombreTrim,
    },
  });

  // El id vuelve a la UI para poder encadenar: al crear un grupo con su
  // primer subitem se llama dos veces, y la segunda necesita saber de quién
  // colgar el subitem.
  let id: string;

  if (existente) {
    await prisma.documentoTipo.update({
      where: { id: existente.id },
      data: { activo: true, excluido: false, descripcion: descripcion?.trim() || null },
    });
    id = existente.id;
  } else {
    const ultimo = await prisma.documentoTipo.findFirst({
      where: {
        categoriaId,
        proyectoId: proyectoIdTipo,
        subSeccion: subSeccionValor,
        parentId: parentIdValor,
      },
      orderBy: { orden: "desc" },
    });
    const creado = await prisma.documentoTipo.create({
      data: {
        categoriaId,
        proyectoId: proyectoIdTipo,
        subSeccion: subSeccionValor,
        parentId: parentIdValor,
        nombre: nombreTrim,
        descripcion: descripcion?.trim() || null,
        orden: (ultimo?.orden ?? 0) + 1,
      },
    });
    id = creado.id;
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { id };
}

// Si el tipo es "de proyecto" (generado automáticamente por piso) se lo
// marca como excluido en vez de borrarlo, para que sincronizarDocumentosPorPiso
// no lo regenere solo la próxima vez que se guarde el proyecto. Si es del
// catálogo global y ya tiene instancias cargadas en algún otro proyecto no
// se puede borrar (rompería esos registros), así que en ese caso se lo
// oculta del listado en vez de eliminarlo.
//
// Si el tipo tiene subitems colgando, primero se van los hijos: el borrado
// del padre fallaría por la clave foránea y quedarían huérfanos, invisibles
// en la pantalla pero vivos en la base.
export async function eliminarTipoDocumento(proyectoId: string, tipoId: string) {
  await requireSeccion("proyectos");

  const tipo = await prisma.documentoTipo.findUnique({ where: { id: tipoId } });
  if (!tipo) return { success: true };

  const hijos = await prisma.documentoTipo.findMany({ where: { parentId: tipoId } });
  for (const hijo of hijos) {
    await eliminarTipoDocumento(proyectoId, hijo.id);
  }

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

// Las tres funciones de reordenar tocan muchas filas de a una: si se cortan por
// la mitad la pantalla tiene que poder volver el listado a como estaba.
const ERROR_ORDEN = "No se pudo guardar el orden nuevo.";

/**
 * Devuelve la versión de este tipo que le pertenece al proyecto, sacándole una
 * copia si todavía era del catálogo compartido.
 *
 * Los documentos de las categorías que no son "por piso" viven en un catálogo
 * único: la misma fila se lista en todas las obras. Renombrar o mover uno ahí
 * adentro les cambiaría el listado a todas, así que en vez de editarlo se saca
 * una copia propia del proyecto que lo tapa (`reemplazaTipoId`), y el original
 * sigue intacto para el resto.
 *
 * La copia se lleva lo que ya estaba cargado en esta obra —el tilde, las notas,
 * el archivo— y también a los subitems que colgaban de él: si quedaran
 * apuntando al original desaparecerían de la pantalla junto con él.
 */
async function versionPropia(proyectoId: string, tipoId: string) {
  const tipo = await prisma.documentoTipo.findUnique({ where: { id: tipoId } });
  if (!tipo) return null;
  if (tipo.proyectoId === proyectoId) return tipo;

  const copiaPrevia = await prisma.documentoTipo.findFirst({
    where: { proyectoId, reemplazaTipoId: tipoId },
  });
  if (copiaPrevia) return copiaPrevia;

  const copia = await prisma.documentoTipo.create({
    data: {
      categoriaId: tipo.categoriaId,
      proyectoId,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
      subSeccion: tipo.subSeccion,
      parentId: tipo.parentId,
      orden: tipo.orden,
      reemplazaTipoId: tipo.id,
    },
  });

  await prisma.documento.updateMany({
    where: { proyectoId, tipoId: tipo.id },
    data: { tipoId: copia.id },
  });

  const hijos = await prisma.documentoTipo.findMany({
    where: { parentId: tipo.id, activo: true, OR: [{ proyectoId: null }, { proyectoId }] },
  });
  for (const hijo of hijos) {
    const hijoPropio = await versionPropia(proyectoId, hijo.id);
    if (hijoPropio) {
      await prisma.documentoTipo.update({
        where: { id: hijoPropio.id },
        data: { parentId: copia.id },
      });
    }
  }

  return copia;
}

export async function renombrarTipoDocumento(
  proyectoId: string,
  tipoId: string,
  nombre: string,
  descripcion?: string | null
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return { error: "El nombre no puede quedar vacío." };

  const propio = await versionPropia(proyectoId, tipoId);
  if (!propio) return { error: "Ese documento ya no existe." };

  await prisma.documentoTipo.update({
    where: { id: propio.id },
    data: {
      nombre: nombreTrim,
      // Sin el campo en la llamada la descripción no se toca: el lápiz del
      // listado renombra nomás, y no tiene por qué borrar lo que haya escrito.
      ...(descripcion === undefined ? {} : { descripcion: descripcion?.trim() || null }),
    },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

/**
 * Deja los documentos de un mismo nivel en el orden que llegan.
 *
 * Se reparten los mismos lugares que el grupo ya ocupaba en vez de renumerar
 * desde cero: las subsecciones se ordenan con bloques de mil (ver abajo), y
 * volver a numerar 0, 1, 2 acá adentro le desarmaría el bloque a la subsección
 * y la mandaría al principio de la categoría de rebote.
 *
 * Los compartidos que ya estaban en el lugar que les toca se dejan como están:
 * despegarlos del catálogo sin necesidad los desengancharía de las mejoras que
 * se le hagan al listado global más adelante, a cambio de nada.
 */
export async function reordenarTiposDocumento(proyectoId: string, idsEnOrden: string[]) {
  await requireSeccion("proyectos");

  const actuales = await prisma.documentoTipo.findMany({ where: { id: { in: idsEnOrden } } });
  const porId = new Map(actuales.map((t) => [t.id, t]));

  // Los lugares del grupo, ordenados y sin empates: si dos documentos tenían el
  // mismo número, repartirlos tal cual dejaría el arrastre sin efecto.
  let anterior = -1;
  const lugares = idsEnOrden
    .flatMap((id) => {
      const tipo = porId.get(id);
      return tipo ? [tipo.orden] : [];
    })
    .sort((a, b) => a - b)
    .map((orden) => {
      anterior = orden > anterior ? orden : anterior + 1;
      return anterior;
    });

  try {
    let i = 0;
    for (const id of idsEnOrden) {
      const actual = porId.get(id);
      if (!actual) continue;
      const orden = lugares[i++];
      if (actual.proyectoId !== proyectoId && actual.orden === orden) continue;

      const propio = await versionPropia(proyectoId, id);
      if (propio && propio.orden !== orden) {
        await prisma.documentoTipo.update({ where: { id: propio.id }, data: { orden } });
      }
    }
  } catch {
    return { error: ERROR_ORDEN };
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

/**
 * La subsección no es una fila: es un texto repetido en cada documento que
 * cuelga de ella, así que renombrarla es reescribir ese texto en todos (y
 * despegar del catálogo a los que hiciera falta).
 */
export async function renombrarSubSeccionDocumento(
  proyectoId: string,
  categoriaId: string,
  anterior: string,
  nombre: string
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return { error: "El nombre no puede quedar vacío." };
  if (nombreTrim === anterior) return { success: true };

  const afectados = await prisma.documentoTipo.findMany({
    where: {
      categoriaId,
      subSeccion: anterior,
      activo: true,
      OR: [{ proyectoId: null }, { proyectoId }],
    },
  });

  for (const tipo of afectados) {
    const propio = await versionPropia(proyectoId, tipo.id);
    if (propio) {
      await prisma.documentoTipo.update({
        where: { id: propio.id },
        data: { subSeccion: nombreTrim },
      });
    }
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

/**
 * Las subsecciones se ordenan por el orden del primer documento que tienen
 * adentro, así que moverlas es renumerar a sus documentos. A cada una se le da
 * un bloque de mil lugares, que alcanza de sobra y deja intacto el orden que
 * tengan entre ellos adentro del bloque.
 */
export async function reordenarSubSeccionesDocumento(
  proyectoId: string,
  categoriaId: string,
  nombresEnOrden: string[]
) {
  await requireSeccion("proyectos");

  const raices = await prisma.documentoTipo.findMany({
    where: {
      categoriaId,
      parentId: null,
      activo: true,
      OR: [{ proyectoId: null }, { proyectoId }],
    },
    orderBy: { orden: "asc" },
  });

  try {
    for (let bloque = 0; bloque < nombresEnOrden.length; bloque++) {
      const miembros = raices.filter((t) => t.subSeccion === nombresEnOrden[bloque]);
      for (let i = 0; i < miembros.length; i++) {
        const orden = bloque * 1000 + i;
        if (miembros[i].proyectoId !== proyectoId && miembros[i].orden === orden) continue;

        const propio = await versionPropia(proyectoId, miembros[i].id);
        if (propio && propio.orden !== orden) {
          await prisma.documentoTipo.update({ where: { id: propio.id }, data: { orden } });
        }
      }
    }
  } catch {
    return { error: ERROR_ORDEN };
  }
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

// Las categorías son una sola fila compartida por todas las obras y de ellas
// cuelga la generación de planos por piso, así que no se despegan por proyecto:
// renombrar o mover una le cambia el listado a todos. La pantalla lo avisa.
export async function renombrarCategoriaDocumento(
  proyectoId: string,
  categoriaId: string,
  nombre: string
) {
  await requireSeccion("proyectos");

  const nombreTrim = nombre.trim();
  if (!nombreTrim) return { error: "El nombre no puede quedar vacío." };

  const chocan = await prisma.documentoCategoria.findFirst({
    where: { nombre: nombreTrim, id: { not: categoriaId } },
  });
  if (chocan) return { error: `Ya hay una categoría que se llama "${nombreTrim}".` };

  await prisma.documentoCategoria.update({
    where: { id: categoriaId },
    data: { nombre: nombreTrim },
  });
  revalidatePath(`/proyectos/${proyectoId}`);
  return { success: true };
}

export async function reordenarCategoriasDocumento(proyectoId: string, idsEnOrden: string[]) {
  await requireSeccion("proyectos");

  try {
    await prisma.$transaction(
      idsEnOrden.map((id, index) =>
        prisma.documentoCategoria.update({ where: { id }, data: { orden: index } })
      )
    );
  } catch {
    return { error: ERROR_ORDEN };
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
