import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUBRUBROS_DEFAULT = ["Materiales", "Mano de obra"];

async function main() {
  const rubros = await prisma.rubro.findMany({
    include: { subrubros: true },
    orderBy: { orden: "asc" },
  });

  for (const rubro of rubros) {
    const nombresExistentes = new Set(rubro.subrubros.map((s) => s.nombre));
    let ordenSiguiente = rubro.subrubros.length;

    for (const nombre of SUBRUBROS_DEFAULT) {
      if (nombresExistentes.has(nombre)) {
        console.log(`- Ya existe "${nombre}" en "${rubro.nombre}", se omite.`);
        continue;
      }
      await prisma.subrubro.create({
        data: { rubroId: rubro.id, nombre, orden: ordenSiguiente },
      });
      ordenSiguiente += 1;
      console.log(`+ Creado "${nombre}" en "${rubro.nombre}".`);
    }
  }

  console.log(`Listo. Rubros procesados: ${rubros.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
