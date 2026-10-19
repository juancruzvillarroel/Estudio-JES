/**
 * Iguala la configuración de los ítems de hierro (ESTRUCTURA_H°A > HIERRO) de
 * todas las obras a como está armado en CONDARCO: unidad ML, con la
 * conversión a kg y a barras de 12 m (ver esHierro en src/lib/computos.ts).
 *
 * En el resto de las obras esos ítems quedaron en KG simple, sin la
 * conversión, así que la columna no muestra barras ni divide por 12 m. Ninguna
 * de esas obras tiene mediciones cargadas en esos ítems todavía (se verificó
 * antes de escribir este script), así que no hay números viejos que una
 * reinterpretación de unidad pueda corromper.
 *
 * Sólo toca los 7 ítems de hierro (Ø6, Ø8, Ø10, Ø12, Ø16, Ø20, Ø25) de la
 * sección HIERRO del rubro ESTRUCTURA_H°A. No crea ítems nuevos: si una obra
 * no tiene alguno de esos diámetros, lo deja afuera y lo avisa.
 *
 *   node scripts/igualar-hierro-a-condarco.js            (muestra qué haría)
 *   node scripts/igualar-hierro-a-condarco.js --aplicar  (lo hace)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ quiet: true });
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const condarco = await sql`select id from "Proyecto" where nombre = 'CONDARCO'`;
  if (condarco.length === 0) throw new Error("No existe CONDARCO.");
  const condarcoId = condarco[0].id;

  const base = await sql`
    select i.nombre, i.unidad, i.rinde, i."rindeUnidad", i."porBulto", i."bultoNombre"
    from "ComputoItem" i
    join "Rubro" r on r.id = i."rubroId"
    left join "ComputoSeccion" s on s.id = i."seccionId"
    where i."proyectoId" = ${condarcoId} and r.nombre = 'ESTRUCTURA_H°A' and s.nombre = 'HIERRO'
    order by i.nombre`;

  console.log(`Base (CONDARCO): ${base.length} ítems de hierro.`);
  console.log(APLICAR ? "\n>> APLICANDO\n" : "\n>> SIMULACRO (falta --aplicar)\n");

  const destinos = await sql`
    select id, nombre from "Proyecto" where id <> ${condarcoId} order by nombre`;

  for (const destino of destinos) {
    const items = await sql`
      select i.id, i.nombre, i.unidad, i.rinde, i."rindeUnidad", i."porBulto", i."bultoNombre"
      from "ComputoItem" i
      join "Rubro" r on r.id = i."rubroId"
      left join "ComputoSeccion" s on s.id = i."seccionId"
      where i."proyectoId" = ${destino.id} and r.nombre = 'ESTRUCTURA_H°A' and s.nombre = 'HIERRO'`;
    const porNombre = new Map(items.map((i) => [i.nombre, i]));

    let cambios = 0;
    let yaIguales = 0;
    let faltantes = 0;

    for (const b of base) {
      const actual = porNombre.get(b.nombre);
      if (!actual) {
        faltantes++;
        continue;
      }
      const igual =
        actual.unidad === b.unidad &&
        String(actual.rinde) === String(b.rinde) &&
        actual.rindeUnidad === b.rindeUnidad &&
        String(actual.porBulto) === String(b.porBulto) &&
        (actual.bultoNombre ?? null) === (b.bultoNombre ?? null);
      if (igual) {
        yaIguales++;
        continue;
      }
      cambios++;
      if (APLICAR) {
        await sql`
          update "ComputoItem"
          set unidad = ${b.unidad}::"UnidadComputo",
              rinde = ${b.rinde},
              "rindeUnidad" = ${b.rindeUnidad}::"UnidadComputo",
              "porBulto" = ${b.porBulto},
              "bultoNombre" = ${b.bultoNombre},
              "updatedAt" = now()
          where id = ${actual.id}`;
      }
    }

    console.log(
      `${destino.nombre.padEnd(18)} cambios=${String(cambios).padStart(2)}` +
        `  ya_iguales=${String(yaIguales).padStart(2)}` +
        `  sin_ese_item=${String(faltantes).padStart(2)}`
    );
  }

  console.log(APLICAR ? "\nListo." : "\nNada escrito. Con --aplicar se escribe.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
