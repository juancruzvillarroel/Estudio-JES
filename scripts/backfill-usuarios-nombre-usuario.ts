/**
 * Le asigna un nombre de usuario a los usuarios que ya existían, para poder
 * pasar el login de email a usuario. Se corre una sola vez, después de agregar
 * `User.usuario` como opcional y antes de hacerlo obligatorio.
 *
 * El nombre de usuario sale del nombre real: "Jorge García" → "jorge.garcia".
 * Sin acentos ni mayúsculas, que son fuente segura de errores al tipear.
 */
import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function aNombreUsuario(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function main() {
  const usuarios = await prisma.user.findMany({
    select: { id: true, nombre: true, email: true, usuario: true },
    orderBy: { nombre: "asc" },
  });

  // Los que ya tienen uno cargado también cuentan para no repetir.
  const tomados = new Set(usuarios.flatMap((u) => (u.usuario ? [u.usuario] : [])));

  for (const u of usuarios) {
    if (u.usuario) {
      console.log(`  = ${u.nombre} ya tenía "${u.usuario}"`);
      continue;
    }

    const base = aNombreUsuario(u.nombre) || "usuario";
    let candidato = base;
    let n = 2;
    while (tomados.has(candidato)) {
      candidato = `${base}${n++}`;
    }
    tomados.add(candidato);

    await prisma.user.update({ where: { id: u.id }, data: { usuario: candidato } });
    console.log(`  ✓ ${u.nombre} → ${candidato}`);
  }

  console.log("\nEstado final:");
  const final = await prisma.user.findMany({
    select: { nombre: true, usuario: true, email: true, esAdmin: true },
    orderBy: { usuario: "asc" },
  });
  for (const u of final) {
    console.log(
      `  ${u.esAdmin ? "[admin]" : "[     ]"} ${u.usuario} | ${u.nombre} | ${u.email ?? "sin email"}`
    );
  }

  const sinUsuario = final.filter((u) => !u.usuario).length;
  console.log(`\nSin nombre de usuario: ${sinUsuario}`);
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
