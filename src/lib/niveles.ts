/**
 * Los niveles de una obra: "PLANTA BAJA", "PLANTA TIPO", "4TO PISO", "AZOTEA".
 *
 * Se cargan a mano, obra por obra, desde "Editar datos" en la portada del
 * proyecto. No se generan a partir de la cantidad de pisos porque los niveles
 * reales no salen de contar: "planta tipo" son cuatro pisos iguales que se
 * computan una sola vez, un subsuelo no es un piso más, y el nombre con el que
 * se los llama en la obra es el que tiene que salir impreso.
 *
 * Viven acá y no en lib/computos.ts porque son un dato del proyecto, no del
 * cómputo, aunque hoy el único que los lee sea el cómputo (una línea por nivel
 * adentro de cada ítem).
 */

export type NivelOpcion = {
  id: string;
  proyectoId: string;
  nombre: string;
  orden: number;
};

/** Cómo se titula el grupo de las filas que no son de ninguna planta. */
export const SIN_NIVEL = "Toda la obra";

export function mapNivel(n: {
  id: string;
  proyectoId: string;
  nombre: string;
  orden: number;
}): NivelOpcion {
  return { id: n.id, proyectoId: n.proyectoId, nombre: n.nombre, orden: n.orden };
}
