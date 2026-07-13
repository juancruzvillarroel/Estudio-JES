import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PREFIJO_SIN_RUBRO = "GEN";

/**
 * Recalcula TODOS los códigos de rubros y materiales para pasar del
 * esquema anterior (prefijo por letras, ej. HIE-001) al nuevo esquema
 * numérico:
 *  - Rubro: correlativo de 2 dígitos según su campo "orden" (01, 02, ...).
 *  - Material: "<código de rubro>-<número>", numerado por orden alfabético
 *    del nombre dentro de cada rubro (sin rubro -> prefijo "GEN").
 * Los proveedores no se tocan (siguen con PROV-0001, PROV-0002, ...).
 *
 * Usa un paso intermedio con códigos temporales únicos antes de escribir
 * los definitivos, para evitar choques de la restricción "unique" si dos
 * registros necesitan "intercambiar" código.
 */
async function main() {
  // 1) Rubros: correlativo numérico según "orden".
  const rubros = await prisma.rubro.findMany({ orderBy: { orden: "asc" } });
  const nuevoPrefijoPorId = new Map<string, string>();
  let numeroRubro = 0;
  for (const r of rubros) {
    numeroRubro += 1;
    nuevoPrefijoPorId.set(r.id, String(numeroRubro).padStart(2, "0"));
  }

  for (const r of rubros) {
    await prisma.rubro.update({ where: { id: r.id }, data: { codigoPrefijo: `TMP-${r.id}` } });
  }
  for (const r of rubros) {
    const codigoPrefijo = nuevoPrefijoPorId.get(r.id)!;
    if (r.codigoPrefijo !== codigoPrefijo) {
      console.log(`Rubro "${r.nombre}": ${r.codigoPrefijo} -> ${codigoPrefijo}`);
    }
    await prisma.rubro.update({ where: { id: r.id }, data: { codigoPrefijo } });
  }

  // 2) Materiales: agrupar por rubro (o "sin rubro"), ordenar alfabéticamente
  //    por nombre, y numerar correlativo dentro de cada grupo.
  const materiales = await prisma.material.findMany();
  const grupos = new Map<string, typeof materiales>();
  for (const m of materiales) {
    const prefijo = m.rubroId ? (nuevoPrefijoPorId.get(m.rubroId) ?? PREFIJO_SIN_RUBRO) : PREFIJO_SIN_RUBRO;
    const grupo = grupos.get(prefijo) ?? [];
    grupo.push(m);
    grupos.set(prefijo, grupo);
  }

  const nuevoCodigoPorId = new Map<string, string>();
  for (const [prefijo, grupo] of grupos) {
    grupo.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    let numero = 0;
    for (const m of grupo) {
      numero += 1;
      nuevoCodigoPorId.set(m.id, `${prefijo}-${String(numero).padStart(2, "0")}`);
    }
  }

  for (const m of materiales) {
    await prisma.material.update({ where: { id: m.id }, data: { codigo: `TMP-${m.id}` } });
  }
  for (const m of materiales) {
    const codigo = nuevoCodigoPorId.get(m.id)!;
    if (m.codigo !== codigo) {
      console.log(`Material "${m.nombre}": ${m.codigo} -> ${codigo}`);
    }
    await prisma.material.update({ where: { id: m.id }, data: { codigo } });
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
