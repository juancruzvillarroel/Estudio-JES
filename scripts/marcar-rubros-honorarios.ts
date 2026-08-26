/**
 * Deja marcado, una sola vez, cuál es el rubro de honorarios del estudio y qué
 * rubros no entran en la base sobre la que se calculan.
 *
 * Replica el criterio con el que se venían cargando los honorarios a mano: la
 * compra del terreno no paga honorarios, y el propio rubro de honorarios
 * tampoco (si no, cada honorario engordaría la base del siguiente).
 *
 * De acá en adelante esto se edita desde la pantalla de rubros, no con este
 * script.
 */
import "dotenv/config";
import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const NO_PAGAN = ["ADQUISICIÓN_DE_TERRENO"];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });

  const honorarios = await prisma.rubro.findFirst({
    where: { nombre: { contains: "HONORARIO" } },
  });
  if (!honorarios) {
    console.error("No se encontró el rubro de honorarios. No se cambió nada.");
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    // El rubro de honorarios: es el que dispara la calculadora y no paga.
    await tx.rubro.updateMany({
      where: { id: { not: honorarios.id } },
      data: { esHonorarios: false },
    });
    await tx.rubro.update({
      where: { id: honorarios.id },
      data: { esHonorarios: true, pagaHonorarios: false },
    });
    await tx.rubro.updateMany({
      where: { nombre: { in: NO_PAGAN } },
      data: { pagaHonorarios: false },
    });
  });

  const rubros = await prisma.rubro.findMany({ orderBy: { orden: "asc" } });
  console.log("rubro".padEnd(34), "paga", "es honorarios");
  for (const r of rubros) {
    console.log(
      r.nombre.padEnd(34),
      (r.pagaHonorarios ? "sí" : "NO").padEnd(4),
      r.esHonorarios ? "<-- ES EL RUBRO DE HONORARIOS" : ""
    );
  }

  await prisma.$disconnect();
}

main();
