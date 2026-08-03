import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const RENOMBRES: Record<string, string> = {
  "Materiales": "MATERIALES",
  "Mano de obra": "MANO DE OBRA",
};

async function main() {
  for (const [nombreViejo, nombreNuevo] of Object.entries(RENOMBRES)) {
    const result = await prisma.subrubro.updateMany({
      where: { nombre: nombreViejo },
      data: { nombre: nombreNuevo },
    });
    console.log(`"${nombreViejo}" -> "${nombreNuevo}": ${result.count} actualizados.`);
  }
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
