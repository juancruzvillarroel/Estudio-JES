/**
 * Copia la base de cómputos de una obra a todas las demás.
 *
 * Copia la ESTRUCTURA y nada más: las secciones de cada rubro, sus ítems con la
 * unidad, el desperdicio y la conversión a material, y las filas extra. No copia
 * ninguna medición: los números son de la obra que los midió.
 *
 * Tampoco copia `ordenFilas`, que guarda el orden de las filas como ids de los
 * niveles de ESA obra ("nivel:cmucs4z9w..."). Pegados en otra obra apuntarían a
 * niveles que no existen y el orden se leería como basura. Sin ese campo cada
 * obra ordena por sus propios niveles, que es lo correcto.
 *
 * Es idempotente: se puede correr de nuevo sin duplicar nada. Lo que ya está no
 * se toca —ni se pisa el nombre, ni el desperdicio, ni nada—, sólo se agrega lo
 * que falta. Correrlo dos veces y correrlo una vez dan el mismo resultado.
 *
 *   node scripts/copiar-base-computos.js            (muestra qué haría)
 *   node scripts/copiar-base-computos.js --aplicar  (lo hace)
 */

// CommonJS a propósito: esto se corre con `node` pelado, sin pasar por el build
// de Next, así que no hay quien resuelva los imports ESM del proyecto.
/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ quiet: true });
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const ORIGEN = "cmrasdgap0004wsmcwqc773bk"; // ARGERICH
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const origen = await sql`select nombre from "Proyecto" where id = ${ORIGEN}`;
  if (origen.length === 0) throw new Error("No existe el proyecto de origen.");

  const destinos = await sql`
    select id, nombre from "Proyecto" where id <> ${ORIGEN} order by nombre`;

  const secciones = await sql`
    select id, "rubroId", tipo, nombre, orden
    from "ComputoSeccion" where "proyectoId" = ${ORIGEN} order by orden`;

  const items = await sql`
    select "seccionId", "rubroId", nombre, unidad, desperdicio,
           rinde, "rindeUnidad", "porBulto", "bultoNombre", orden
    from "ComputoItem" where "proyectoId" = ${ORIGEN} order by orden`;

  const extras = await sql`
    select f."seccionId", f.nombre, f.orden
    from "ComputoFilaExtra" f
    join "ComputoSeccion" s on s.id = f."seccionId"
    where s."proyectoId" = ${ORIGEN}`;

  console.log(
    `Base de ${origen[0].nombre}: ${secciones.length} secciones, ` +
      `${items.length} ítems, ${extras.length} filas extra.`
  );
  console.log(`Destinos: ${destinos.length} obras.`);
  console.log(APLICAR ? "\n>> APLICANDO\n" : "\n>> SIMULACRO (falta --aplicar)\n");

  for (const destino of destinos) {
    let nuevasSecciones = 0;
    let nuevosItems = 0;
    let nuevasExtras = 0;

    for (const seccion of secciones) {
      // El unique (proyectoId, rubroId, tipo, nombre) es lo que hace que esto
      // se pueda repetir sin pensar: si la sección ya está, no pasa nada.
      // El conteo se hace ANTES de insertar. Preguntar después siempre daría
      // "ya estaba", porque la acabamos de crear nosotros.
      const yaEstaba = await sql`
        select id from "ComputoSeccion"
        where "proyectoId" = ${destino.id} and "rubroId" = ${seccion.rubroId}
          and tipo = ${seccion.tipo}::"TipoComputo" and nombre = ${seccion.nombre}`;
      if (yaEstaba.length === 0) nuevasSecciones++;

      let destinoSeccionId = yaEstaba[0]?.id;
      if (APLICAR && !destinoSeccionId) {
        const creada = await sql`
          insert into "ComputoSeccion" ("id", "proyectoId", "rubroId", tipo, nombre, orden)
          values (gen_random_uuid()::text, ${destino.id}, ${seccion.rubroId},
                  ${seccion.tipo}::"TipoComputo", ${seccion.nombre}, ${seccion.orden})
          on conflict ("proyectoId", "rubroId", tipo, nombre) do nothing
          returning id`;
        destinoSeccionId = creada[0]?.id;
      }
      if (APLICAR && !destinoSeccionId) continue;

      // ComputoItem no tiene unique por nombre —dos ítems pueden llamarse igual
      // si el usuario quiere—, así que acá el "no dupliques" lo pone el where.
      for (const item of items.filter((i) => i.seccionId === seccion.id)) {
        if (!APLICAR) {
          nuevosItems++;
          continue;
        }
        const res = await sql`
          insert into "ComputoItem"
            ("id", "proyectoId", "rubroId", "seccionId", nombre, unidad,
             desperdicio, rinde, "rindeUnidad", "porBulto", "bultoNombre",
             orden, "updatedAt")
          select gen_random_uuid()::text, ${destino.id}, ${item.rubroId},
                 ${destinoSeccionId}, ${item.nombre}, ${item.unidad}::"UnidadComputo",
                 ${item.desperdicio}, ${item.rinde},
                 ${item.rindeUnidad}::"UnidadComputo", ${item.porBulto},
                 ${item.bultoNombre}, ${item.orden}, now()
          where not exists (
            select 1 from "ComputoItem"
            where "seccionId" = ${destinoSeccionId} and nombre = ${item.nombre})
          returning id`;
        nuevosItems += res.length;
      }

      for (const extra of extras.filter((e) => e.seccionId === seccion.id)) {
        if (!APLICAR) {
          nuevasExtras++;
          continue;
        }
        const res = await sql`
          insert into "ComputoFilaExtra" ("id", "seccionId", nombre, orden)
          values (gen_random_uuid()::text, ${destinoSeccionId}, ${extra.nombre}, ${extra.orden})
          on conflict ("seccionId", nombre) do nothing
          returning id`;
        nuevasExtras += res.length;
      }
    }

    console.log(
      `${destino.nombre.padEnd(18)} +${String(nuevasSecciones).padStart(3)} secciones` +
        `  +${String(nuevosItems).padStart(4)} ítems` +
        `  +${String(nuevasExtras).padStart(2)} filas extra`
    );
  }

  console.log(APLICAR ? "\nListo." : "\nNada escrito. Con --aplicar se escribe.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
