import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PREFIJO_SIN_RUBRO = "GEN";

function quitarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function basePrefijo(nombre: string): string {
  const soloLetras = quitarAcentos(nombre)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return soloLetras.slice(0, 3) || PREFIJO_SIN_RUBRO;
}

async function main() {
  // 1) Rubros: les asignamos un prefijo de 3 letras (único) a partir del nombre.
  const rubros = await prisma.rubro.findMany({ orderBy: { createdAt: "asc" } });
  const prefijosUsados = new Set<string>();
  for (const r of rubros) {
    if (r.codigoPrefijo) {
      prefijosUsados.add(r.codigoPrefijo);
      continue;
    }
    const base = basePrefijo(r.nombre);
    let candidato = base;
    let intento = 1;
    while (prefijosUsados.has(candidato)) {
      intento += 1;
      candidato = `${base.slice(0, 2)}${intento}`;
    }
    prefijosUsados.add(candidato);
    await prisma.rubro.update({ where: { id: r.id }, data: { codigoPrefijo: candidato } });
    console.log(`Rubro "${r.nombre}" -> ${candidato}`);
  }

  // 2) Materiales: código correlativo dentro del prefijo de su rubro (o "GEN" sin rubro).
  const materiales = await prisma.material.findMany({
    orderBy: { createdAt: "asc" },
    include: { rubro: true },
  });
  const contadores = new Map<string, number>();
  for (const m of materiales) {
    if (m.codigo) continue;
    const prefijo = m.rubro?.codigoPrefijo ?? PREFIJO_SIN_RUBRO;
    const siguiente = (contadores.get(prefijo) ?? 0) + 1;
    contadores.set(prefijo, siguiente);
    const codigo = `${prefijo}-${String(siguiente).padStart(3, "0")}`;
    await prisma.material.update({ where: { id: m.id }, data: { codigo } });
    console.log(`Material "${m.nombre}" -> ${codigo}`);
  }

  // 3) Proveedores: correlativo simple PROV-0001, PROV-0002, ...
  const proveedores = await prisma.proveedor.findMany({ orderBy: { createdAt: "asc" } });
  let numeroProveedor = 0;
  for (const p of proveedores) {
    if (p.codigo) continue;
    numeroProveedor += 1;
    const codigo = `PROV-${String(numeroProveedor).padStart(4, "0")}`;
    await prisma.proveedor.update({ where: { id: p.id }, data: { codigo } });
    console.log(`Proveedor "${p.nombre}" -> ${codigo}`);
  }

  console.log("Listo.");
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
