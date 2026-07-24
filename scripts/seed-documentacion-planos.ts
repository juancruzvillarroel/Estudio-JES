// Carga (o actualiza) las categorías de "Documentación" correspondientes a
// las etapas del listado de planos, más algunos ajustes puntuales de
// nombres/sub-tipos por piso. Es idempotente: se puede correr varias veces
// sin duplicar filas, porque usa upsert sobre el nombre (único).
//
// Los tipos de documento (planos puntuales) dentro de cada etapa se agregan
// después, desde la propia UI de Documentación ("+ Agregar documento"), o
// sumando más entradas acá si en el futuro se quiere volver a cargar todo
// por script.
//
// Uso (PowerShell, con DATABASE_URL en el entorno o en .env):
//   npx tsx --env-file=.env scripts/seed-documentacion-planos.ts

import { prisma } from "../src/lib/db";

// Etapas que varían según la cantidad de pisos del proyecto: se genera un
// documento por piso automáticamente (ver Proyecto.cantidadPisos y
// sincronizarDocumentosPorPiso en src/actions/documentos.ts). El resto
// queda como documento único por proyecto, igual que antes.
//
// - Estructura: los planos se nombran por losa (S/PB, S/1°, ..., S/Azotea),
//   por eso lleva prefijoPiso "S/" en vez del nombre largo del piso.
// - Instalaciones: se generan 6 sub-tipos, cada uno repetido por piso
//   (ej. "Instalación sanitaria - Planta baja").
const ETAPAS: {
  nombre: string;
  porPiso: boolean;
  prefijoPiso?: string;
  subTipos?: string[];
}[] = [
  { nombre: "Arquitectura", porPiso: true },
  { nombre: "Estructura", porPiso: true, prefijoPiso: "S/" },
  {
    nombre: "Instalaciones",
    porPiso: true,
    subTipos: [
      "Instalación sanitaria",
      "Instalación de gas",
      "Instalación termomecánica",
      "Instalación eléctrica",
      "Instalación de calefacción",
      "Instalación de incendio",
    ],
  },
  { nombre: "Albañilería", porPiso: true },
  { nombre: "Detalles constructivos", porPiso: false },
  { nombre: "Yesería y Durlock", porPiso: false },
  { nombre: "Carpinterías", porPiso: false },
  { nombre: "Herrería", porPiso: false },
  { nombre: "Zinguería", porPiso: false },
  { nombre: "Revestimientos", porPiso: false },
  { nombre: "Mobiliario", porPiso: false },
  { nombre: "Pliegos especificaciones", porPiso: false },
];

// Documentos únicos (no varían por piso) que se agregan siempre dentro de
// la categoría Estructura, en todos los proyectos (catálogo global, con
// orden alto para que queden listados después de los planos por piso).
const EXTRAS_ESTRUCTURA = ["Fundaciones", "Tensores", "Corte"];

async function main() {
  for (let i = 0; i < ETAPAS.length; i++) {
    const { nombre, porPiso, prefijoPiso, subTipos } = ETAPAS[i];
    await prisma.documentoCategoria.upsert({
      where: { nombre },
      update: {
        orden: i + 1,
        activo: true,
        porPiso,
        prefijoPiso: prefijoPiso ?? null,
        subTipos: subTipos ?? [],
      },
      create: {
        nombre,
        orden: i + 1,
        porPiso,
        prefijoPiso: prefijoPiso ?? null,
        subTipos: subTipos ?? [],
      },
    });
  }

  const estructura = await prisma.documentoCategoria.findUniqueOrThrow({
    where: { nombre: "Estructura" },
  });
  for (let i = 0; i < EXTRAS_ESTRUCTURA.length; i++) {
    const nombre = EXTRAS_ESTRUCTURA[i];
    const existente = await prisma.documentoTipo.findFirst({
      where: { categoriaId: estructura.id, proyectoId: null, nombre },
    });
    if (existente) {
      await prisma.documentoTipo.update({ where: { id: existente.id }, data: { activo: true } });
    } else {
      await prisma.documentoTipo.create({
        data: { categoriaId: estructura.id, nombre, orden: 1000 + i },
      });
    }
  }

  console.log(`Listo: ${ETAPAS.length} etapas de planos cargadas/actualizadas.`);
  console.log(`Listo: ${EXTRAS_ESTRUCTURA.length} documentos fijos de Estructura cargados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
