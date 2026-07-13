import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const materiales = await prisma.material.findMany({ select: { id: true, nombre: true } });

  let actualizados = 0;
  for (const m of materiales) {
    const mayus = m.nombre.toUpperCase();
    if (mayus !== m.nombre) {
      await prisma.material.update({ where: { id: m.id }, data: { nombre: mayus } });
      actualizados++;
    }
  }

  console.log(`Materiales revisados: ${materiales.length}`);
  console.log(`Materiales actualizados a mayúscula: ${actualizados}`);
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
