/**
 * Mueve el cómputo de GRIFERÍAS de "Instalación de gas y sanitaria" a
 * "Artefactos y griferías", en todas las obras.
 *
 * La sección vivía en el rubro equivocado: la grifería se compra y se instala
 * junto con los artefactos (inodoros, bachas...), no junto con los caños. El
 * traslado es sólo de rubro —las secciones, los ítems y todas sus mediciones
 * quedan intactas, con el mismo id— así que no se pierde nada de lo ya medido.
 *
 * Toca dos tablas por cada sección GRIFERÍAS encontrada:
 *   - ComputoSeccion.rubroId
 *   - ComputoItem.rubroId   (de todos los ítems de esa sección: es un campo
 *     duplicado a mano en el ítem, no se arrastra solo al mover la sección)
 *
 * Es idempotente: el where busca secciones que TODAVÍA estén en el rubro
 * viejo, así que correrlo de nuevo después de aplicado no encuentra nada y no
 * hace nada.
 *
 *   node scripts/mover-griferias-a-artefactos.js            (muestra qué haría)
 *   node scripts/mover-griferias-a-artefactos.js --aplicar  (lo hace)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ quiet: true });
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const RUBRO_ORIGEN = "cmralcfbu0006w0mcxpm90xd9"; // Instalación de gas y sanitaria
const RUBRO_DESTINO = "cms6997h90000homcjnc1a3b2"; // Artefactos y griferías
const NOMBRE_SECCION = "GRIFERÍAS";
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const [origen] = await sql`select nombre from "Rubro" where id = ${RUBRO_ORIGEN}`;
  const [destino] = await sql`select nombre from "Rubro" where id = ${RUBRO_DESTINO}`;
  if (!origen) throw new Error("No existe el rubro de origen.");
  if (!destino) throw new Error("No existe el rubro de destino.");

  const secciones = await sql`
    select id, "proyectoId", tipo
    from "ComputoSeccion"
    where "rubroId" = ${RUBRO_ORIGEN} and nombre = ${NOMBRE_SECCION}
    order by "proyectoId"`;

  console.log(`${origen.nombre} -> ${destino.nombre}`);
  console.log(`${secciones.length} secciones "${NOMBRE_SECCION}" para mover.`);
  console.log(APLICAR ? "\n>> APLICANDO\n" : "\n>> SIMULACRO (falta --aplicar)\n");

  if (secciones.length === 0) {
    console.log("Nada para mover: ya están todas en el rubro de destino.");
    return;
  }

  let totalItems = 0;
  for (const seccion of secciones) {
    // El unique (proyectoId, rubroId, tipo, nombre) tiene que seguir dando una
    // sola fila después del cambio: si en esa obra ya hubiera una sección
    // GRIFERÍAS en el rubro de destino con el mismo tipo, mover ésta chocaría.
    // Se verificó a mano que hoy no hay ningún caso así, pero el script lo
    // vuelve a chequear por si algo cambió entre la simulación y el aplicar.
    const [choca] = await sql`
      select id from "ComputoSeccion"
      where "proyectoId" = ${seccion.proyectoId} and "rubroId" = ${RUBRO_DESTINO}
        and tipo = ${seccion.tipo}::"TipoComputo" and nombre = ${NOMBRE_SECCION}`;
    if (choca) {
      console.log(
        `  ${seccion.proyectoId}: YA HAY una sección GRIFERÍAS en el destino (${choca.id}) — se omite, hace falta mirarla a mano.`
      );
      continue;
    }

    const items = await sql`
      select count(*)::int as n from "ComputoItem" where "seccionId" = ${seccion.id}`;
    const nItems = items[0].n;
    totalItems += nItems;
    console.log(`  ${seccion.proyectoId}: sección ${seccion.id} (${nItems} ítems)`);

    if (!APLICAR) continue;

    await sql`
      update "ComputoSeccion" set "rubroId" = ${RUBRO_DESTINO} where id = ${seccion.id}`;
    await sql`
      update "ComputoItem" set "rubroId" = ${RUBRO_DESTINO} where "seccionId" = ${seccion.id}`;
  }

  console.log(`\nTotal: ${secciones.length} secciones, ${totalItems} ítems.`);
  console.log(APLICAR ? "\nListo." : "\nNada escrito. Con --aplicar se escribe.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
