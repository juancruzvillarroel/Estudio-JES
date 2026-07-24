// Backfill puntual: re-sincroniza los documentos por piso de todos los
// proyectos ya existentes, sin esperar a que alguien vuelva a editar cada
// proyecto uno por uno. Se puede correr de nuevo sin problema (la lógica es
// idempotente).
//
// Nota: no importa src/actions/documentos.ts porque ese archivo (vía
// requireSeccion) tira de "server-only", que no se puede cargar en un
// script suelto de node/tsx. Por eso la lógica de sincronización está
// duplicada acá (debe mantenerse igual a sincronizarDocumentosPorPiso).
//
// Uso (PowerShell, con DATABASE_URL en el entorno o en .env):
//   npx tsx --env-file=.env scripts/backfill-azotea.ts

import { prisma } from "../src/lib/db";

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

async function sincronizarDocumentosPorPiso(proyectoId: string, cantidadPisos: number) {
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

async function main() {
  const proyectos = await prisma.proyecto.findMany({
    select: { id: true, nombre: true, cantidadPisos: true },
  });

  for (const proyecto of proyectos) {
    await sincronizarDocumentosPorPiso(proyecto.id, proyecto.cantidadPisos);
    console.log(`OK: ${proyecto.nombre} (${proyecto.cantidadPisos} pisos)`);
  }
  console.log(`Listo: ${proyectos.length} proyectos sincronizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
