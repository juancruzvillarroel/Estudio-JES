import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rubros = await prisma.rubro.findMany({ orderBy: { nombre: "asc" } });
  const materiales = await prisma.material.findMany({
    orderBy: { nombre: "asc" },
    include: { rubro: true },
  });
  console.log("RUBROS:", JSON.stringify(rubros, null, 0));
  console.log("MATERIALES:", JSON.stringify(materiales.map((m) => ({ id: m.id, nombre: m.nombre, unidad: m.unidad, rubro: m.rubro?.nombre ?? null })), null, 0));
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
