import "dotenv/config";
import bcrypt from "bcryptjs";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Se identifica por `usuario`, que es con lo que se inicia sesión. El email es
// opcional y acá ni se carga.
const USUARIOS_INICIALES = [
  { usuario: "admin", password: "cambiar123", nombre: "Admin", esAdmin: true },
];

async function main() {
  for (const u of USUARIOS_INICIALES) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { usuario: u.usuario },
      update: { esAdmin: u.esAdmin },
      create: { usuario: u.usuario, passwordHash, nombre: u.nombre, esAdmin: u.esAdmin },
    });
    console.log(`Usuario listo: ${u.usuario} / ${u.password}`);
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
