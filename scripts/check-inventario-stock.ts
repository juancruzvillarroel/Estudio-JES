import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const materiales = await prisma.material.findMany({ include: { rubro: true } });
  const movimientos = await prisma.inventarioMovimiento.findMany();

  const stockPorMaterial = new Map<string, number>();
  for (const mov of movimientos) {
    const delta = mov.tipo === "ENTRADA" ? Number(mov.cantidad) : -Number(mov.cantidad);
    stockPorMaterial.set(mov.materialId, (stockPorMaterial.get(mov.materialId) ?? 0) + delta);
  }

  const conStock = materiales.filter((m) => (stockPorMaterial.get(m.id) ?? 0) > 0);

  console.log("Total materiales:", materiales.length);
  console.log("Total movimientos:", movimientos.length);
  console.log("Materiales con stock > 0:", conStock.length);
  console.log(conStock.map((m) => `${m.nombre}: ${stockPorMaterial.get(m.id)} ${m.unidad}`).join("\n"));
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
