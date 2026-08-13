/**
 * Marca como facturados (con IVA) los medios de pago que se usan con factura.
 * Se corre una sola vez, después de agregar `MedioPago.incluyeIva`.
 *
 * El criterio es el mismo que definimos en la UI: los pagos con factura son
 * los de tipo "FC. Efectivo" y "Transferencia". El resto queda en false.
 */
import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Se comparan sin acentos ni mayúsculas para tolerar variantes de tipeo.
const NOMBRES_CON_FACTURA = ["fc. efectivo", "fc efectivo", "transferencia"];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

async function main() {
  const medios = await prisma.medioPago.findMany({
    select: { id: true, nombre: true, incluyeIva: true, proyecto: { select: { nombre: true } } },
  });

  const aMarcar = medios.filter(
    (m) => NOMBRES_CON_FACTURA.includes(normalizar(m.nombre)) && !m.incluyeIva
  );

  for (const medio of aMarcar) {
    await prisma.medioPago.update({ where: { id: medio.id }, data: { incluyeIva: true } });
    console.log(`  ✓ ${medio.proyecto.nombre} | ${medio.nombre}`);
  }

  console.log(`\nMarcados ${aMarcar.length} medios de pago como facturados.`);

  const final = await prisma.medioPago.findMany({
    select: { nombre: true, incluyeIva: true, proyecto: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });
  console.log("\nEstado final:");
  for (const m of final) {
    console.log(`  ${m.incluyeIva ? "[IVA]" : "[   ]"} ${m.proyecto.nombre} | ${m.nombre}`);
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
