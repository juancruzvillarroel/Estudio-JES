/**
 * Agrega a todas las obras las tablas de la plantilla de Cómputos 2 (ver
 * src/lib/plantilla-computos2.ts) que todavía no tengan. Las obras nuevas ya
 * las reciben al crearse; esto es para las que existían antes.
 *
 * Idempotente: una sección que la obra ya tiene no se toca.
 *
 *   npx tsx scripts/aplicar-plantilla-computos2.ts            (muestra qué haría)
 *   npx tsx scripts/aplicar-plantilla-computos2.ts --aplicar  (lo hace)
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { aplicarPlantillaComputos2 } from "../src/lib/plantilla-computos2";

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  console.log(APLICAR ? ">> APLICANDO\n" : ">> SIMULACRO (falta --aplicar)\n");
  const proyectos = await prisma.proyecto.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  for (const p of proyectos) {
    const creadas = await aplicarPlantillaComputos2(p.id, { simular: !APLICAR });
    console.log(`${p.nombre}: ${creadas.length ? creadas.join(" | ") : "nada que agregar"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
