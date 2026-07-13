import "dotenv/config";
import bcrypt from "bcryptjs";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USUARIOS_INICIALES = [
  { email: "admin@estudio.com", password: "cambiar123", nombre: "Admin", esAdmin: true },
];

async function main() {
  for (const u of USUARIOS_INICIALES) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { esAdmin: u.esAdmin },
      create: { email: u.email, passwordHash, nombre: u.nombre, esAdmin: u.esAdmin },
    });
    console.log(`Usuario listo: ${u.email} / ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
