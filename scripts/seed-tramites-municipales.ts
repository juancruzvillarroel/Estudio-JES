// Carga (o actualiza) el catálogo de documentos/trámites municipales.
// Es idempotente: se puede correr varias veces sin duplicar filas, porque
// busca por categoría+etapa+nombre antes de crear (categoría y etapa se
// crean solas si todavía no existen).
//
// Para agregar más trámites en el futuro (Administración, Demolición, u
// otras etapas de Obra), sumá entradas al array ITEMS de abajo y volvé a
// correr este script.
//
// Uso (PowerShell, con DATABASE_URL en el entorno o en .env):
//   npx tsx scripts/seed-tramites-municipales.ts

import { prisma } from "../src/lib/db";

// Nombres tal cual quedaron cargados en CategoriaMunicipal (ver
// scripts-tmp-backfill.ts / la migración de categorías a catálogo editable).
type CategoriaCodigo = "ADMINISTRACION" | "DEMOLICION" | "OBRA";
const CATEGORIA_NOMBRES: Record<CategoriaCodigo, string> = {
  ADMINISTRACION: "Administración",
  DEMOLICION: "Demolición",
  OBRA: "Obra",
};

type ItemSeed = {
  categoria: CategoriaCodigo;
  etapa: string;
  nombre: string;
  descripcion?: string;
  orden: number;
};

const ITEMS: ItemSeed[] = [
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "Estatuto sociedad",
    orden: 1,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "Poder especial vendedores",
    orden: 2,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "DNI propietarios y apoderado",
    orden: 3,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "Escritura",
    orden: 4,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "DNI presidente sociedad",
    orden: 5,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "Inscripción sociedad AFIP",
    orden: 6,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Documentos",
    nombre: "Inscripción IIBB",
    orden: 7,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Factibilidad",
    nombre: "Factibilidad Edesur",
    orden: 1,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Factibilidad",
    nombre: "Factibilidad Metrogas",
    orden: 2,
  },
  {
    categoria: "ADMINISTRACION",
    etapa: "Factibilidad",
    nombre: "Factibilidad AySA",
    orden: 3,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Planos (plantas, corte y fachada)",
    orden: 1,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Escritura vendedores",
    orden: 2,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Permiso de obra",
    orden: 3,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Conformidad de condominios",
    orden: 4,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Informe de dominio",
    orden: 5,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Memoria de demolición firmada por representante técnico y director demoledor",
    orden: 6,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Encomienda director demoledor",
    orden: 7,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Encomienda rep. técnico de demolición",
    orden: 8,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Comprobante de pago de derechos de demolición",
    orden: 9,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Presentación",
    nombre: "Poder",
    descripcion: "Cuando los propietarios sean más de uno.",
    orden: 10,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Póliza de seguro",
    orden: 1,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Desratización",
    orden: 2,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Cortes de servicio de luz",
    orden: 3,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Cortes de servicio de gas",
    orden: 4,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Encomienda consejo profesional",
    orden: 5,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Tasa de inspección (boleta)",
    orden: 6,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Encomiendas de seguridad e higiene",
    orden: 7,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "DDJJ de vigencia de póliza",
    orden: 8,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Cartel de obra",
    orden: 9,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Memoria y plan de trabajos de demolición",
    orden: 10,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Cálculo estructural de apuntalamiento de medianeras",
    orden: 11,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Memoria técnica del estado de las medianeras",
    orden: 12,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Inicio",
    nombre: "Boleta derechos de demolición",
    orden: 13,
  },
  {
    categoria: "DEMOLICION",
    etapa: "Plano registrado demo",
    nombre: "Plano registrado demo",
    orden: 1,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "Póliza de seguro",
    descripcion:
      "Siempre verificar que los valores de la póliza estén actualizados o consultarnos antes de emitirla.",
    orden: 1,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "Memoria y plan de tareas",
    descripcion: "Se adjunta nuevo modelo de memoria de la DGFyCO.",
    orden: 2,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "Tasa de inspección",
    descripcion: "La boleta se las enviamos nosotras.",
    orden: 3,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "DDJJ de vigencia de póliza",
    descripcion: "Se las envió el estudio para que la completen con todos los datos de la póliza.",
    orden: 4,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "Designación de empresa excavadora",
    descripcion: "En caso de corresponder.",
    orden: 5,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "Designación de empresa constructora",
    descripcion: "En caso de corresponder.",
    orden: 6,
  },
  {
    categoria: "OBRA",
    etapa: "Inicio",
    nombre: "Encomienda del licenciado en higiene y seguridad",
    orden: 7,
  },
];

async function main() {
  const categoriaIdPorCodigo = new Map<CategoriaCodigo, string>();
  const etapaIdPorClave = new Map<string, string>();

  for (const item of ITEMS) {
    let categoriaId = categoriaIdPorCodigo.get(item.categoria);
    if (!categoriaId) {
      const nombre = CATEGORIA_NOMBRES[item.categoria];
      const categoria = await prisma.categoriaMunicipal.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      });
      categoriaId = categoria.id;
      categoriaIdPorCodigo.set(item.categoria, categoriaId);
    }

    const claveEtapa = `${categoriaId}::${item.etapa}`;
    let etapaId = etapaIdPorClave.get(claveEtapa);
    if (!etapaId) {
      const existente = await prisma.etapaMunicipal.findFirst({
        where: { categoriaId, nombre: item.etapa },
      });
      const etapa =
        existente ?? (await prisma.etapaMunicipal.create({ data: { categoriaId, nombre: item.etapa } }));
      etapaId = etapa.id;
      etapaIdPorClave.set(claveEtapa, etapaId);
    }

    const existente = await prisma.tramiteMunicipalTipo.findFirst({
      where: { categoriaId, etapaId, nombre: item.nombre },
    });

    if (existente) {
      await prisma.tramiteMunicipalTipo.update({
        where: { id: existente.id },
        data: { descripcion: item.descripcion, orden: item.orden, activo: true },
      });
    } else {
      await prisma.tramiteMunicipalTipo.create({
        data: {
          categoriaId,
          etapaId,
          nombre: item.nombre,
          descripcion: item.descripcion,
          orden: item.orden,
        },
      });
    }
  }
  console.log(`Listo: ${ITEMS.length} tipos de trámite cargados/actualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
