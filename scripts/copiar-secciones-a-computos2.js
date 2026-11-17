/**
 * Copia a Cómputos 2 las secciones de Cómputo (el de siempre) que cada obra
 * todavía no tiene ahí, rubro por rubro y del mismo lado del switch
 * (materiales / mano de obra).
 *
 * Copia la ESTRUCTURA y nada más: la sección, sus ítems con la unidad, el
 * desperdicio, la conversión a material, el modelo y las notas, y las filas
 * extra. Ninguna medición: Cómputos 2 existe para volver a cargar el rubro de
 * cero, así que los números quedan en Cómputo.
 *
 * El orden de filas sí se copia, porque es de la misma obra: las claves
 * "nivel:<id>" siguen apuntando a niveles que existen. Las "extra:<id>" se
 * traducen a las filas extra nuevas; sin eso quedarían como claves muertas y
 * esas filas caerían al final.
 *
 * Una sección "ya está" si en Cómputos 2 hay otra con el mismo nombre sin
 * importar mayúsculas ni espacios de más: "CONTRAPISOS / carpetas" de Cómputo
 * es la "CONTRAPISOS / CARPETAS" que ya trajo la plantilla.
 *
 * Se saltean las secciones de prueba que quedaron en Cómputo de CONDARCO
 * ("Cómputos 2" en cada rubro, "HORMIGÓN2"): están vacías y no son de la obra.
 *
 * Idempotente: correrlo de nuevo no duplica nada.
 *
 *   node scripts/copiar-secciones-a-computos2.js            (muestra qué haría)
 *   node scripts/copiar-secciones-a-computos2.js --aplicar  (lo hace)
 */

// CommonJS a propósito, igual que copiar-base-computos.js: se corre con `node`
// pelado, sin el build de Next.
/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ quiet: true });
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const APLICAR = process.argv.includes("--aplicar");

const clave = (nombre) => nombre.trim().replace(/\s+/g, " ").toUpperCase();
const ES_PRUEBA = new Set(["CÓMPUTOS 2", "HORMIGÓN2"]);

async function main() {
  console.log(APLICAR ? ">> APLICANDO\n" : ">> SIMULACRO (falta --aplicar)\n");

  const secciones = await sql`
    select s.id, s."proyectoId", s."rubroId", s.tipo, s.nombre, s.orden,
           s."ordenFilas", s."esComputos2", p.nombre as proyecto, r.nombre as rubro
    from "ComputoSeccion" s
    join "Proyecto" p on p.id = s."proyectoId"
    join "Rubro" r on r.id = s."rubroId"
    order by p.nombre, r.nombre, s.tipo, s.orden, s."createdAt"`;

  const grupo = (s) => `${s.proyectoId}|${s.rubroId}|${s.tipo}`;
  const enC2 = new Map(); // grupo -> { nombres, maxOrden }
  for (const s of secciones.filter((s) => s.esComputos2)) {
    const g = enC2.get(grupo(s)) ?? { nombres: new Set(), maxOrden: -1 };
    g.nombres.add(clave(s.nombre));
    g.maxOrden = Math.max(g.maxOrden, s.orden);
    enC2.set(grupo(s), g);
  }

  const aCopiar = secciones.filter((s) => {
    if (s.esComputos2 || ES_PRUEBA.has(clave(s.nombre))) return false;
    return !enC2.get(grupo(s))?.nombres.has(clave(s.nombre));
  });

  let totSecciones = 0;
  let totItems = 0;
  let totExtras = 0;
  let proyectoActual = null;

  for (const s of aCopiar) {
    const items = await sql`
      select "rubroId", "tipoId", nombre, unidad, desperdicio, rinde, "rindeUnidad",
             "porBulto", "bultoNombre", modelo, notas, orden
      from "ComputoItem" where "seccionId" = ${s.id} order by orden, "createdAt"`;
    const extras = await sql`
      select id, nombre, orden from "ComputoFilaExtra"
      where "seccionId" = ${s.id} order by orden`;

    if (s.proyecto !== proyectoActual) {
      proyectoActual = s.proyecto;
      console.log(`\n${s.proyecto}`);
    }
    console.log(
      `  ${s.rubro} · ${s.tipo} · ${s.nombre}  (${items.length} ítems, ${extras.length} filas extra)`
    );
    totSecciones++;
    totItems += items.length;
    totExtras += extras.length;
    if (!APLICAR) continue;

    // Va al final de lo que ya hay en Cómputos 2 en ese rubro, en el mismo
    // orden relativo que tenía en Cómputo.
    const g = enC2.get(grupo(s)) ?? { nombres: new Set(), maxOrden: -1 };
    g.maxOrden += 1;
    g.nombres.add(clave(s.nombre));
    enC2.set(grupo(s), g);

    const creada = await sql`
      insert into "ComputoSeccion"
        ("id", "proyectoId", "rubroId", tipo, nombre, "esComputos2", orden, "ordenFilas")
      values (gen_random_uuid()::text, ${s.proyectoId}, ${s.rubroId},
              ${s.tipo}::"TipoComputo", ${s.nombre}, true, ${g.maxOrden}, '{}')
      on conflict ("proyectoId", "rubroId", tipo, "esComputos2", nombre) do nothing
      returning id`;
    const nuevaId = creada[0]?.id;
    if (!nuevaId) continue;

    for (const i of items) {
      await sql`
        insert into "ComputoItem"
          ("id", "proyectoId", "rubroId", "seccionId", "tipoId", nombre, unidad,
           desperdicio, rinde, "rindeUnidad", "porBulto", "bultoNombre",
           modelo, notas, orden, "updatedAt")
        values (gen_random_uuid()::text, ${s.proyectoId}, ${i.rubroId}, ${nuevaId},
                ${i.tipoId}, ${i.nombre}, ${i.unidad}::"UnidadComputo",
                ${i.desperdicio}, ${i.rinde}, ${i.rindeUnidad}::"UnidadComputo",
                ${i.porBulto}, ${i.bultoNombre}, ${i.modelo}, ${i.notas}, ${i.orden}, now())`;
    }

    const extraNueva = new Map();
    for (const e of extras) {
      const r = await sql`
        insert into "ComputoFilaExtra" ("id", "seccionId", nombre, orden)
        values (gen_random_uuid()::text, ${nuevaId}, ${e.nombre}, ${e.orden})
        returning id`;
      extraNueva.set(e.id, r[0].id);
    }

    const ordenFilas = (s.ordenFilas ?? [])
      .map((k) => (k.startsWith("extra:") ? extraNueva.get(k.slice(6)) && `extra:${extraNueva.get(k.slice(6))}` : k))
      .filter(Boolean);
    if (ordenFilas.length) {
      await sql`update "ComputoSeccion" set "ordenFilas" = ${ordenFilas} where id = ${nuevaId}`;
    }
  }

  console.log(
    `\nTotal: ${totSecciones} secciones, ${totItems} ítems, ${totExtras} filas extra.`
  );
  console.log(APLICAR ? "Listo." : "Nada escrito. Con --aplicar se escribe.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
