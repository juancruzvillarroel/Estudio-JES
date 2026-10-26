/**
 * Cómputo de una obra: qué se va a hacer, qué hace falta comprar, y cuánto.
 *
 * Se organiza como lo organiza el estudio: rubro → materiales o mano de obra →
 * sección → ítems. La sección es la parte de la obra (MUROS, REVOQUES,
 * CONTRAPISOS adentro de ALBAÑILERÍA) y se arma a mano, obra por obra. Adentro,
 * cada ítem es una columna de una grilla cuyas filas son los niveles: la obra se
 * mide, se contrata y se paga por planta, así que el cómputo se lee igual.
 *
 * Materiales y mano de obra son dos cómputos separados, con sus propias
 * secciones y sus propios totales, porque no se mide lo mismo de los dos lados:
 * del material salen m³ de hormigón y kilos de hierro, y del trabajo salen m² de
 * encofrado y jornales. Se contratan aparte, se cotizan aparte y se pagan
 * aparte, así que mezclarlos en una sola grilla obligaría a que cada ítem
 * aclare de qué lado está, que es la misma división pero peor contada.
 *
 * La idea central es la misma que en el presupuesto: los totales no se cargan
 * ni se guardan, se derivan. Un ítem ("Contrapiso", en m²) vale lo que suman
 * sus filas, y cada fila vale la cantidad por las dimensiones que su unidad
 * pida. Eso es lo que separa esto de una planilla: no hay ninguna celda con un
 * número escrito a mano que pueda no coincidir con las filas que tiene arriba.
 *
 * Hay dos clases de fila y las dos suman al mismo total:
 *
 *   MEDIDA    "Living — 1 × 5,20 × 4,30"          → origenId en null
 *   DERIVADA  "de Mampostería × 15 ladrillos +5%" → origenId apunta a otro ítem
 *
 * La derivada es la segunda etapa: el material no se vuelve a medir, se calcula
 * sobre lo ya computado. Como un mismo material puede venir de varios trabajos
 * (el cemento sale de la mampostería, del revoque y del contrapiso), cada
 * origen es su propia fila y el total se suma solo.
 *
 * La otra decisión de fondo es que la unidad manda. No es una etiqueta al lado
 * del número: define qué se le pide al usuario y cómo se calcula. Por eso es un
 * enum cerrado y por eso vive acá la tabla que dice, para cada unidad, qué
 * dimensiones tienen sentido (ver UNIDAD_INFO).
 */

import { SIN_NIVEL, type NivelOpcion } from "@/lib/niveles";

/** Unidad en la que se mide un ítem. Espeja el enum del esquema. */
export type UnidadComputo = "M2" | "M3" | "ML" | "UN" | "KG" | "GLOBAL";

export const UNIDADES: UnidadComputo[] = ["M2", "M3", "ML", "UN", "KG", "GLOBAL"];

/**
 * Qué dimensiones pide cada unidad y cómo se lee el resultado.
 *
 * `dimensiones` es la lista de campos que la pantalla muestra al cargar una
 * fila medida, en orden, y a la vez los factores que multiplican a la cantidad.
 * Una unidad sin dimensiones (UN, KG, GLOBAL) se computa contando: el parcial
 * es la cantidad y nada más.
 *
 * `simbolo` es cómo se escribe la unidad en pantalla, que no siempre es la
 * clave: la clave es M2 porque un enum no lleva superíndices, pero lo que se
 * lee tiene que ser m².
 */
export type DimensionComputo = "largo" | "ancho" | "alto";

export const UNIDAD_INFO: Record<
  UnidadComputo,
  { simbolo: string; nombre: string; dimensiones: DimensionComputo[]; ayuda: string }
> = {
  M2: {
    simbolo: "m²",
    nombre: "Metros cuadrados",
    dimensiones: ["largo", "ancho"],
    ayuda: "Superficies: contrapisos, revoques, pisos, pintura.",
  },
  M3: {
    simbolo: "m³",
    nombre: "Metros cúbicos",
    dimensiones: ["largo", "ancho", "alto"],
    ayuda: "Volúmenes: hormigón, excavación, relleno.",
  },
  ML: {
    simbolo: "ml",
    nombre: "Metros lineales",
    dimensiones: ["largo"],
    ayuda: "Corridas: zócalos, cañerías, cordones, vigas.",
  },
  UN: {
    simbolo: "un",
    nombre: "Unidades",
    dimensiones: [],
    ayuda: "Lo que se cuenta: aberturas, artefactos, ladrillos, bolsas.",
  },
  KG: {
    simbolo: "kg",
    nombre: "Kilogramos",
    dimensiones: [],
    ayuda: "Lo que se pesa: hierro, perfilería.",
  },
  GLOBAL: {
    simbolo: "gl",
    nombre: "Global",
    dimensiones: [],
    ayuda: "Lo que va entero y no se mide: cartel de obra, conexiones.",
  },
};

/** Cómo se escribe la unidad en pantalla ("m²", "ml", …). */
export function simboloUnidad(unidad: UnidadComputo) {
  return UNIDAD_INFO[unidad].simbolo;
}

/** Qué dimensiones se le piden a una fila medida de esta unidad. */
export function dimensionesDe(unidad: UnidadComputo) {
  return UNIDAD_INFO[unidad].dimensiones;
}

/** Las filas de un ítem que caen en un mismo nivel. */
export type GrupoNivel = {
  /** Null es el grupo de las filas que no son de ninguna planta. */
  id: string | null;
  nombre: string;
  mediciones: MedicionOpcion[];
};

/**
 * Parte las filas de un ítem en los niveles de la obra.
 *
 * Devuelve TODOS los niveles cargados, incluso los que todavía no tienen nada.
 * Un nivel vacío no es ruido: es lo que falta computar, y verlo listado es la
 * mitad de la revisión del cómputo. Quien no lo quiera mostrar (el informe
 * impreso) filtra por su cuenta.
 *
 * Al final va siempre "Toda la obra", que junta lo que no es de ninguna planta
 * (la excavación, el cerco) y las filas derivadas, que salen del total de otro
 * ítem y ese total ya cruza los niveles.
 *
 * No hay grupo de huérfanos: el nivel es una clave foránea con Restrict, así
 * que una fila nunca puede quedar apuntando a un nivel que no existe.
 *
 * PENDIENTE: lo medido en una fila extra de la sección (ver ComputoFilaExtra)
 * cae acá en "Toda la obra". El total impreso sigue dando bien, pero la fila
 * pierde su nombre. Se arregla cuando se rehaga el informe, que hoy todavía
 * agrupa por subrubro y no por sección.
 */
export function agruparPorNivel(
  mediciones: MedicionOpcion[],
  niveles: NivelOpcion[]
): GrupoNivel[] {
  return [
    ...niveles.map((n) => ({
      id: n.id,
      nombre: n.nombre,
      mediciones: mediciones.filter((m) => m.nivelId === n.id),
    })),
    {
      id: null,
      nombre: SIN_NIVEL,
      mediciones: mediciones.filter((m) => m.nivelId === null),
    },
  ];
}

/**
 * De qué lado de la obra es un cómputo: lo que se compra, o lo que se paga por
 * hacerlo. Espeja el enum del esquema.
 */
export type TipoComputo = "MATERIALES" | "MANO_DE_OBRA";

/**
 * Los dos lados, en el orden en que se muestran.
 *
 * MATERIALES va primero porque es con lo que se arranca a computar: el material
 * se saca de los planos y la mano de obra se arma después, sabiendo ya qué hay
 * que poner.
 */
export const TIPOS_COMPUTO: TipoComputo[] = ["MATERIALES", "MANO_DE_OBRA"];

/** Cómo se lee cada lado en pantalla ("MANO_DE_OBRA" no se le muestra a nadie). */
export const TIPO_COMPUTO_LABEL: Record<TipoComputo, string> = {
  MATERIALES: "Materiales",
  MANO_DE_OBRA: "Mano de obra",
};

/**
 * Cuándo se tocó por última vez un número del cómputo de un rubro y lado en
 * una obra (ver ComputoFecha en el esquema). Una por rubro y lado: no hay
 * fila para el rubro que todavía no se empezó a cargar.
 */
export type FechaComputoOpcion = {
  proyectoId: string;
  rubroId: string;
  tipo: TipoComputo;
  modificadoEl: Date;
};

export function mapFechaComputo(f: {
  proyectoId: string;
  rubroId: string;
  tipo: string;
  modificadoEl: Date;
}): FechaComputoOpcion {
  return {
    proyectoId: f.proyectoId,
    rubroId: f.rubroId,
    tipo: f.tipo as TipoComputo,
    modificadoEl: f.modificadoEl,
  };
}

/**
 * La fecha de modificación de un rubro y lado puntual, o null si ese cómputo
 * todavía no tiene nada tocado.
 */
export function fechaDeComputo(
  fechas: FechaComputoOpcion[],
  rubroId: string,
  tipo: TipoComputo
): Date | null {
  return (
    fechas.find((f) => f.rubroId === rubroId && f.tipo === tipo)?.modificadoEl ?? null
  );
}

/** Cómo se muestra arriba a la derecha de una grilla: "Modificado el 6/10/2026". */
export function formatFechaModificacion(fecha: Date | null): string {
  if (!fecha) return "Sin modificaciones";
  return `Modificado el ${fecha.toLocaleDateString("es-AR")}`;
}

/**
 * Una sección del cómputo: MUROS, REVOQUES, CONTRAPISOS adentro de ALBAÑILERÍA.
 *
 * Es la grilla que se ve en pantalla. Las filas son los niveles de la obra y
 * las columnas son sus ítems, así que la sección es la unidad de trabajo: se
 * crea una, se le cargan las columnas que lleva, y se completa de abajo hacia
 * arriba.
 *
 * Cada sección vive de un solo lado del switch. El mismo nombre puede repetirse
 * del otro lado —HORMIGÓN de material y HORMIGÓN de mano de obra son dos
 * grillas distintas— y por eso el tipo entra en la identidad de la sección y no
 * es una etiqueta suelta.
 */
export type SeccionOpcion = {
  id: string;
  proyectoId: string;
  rubroId: string;
  tipo: TipoComputo;
  nombre: string;
  orden: number;
  /** El orden en que se leen sus filas. Vacío = el de la obra. Ver ordenarFilas. */
  ordenFilas: string[];
};

export function mapSeccion(s: {
  id: string;
  proyectoId: string;
  rubroId: string;
  tipo: string;
  nombre: string;
  orden: number;
  ordenFilas: string[];
}): SeccionOpcion {
  return {
    id: s.id,
    proyectoId: s.proyectoId,
    rubroId: s.rubroId,
    tipo: s.tipo as TipoComputo,
    nombre: s.nombre,
    orden: s.orden,
    ordenFilas: s.ordenFilas,
  };
}

/**
 * Una fila extra de una sección: "SALA DE MÁQUINAS" adentro de MUROS.
 *
 * Los niveles son de la obra entera y aparecen en todas las grillas. Esto es lo
 * otro: el caso puntual que existe en una sección y en ninguna más, para no
 * llenar de filas siempre vacías a las demás.
 */
export type FilaExtraOpcion = {
  id: string;
  seccionId: string;
  nombre: string;
  orden: number;
};

export function mapFilaExtra(f: {
  id: string;
  seccionId: string;
  nombre: string;
  orden: number;
}): FilaExtraOpcion {
  return { id: f.id, seccionId: f.seccionId, nombre: f.nombre, orden: f.orden };
}

/**
 * Cuál de las filas de la grilla es una celda.
 *
 * Son tres clases y ninguna se confunde con las otras: un nivel de la obra, una
 * fila extra de esa sección, o "toda la obra" (lo que no es de ninguna planta).
 * Se modela como una unión y no como un par de ids nullables para que sea
 * imposible construir una celda que apunte a un nivel y a una fila extra a la
 * vez, que en la base es justamente lo que no puede pasar.
 */
export type ClaveFila =
  | { tipo: "nivel"; id: string }
  | { tipo: "extra"; id: string }
  | { tipo: "general" };

/**
 * La identidad de una fila como texto: "nivel:abc", "extra:def", "general".
 *
 * Sirve de `key` de React y, sobre todo, es lo que se guarda en
 * ComputoSeccion.ordenFilas. Tiene que decir de qué clase es la fila y no sólo
 * cuál: un nivel y una fila extra podrían tener el mismo id y mezclarlas en una
 * sola lista las confundiría.
 */
export function claveFilaKey(clave: ClaveFila) {
  return clave.tipo === "general" ? "general" : `${clave.tipo}:${clave.id}`;
}

/**
 * Las filas de una grilla en el orden en que se leen.
 *
 * `ordenFilas` es lo que se arrastró en ESA sección. Lo que está ahí va
 * primero, en ese orden; lo que no —un nivel creado después, una fila que nunca
 * se movió— cae atrás conservando el orden natural, que es donde uno busca lo
 * recién agregado.
 *
 * "Toda la obra" queda siempre última y no se arrastra: no es una planta, es el
 * resto, y en el medio de las plantas no significaría nada.
 */
export function ordenarFilas<T extends { clave: ClaveFila }>(
  filas: T[],
  ordenFilas: string[]
): T[] {
  const posicion = new Map(ordenFilas.map((clave, i) => [clave, i]));
  const rango = (f: T) =>
    f.clave.tipo === "general"
      ? Number.MAX_SAFE_INTEGER
      : (posicion.get(claveFilaKey(f.clave)) ?? Number.MAX_SAFE_INTEGER - 1);

  // Ordenamiento estable: las que empatan en el fondo (las que no se movieron
  // nunca) se quedan como venían, que ya es el orden de la obra.
  return filas
    .map((fila, i) => ({ fila, i }))
    .sort((a, b) => rango(a.fila) - rango(b.fila) || a.i - b.i)
    .map(({ fila }) => fila);
}

/** ¿Esta medida cae en esta fila de la grilla? */
function esDeLaFila(medicion: MedicionOpcion, fila: ClaveFila) {
  if (fila.tipo === "nivel") return medicion.nivelId === fila.id;
  if (fila.tipo === "extra") return medicion.filaExtraId === fila.id;
  return medicion.nivelId === null && medicion.filaExtraId === null;
}

/**
 * Lo que tiene medido un ítem en una fila: el valor de una celda de la grilla.
 *
 * Suma todas las filas del ítem que caen ahí, y no una sola, porque el modelo
 * permite varias: hoy la grilla escribe una por celda, pero el detalle por
 * ambiente (tres renglones adentro de "4° piso") es la puerta que queda
 * abierta, y si se abre el total de la celda tiene que seguir siendo el mismo
 * número.
 */
/**
 * ¿Este ítem tiene algo cargado en esta fila?
 *
 * Va aparte del total porque cero y vacío no son lo mismo: una celda sin nada
 * se lee "—" y una medida que dio cero se lee "0". Sumar y comparar contra cero
 * los confundiría, y perder esa diferencia es perder justo el dato de qué falta
 * computar.
 */
export function tieneMedidoEnFila(item: ItemOpcion, fila: ClaveFila) {
  return item.mediciones.some((m) => esDeLaFila(m, fila));
}

/**
 * Los renglones que hay detrás de una celda: el detalle que se despliega.
 *
 * Una celda con un número suelto tiene uno; una desglosada ("Base B1", "Base
 * B2", "Base B3") tiene varios y su número es la suma. Es la misma lista en los
 * dos casos, así que la pantalla no tiene que tratarlos distinto.
 */
export function medicionesDeFila(item: ItemOpcion, fila: ClaveFila) {
  return item.mediciones.filter((m) => esDeLaFila(m, fila));
}

/**
 * ¿La celda sale de una cuenta sobre otro ítem?
 *
 * Esas no se escriben a mano ni se desglosan: el número viene de otro lado y
 * pisarlo borraría la cuenta sin que se vea.
 */
export function esDerivadaEnFila(item: ItemOpcion, fila: ClaveFila) {
  return medicionesDeFila(item, fila).some((m) => m.origenId !== null);
}

export function medidoEnFila(
  item: ItemOpcion,
  fila: ClaveFila,
  totales?: Map<string, number>
) {
  return item.mediciones
    .filter((m) => esDeLaFila(m, fila))
    .reduce(
      (acc, m) =>
        acc +
        parcialMedicion(m, item.unidad, m.origenId ? (totales?.get(m.origenId) ?? 0) : 0),
      0
    );
}

/**
 * Lo medido más la merma: 1.240 ladrillos con 10% de desperdicio son 1.364.
 *
 * Sin desperdicio cargado devuelve lo medido tal cual. Es la segunda columna de
 * cada ítem en la grilla, y es lo que se manda a cotizar: al proveedor se le
 * pide lo que hay que comprar, no lo que entra en la pared.
 */
export function conDesperdicio(medido: number, desperdicio: number | null) {
  if (desperdicio === null) return medido;
  return medido * (1 + desperdicio / 100);
}

/**
 * La conversión a material de un ítem, ya validada, o null si no tiene.
 *
 * Devuelve los campos angostados y no un booleano para que haya una sola
 * definición de "este ítem convierte". La grilla la usa dos veces por ítem —una
 * para contar columnas y otra para dibujarlas— y si cada una decidiera por su
 * cuenta, un dato raro en la base podría hacer que no coincidan y la tabla
 * saldría con las celdas corridas.
 */
export function conversionDe(item: {
  rinde: number | null;
  rindeUnidad: UnidadComputo | null;
}): { rinde: number; unidad: UnidadComputo } | null {
  if (item.rinde === null || item.rinde <= 0 || item.rindeUnidad === null) return null;
  return { rinde: item.rinde, unidad: item.rindeUnidad };
}

/** ¿Este ítem se mide en una unidad y se compra en otra? */
export function convierte(item: {
  rinde: number | null;
  rindeUnidad: UnidadComputo | null;
}) {
  return conversionDe(item) !== null;
}

/**
 * ¿Este ítem, además de convertirse a material, se compra agrupado en
 * bultos (palets, bolsas, barras...)? Hace falta `rinde` para saber cuánto
 * material hay, y `porBulto` para saber cuánto trae cada uno: sin lo primero
 * lo segundo no tiene con qué dividir.
 *
 * Vive acá y no en la grilla porque el pie de la tabla y la hoja de
 * presupuesto tienen que decidir lo mismo: si una redondeara a bultos y la
 * otra no, los dos papeles pedirían cantidades distintas del mismo ítem.
 */
export function tieneBultos(item: {
  porBulto: number | null;
  rinde: number | null;
  rindeUnidad: UnidadComputo | null;
}) {
  return item.porBulto !== null && conversionDe(item) !== null;
}

/**
 * Lo medido, leído en la unidad en la que se compra.
 *
 * Una pared se mide en metros pero se pide en ladrillos: 42 m de pared a 15
 * ladrillos el metro son 630 ladrillos. Es la tercera columna del ítem.
 *
 * La cuenta arranca de lo medido CON la merma y no de lo medido a secas. El
 * número sirve para pedir, y lo que se pide tiene que incluir lo que se rompe:
 * si el ítem lleva 10% y se convirtiera sobre el medido pelado, el pedido
 * saldría corto justo por la cantidad que ya sabíamos que se iba a romper. Con
 * la merma en 0 o sin cargar las dos cuentas dan lo mismo, así que esto sólo
 * cambia algo donde efectivamente hay desperdicio declarado.
 *
 * Devuelve null si el ítem no convierte, que es distinto de devolver 0: 0 sería
 * "no entra ningún ladrillo".
 */
export function materialDe(
  item: {
    desperdicio: number | null;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
  },
  medido: number
) {
  const conversion = conversionDe(item);
  if (!conversion) return null;
  return conDesperdicio(medido, item.desperdicio) * conversion.rinde;
}

/**
 * Cuántos bultos hay que pedir para cubrir esa cantidad de material.
 *
 * Redondea para arriba porque un palet no se parte: 1.240 ladrillos con 198 por
 * palet son 6,26 palets, y al corralón se le piden 7. Junto con el entero
 * devuelve el exacto, que es lo que dice cuánto va a sobrar del último —6,26
 * quiere decir que sobran tres cuartos de palet, y eso a veces cambia la
 * decisión de cuántos pedir—.
 *
 * Por eso mismo esto vive sólo en la fila del total y no en cada nivel: los
 * palets se compran una vez para toda la obra. Redondear para arriba planta por
 * planta y después sumar daría de más, una vez por planta.
 */
export function bultosDe(
  item: { porBulto: number | null },
  material: number | null
) {
  if (material === null || item.porBulto === null || item.porBulto <= 0) return null;
  const exacto = material / item.porBulto;
  return { exacto, enteros: Math.ceil(exacto - 0.0000001) };
}

/**
 * Cómo se titula la fila de bultos de una grilla: "palets", "bolsas", "bultos".
 *
 * Sale del nombre que cada ítem tenga cargado y no de una constante, porque una
 * grilla puede pedir palets y otra bolsas. Si todos dicen lo mismo se usa ese
 * nombre; si hay dos distintos se cae a "bultos", que es feo pero no es mentira:
 * poner "bolsas" arriba de una cantidad de palets sí se copia mal a una orden de
 * compra.
 *
 * La comparación ignora mayúsculas y espacios de más —"Palet" y "palet " son el
 * mismo palet— para que un tipeo no tire la fila entera a "bultos".
 *
 * Vive acá y no en cada pantalla porque la grilla y el PDF tienen que titular
 * igual: si no, el papel y la pantalla dicen cosas distintas del mismo número.
 */
export function etiquetaBultos(items: { bultoNombre: string | null }[]) {
  const nombres = new Set(
    items.map((i) => (i.bultoNombre ?? "bulto").trim().toLowerCase())
  );
  const nombre = nombres.size === 1 ? [...nombres][0] : "bulto";
  return nombre.endsWith("s") ? nombre : `${nombre}s`;
}

/**
 * La cantidad que efectivamente se pide de este ítem, con su unidad.
 *
 * Es la misma decisión que toma el pie de la grilla, puesta en un solo
 * lugar: si se compra agrupado, los bultos ya redondeados para arriba; si
 * no pero se convierte a otra unidad, el material ya convertido (que ya
 * lleva la merma adentro); si no convierte, lo medido con la merma puesta.
 * Un ítem sin ninguna de las dos cosas pide lo mismo que mide.
 *
 * Centralizarla es lo que hace que la hoja de presupuesto pida exactamente
 * lo que la grilla dice en su columna de total: dos cuentas por separado
 * para el mismo número son dos lugares donde se pueden desacompasar.
 */
export function cantidadFinalCompra(
  item: {
    unidad: UnidadComputo;
    desperdicio: number | null;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
    porBulto: number | null;
    bultoNombre: string | null;
  },
  total: number
): { cantidad: number; unidad: string } {
  if (tieneBultos(item)) {
    const bultos = bultosDe(item, materialDe(item, total));
    return { cantidad: bultos?.enteros ?? 0, unidad: etiquetaBultos([item]) };
  }
  const conversion = conversionDe(item);
  if (conversion) {
    return {
      cantidad: materialDe(item, total) ?? 0,
      unidad: simboloUnidad(conversion.unidad),
    };
  }
  return {
    cantidad: conDesperdicio(total, item.desperdicio),
    unidad: simboloUnidad(item.unidad),
  };
}

/** Cuánto suma un nivel dentro de su ítem. */
export function subtotalNivel(
  grupo: GrupoNivel,
  unidad: UnidadComputo,
  totales?: Map<string, number>
) {
  return grupo.mediciones.reduce(
    (acc, m) =>
      acc +
      parcialMedicion(m, unidad, m.origenId ? (totales?.get(m.origenId) ?? 0) : 0),
    0
  );
}

export type MedicionOpcion = {
  id: string;
  itemId: string;
  descripcion: string | null;
  /** Nivel de la obra al que pertenece la fila. Null = toda la obra. */
  nivelId: string | null;
  /** Fila extra de la sección, si la medida va en una. Excluyente con nivelId. */
  filaExtraId: string | null;
  cantidad: number;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  deduccion: boolean;
  /** No null = la fila es derivada y `cantidad` es el coeficiente. */
  origenId: string | null;
  /** Porcentaje que se le suma a una fila derivada. Sólo tiene sentido con origen. */
  desperdicio: number | null;
  orden: number;
};

export type ItemOpcion = {
  id: string;
  proyectoId: string;
  rubroId: string;
  /** La sección donde vive: es una columna de esa grilla. */
  seccionId: string | null;
  subrubroId: string | null;
  tipoId: string | null;
  nombre: string;
  unidad: UnidadComputo;
  /** Merma del material, en porcentaje. Null = sin desperdicio. */
  desperdicio: number | null;
  /** Unidades de material por unidad medida. Null = no se convierte. */
  rinde: number | null;
  /** En qué unidad queda la conversión. */
  rindeUnidad: UnidadComputo | null;
  /** Unidades de material por bulto. Null = se compra suelto. */
  porBulto: number | null;
  /** Cómo se llama el bulto: "palet", "bolsa". */
  bultoNombre: string | null;
  /** Marca y modelo, cuando corresponde: "FV Siena blanco". No entra en ninguna cuenta. */
  modelo: string | null;
  notas: string | null;
  orden: number;
  mediciones: MedicionOpcion[];
};

export type ItemTipoOpcion = {
  id: string;
  nombre: string;
  unidad: UnidadComputo;
  rubroId: string;
  subrubroId: string | null;
  orden: number;
};

const aNumero = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function mapMedicion(m: {
  id: string;
  itemId: string;
  descripcion: string | null;
  nivelId: string | null;
  filaExtraId: string | null;
  cantidad: unknown;
  largo: unknown;
  ancho: unknown;
  alto: unknown;
  deduccion: boolean;
  origenId: string | null;
  desperdicio: unknown;
  orden: number;
}): MedicionOpcion {
  return {
    id: m.id,
    itemId: m.itemId,
    descripcion: m.descripcion,
    nivelId: m.nivelId,
    filaExtraId: m.filaExtraId,
    cantidad: Number(m.cantidad),
    largo: aNumero(m.largo),
    ancho: aNumero(m.ancho),
    alto: aNumero(m.alto),
    deduccion: m.deduccion,
    origenId: m.origenId,
    desperdicio: aNumero(m.desperdicio),
    orden: m.orden,
  };
}

export function mapItem(p: {
  id: string;
  proyectoId: string;
  rubroId: string;
  seccionId: string | null;
  subrubroId: string | null;
  tipoId: string | null;
  nombre: string;
  unidad: string;
  desperdicio: unknown;
  rinde?: unknown;
  rindeUnidad?: string | null;
  porBulto?: unknown;
  bultoNombre?: string | null;
  modelo?: string | null;
  notas: string | null;
  orden: number;
  mediciones?: Parameters<typeof mapMedicion>[0][];
}): ItemOpcion {
  return {
    id: p.id,
    proyectoId: p.proyectoId,
    rubroId: p.rubroId,
    seccionId: p.seccionId,
    subrubroId: p.subrubroId,
    tipoId: p.tipoId,
    nombre: p.nombre,
    unidad: p.unidad as UnidadComputo,
    desperdicio: aNumero(p.desperdicio),
    rinde: aNumero(p.rinde),
    rindeUnidad: (p.rindeUnidad as UnidadComputo | null) ?? null,
    porBulto: aNumero(p.porBulto),
    bultoNombre: p.bultoNombre ?? null,
    modelo: p.modelo ?? null,
    notas: p.notas,
    orden: p.orden,
    mediciones: (p.mediciones ?? []).map(mapMedicion),
  };
}

export function mapItemTipo(t: {
  id: string;
  nombre: string;
  unidad: string;
  rubroId: string;
  subrubroId: string | null;
  orden: number;
}): ItemTipoOpcion {
  return {
    id: t.id,
    nombre: t.nombre,
    unidad: t.unidad as UnidadComputo,
    rubroId: t.rubroId,
    subrubroId: t.subrubroId,
    orden: t.orden,
  };
}

/**
 * Cuánto aporta una fila MEDIDA al total de su ítem.
 *
 * Es la cantidad por las dimensiones que la unidad pida. Una dimensión que la
 * unidad pide pero quedó vacía cuenta como 1: así una fila a medio cargar suma
 * algo razonable en vez de anular el parcial entero, y el faltante se ve en la
 * pantalla (la celda vacía) en lugar de esconderse en un cero.
 */
function parcialMedido(medicion: MedicionOpcion, unidad: UnidadComputo) {
  const factores = dimensionesDe(unidad).map((dim) => medicion[dim] ?? 1);
  return factores.reduce((acc, f) => acc * f, medicion.cantidad);
}

/**
 * Cuánto aporta una fila DERIVADA: el total del ítem de origen por el
 * coeficiente, más el desperdicio.
 *
 * 1.240 m² de mampostería × 15 ladrillos/m² + 5% = 19.530 ladrillos.
 */
function parcialDerivado(medicion: MedicionOpcion, totalOrigen: number) {
  const merma = 1 + (medicion.desperdicio ?? 0) / 100;
  return totalOrigen * medicion.cantidad * merma;
}

/**
 * Cuánto aporta una fila al total de su ítem, sea medida o derivada.
 *
 * `deduccion` da vuelta el signo: es la forma de descontar los vanos sin
 * obligar a cargar números negativos.
 */
export function parcialMedicion(
  medicion: MedicionOpcion,
  unidad: UnidadComputo,
  totalOrigen = 0
) {
  const bruto = medicion.origenId
    ? parcialDerivado(medicion, totalOrigen)
    : parcialMedido(medicion, unidad);
  return medicion.deduccion ? -bruto : bruto;
}

/**
 * Los totales de todos los ítems de una obra, de una sola pasada.
 *
 * Hace falta calcularlos juntos porque un ítem puede depender de otro: los
 * ladrillos salen de la mampostería, que a su vez se midió a mano. Se resuelve
 * en profundidad y con memoria, así una cadena larga se recorre una sola vez.
 *
 * El conjunto `enCurso` es la red contra los ciclos. Un ciclo no debería poder
 * crearse (la acción que arma una fila derivada lo valida antes de guardar),
 * pero si existiera, esto devuelve 0 para el tramo que se muerde la cola en vez
 * de colgar la pantalla con una recursión infinita. Preferimos un número que se
 * ve mal a un renglón que no carga.
 */
export function calcularTotales(items: ItemOpcion[]): Map<string, number> {
  const porId = new Map(items.map((i) => [i.id, i]));
  const totales = new Map<string, number>();
  const enCurso = new Set<string>();

  function calcular(id: string): number {
    const listo = totales.get(id);
    if (listo !== undefined) return listo;
    const item = porId.get(id);
    if (!item) return 0;
    if (enCurso.has(id)) return 0;

    enCurso.add(id);
    let suma = 0;
    for (const m of item.mediciones) {
      suma += parcialMedicion(m, item.unidad, m.origenId ? calcular(m.origenId) : 0);
    }
    enCurso.delete(id);

    totales.set(id, suma);
    return suma;
  }

  for (const item of items) calcular(item.id);
  return totales;
}

/**
 * Total de un ítem suelto, cuando no hay nada derivado en juego.
 *
 * Sirve para el caso simple (un ítem medido a mano). Si el ítem tiene filas
 * derivadas hay que usar `calcularTotales`, que conoce al resto.
 */
export function totalItem(item: ItemOpcion) {
  return item.mediciones.reduce((acc, m) => acc + parcialMedicion(m, item.unidad), 0);
}

/**
 * ¿Derivar `item` de `origen` cerraría un círculo?
 *
 * Se camina desde el origen hacia sus propios orígenes: si en algún punto se
 * vuelve al ítem que se quiere alimentar, la cuenta se estaría pidiendo a sí
 * misma. Se corre antes de guardar una fila derivada, del lado del servidor.
 */
export function creaCiclo(items: ItemOpcion[], itemId: string, origenId: string): boolean {
  if (itemId === origenId) return true;
  const porId = new Map(items.map((i) => [i.id, i]));
  const vistos = new Set<string>();
  const pila = [origenId];

  while (pila.length > 0) {
    const actual = pila.pop() as string;
    if (actual === itemId) return true;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    const item = porId.get(actual);
    if (!item) continue;
    for (const m of item.mediciones) {
      if (m.origenId) pila.push(m.origenId);
    }
  }

  return false;
}

/**
 * Formatea una cantidad computada.
 *
 * Hasta dos decimales y sin ceros al final: 148 m² se lee "148", no "148,00",
 * pero 22,36 conserva sus dos decimales. En un cómputo la mayoría de los
 * números da redondo y los decimales de relleno sólo hacen ruido en una tabla
 * de treinta filas.
 */
export function formatCantidad(valor: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor);
}

/** Cantidad con su unidad al lado, que es como se lee el total de un ítem. */
export function formatCantidadUnidad(valor: number, unidad: UnidadComputo) {
  return `${formatCantidad(valor)} ${simboloUnidad(unidad)}`;
}

/**
 * Cómo se lee el cálculo de una fila, para mostrarlo al lado del parcial.
 *
 * Medida:   "1 × 5,20 × 4,30"
 * Derivada: "1.240 × 15 + 5%"
 *
 * Con unidades sin dimensiones y fila medida queda sólo la cantidad, y en ese
 * caso la pantalla no muestra nada: repetir el mismo número dos veces no
 * explica nada. Por eso devuelve null y no el número suelto.
 */
export function formulaMedicion(
  medicion: MedicionOpcion,
  unidad: UnidadComputo,
  totalOrigen = 0
) {
  if (medicion.origenId) {
    const base = `${formatCantidad(totalOrigen)} × ${formatCantidad(medicion.cantidad)}`;
    return medicion.desperdicio
      ? `${base} + ${formatCantidad(medicion.desperdicio)}%`
      : base;
  }
  const dims = dimensionesDe(unidad);
  if (dims.length === 0) return null;
  const partes = [medicion.cantidad, ...dims.map((dim) => medicion[dim] ?? 1)];
  return partes.map(formatCantidad).join(" × ");
}

/**
 * El número detrás de lo que se tipeó en una celda de medida.
 *
 * Acepta coma o punto porque en obra se escribe "5,20" y en un teclado numérico
 * sale "5.20", y corregir eso a mano treinta veces es exactamente la fricción
 * que el módulo viene a sacar. Vacío es null (la medida no se cargó) y
 * cualquier cosa que no dé un número positivo también: una celda ilegible no
 * puede convertirse en un cero silencioso que desarme el total.
 *
 * No lleva separador de miles, a diferencia de los campos de dinero: una medida
 * de obra no llega a cuatro cifras y el punto se confundiría con el decimal.
 */
export function parseMedida(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/** El texto con el que arranca una celda de medida. Vacío si no hay valor. */
export function medidaATexto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(".", ",");
}

/**
 * Resumen de un grupo de ítems (los de un subrubro, los de un rubro, o el
 * cómputo entero).
 *
 * No se devuelve una cantidad total sumada: sumar m² con kg y unidades da un
 * número que no significa nada. Lo que sí se puede contar son los ítems y
 * cuántos de ellos ya tienen al menos una fila cargada, que es la medida real
 * de cuánto falta del cómputo.
 */
export type ResumenComputo = {
  items: number;
  computados: number;
  filas: number;
};

export function resumirComputo(items: ItemOpcion[]): ResumenComputo {
  return {
    items: items.length,
    computados: items.filter((i) => i.mediciones.length > 0).length,
    filas: items.reduce((acc, i) => acc + i.mediciones.length, 0),
  };
}

/** Nombre del subrubro cuando un ítem no tiene ninguno asignado. */
export const SIN_SUBRUBRO = "General";

/**
 * ¿Este ítem es hierro, que se mide en metros lineales y se compra en barras
 * comerciales de 12 m?
 *
 * No hay un campo dedicado para esto: se reconoce por cómo quedó armada su
 * conversión (metros → kg, agrupada como "barra"), que es justo lo que deja
 * el modo simplificado del diálogo del ítem (ver ItemSeccionDialog). Así no
 * hace falta una migración, y un ítem de otro rubro que también se mida en ML
 * —un zócalo, una cañería— y no se haya armado así no entra en esta regla: la
 * grilla de hierro es un caso puntual, no "todo lo que se mida en metros".
 */
export function esHierro(item: {
  unidad: UnidadComputo;
  rinde: number | null;
  rindeUnidad: UnidadComputo | null;
  porBulto: number | null;
  bultoNombre: string | null;
}): boolean {
  return (
    item.unidad === "ML" &&
    item.rinde !== null &&
    item.rindeUnidad === "KG" &&
    item.porBulto !== null &&
    (item.bultoNombre ?? "").trim().toLowerCase() === "barra"
  );
}

/**
 * Las barras que corresponden a estos metros de hierro, sin redondear (el
 * redondeo hacia arriba sólo tiene sentido en el Total, no mientras se está
 * tipeando ni en el desglose de un nivel).
 */
export function barrasDeMetros(
  item: {
    desperdicio: number | null;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
    porBulto: number | null;
  },
  metros: number
): number {
  const kg = materialDe(item, metros) ?? 0;
  return bultosDe(item, kg)?.exacto ?? 0;
}

/**
 * La vuelta de barrasDeMetros: de una cantidad de barras salen los metros que
 * hay que haber medido para pedir justo eso (deshace la merma y el peso por
 * barra, en vez de aplicarlos).
 */
export function metrosDeBarras(
  item: {
    desperdicio: number | null;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
    porBulto: number | null;
  },
  barras: number
): number {
  const conversion = conversionDe(item);
  if (!conversion || item.porBulto === null) return 0;
  const kg = barras * item.porBulto;
  const merma = item.desperdicio === null ? 1 : 1 + item.desperdicio / 100;
  return kg / conversion.rinde / merma;
}

/**
 * Los kilos que corresponden a estos metros de hierro, sin redondear —es la
 * misma cuenta que usa `barrasDeMetros` antes de dividir por el peso de la
 * barra, así que vive acá para no repetirla en la grilla.
 */
export function kgDeMetros(
  item: {
    desperdicio: number | null;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
  },
  metros: number
): number {
  return materialDe(item, metros) ?? 0;
}

/**
 * La vuelta de kgDeMetros: de un peso en kilos salen los metros que hay que
 * haber medido para pedir justo eso (deshace la merma y el rinde). Misma idea
 * que `metrosDeBarras`, pero sin pasar por la cantidad de barras en el medio.
 */
export function metrosDeKg(
  item: {
    desperdicio: number | null;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
  },
  kg: number
): number {
  const conversion = conversionDe(item);
  if (!conversion) return 0;
  const merma = item.desperdicio === null ? 1 : 1 + item.desperdicio / 100;
  return kg / conversion.rinde / merma;
}

/**
 * ¿Esta sección necesita, además del total por ítem al pie, el total por
 * piso a la derecha?
 *
 * Hoy es sólo HORMIGÓN de ESTRUCTURA_H°A: columnas, vigas, losas, escaleras,
 * tabiques y bases son items distintos, pero lo que de verdad se usa para
 * programar un pozo de hormigón es cuánto hay que colar ESE piso en total, no
 * cuánto hay de cada tipo de pieza. El resto de las secciones no tiene esta
 * necesidad —no se vacía "todo lo medido de un piso" junto, cada ítem se pide
 * por separado— así que no hace falta una columna que nadie va a mirar.
 *
 * Se exige que los ítems compartan unidad y que ninguno convierta a otra
 * (hierro, ladrillos en palets, etc.): sumar m³ de hormigón con barras de
 * hierro sería un número sin sentido, y esta columna existe justamente para
 * lo contrario, un número que se pueda leer de una.
 */
export function mostrarTotalPorFila(
  seccion: { nombre: string },
  items: {
    unidad: UnidadComputo;
    rinde: number | null;
    rindeUnidad: UnidadComputo | null;
    porBulto: number | null;
    bultoNombre: string | null;
  }[]
): boolean {
  if (seccion.nombre.trim().toUpperCase() !== "HORMIGÓN") return false;
  if (items.length === 0) return false;
  const unidad = items[0].unidad;
  return items.every(
    (i) => i.unidad === unidad && conversionDe(i) === null && !esHierro(i)
  );
}

/**
 * La suma de lo medido de todos los ítems de la sección, para una fila (un
 * piso, una fila extra, o "Toda la obra"). Sólo tiene sentido llamarla cuando
 * `mostrarTotalPorFila` ya dijo que sí: ahí todos los ítems comparten unidad,
 * así que sumarlos da un número y no una mezcla.
 */
export function totalPorFila(
  items: ItemOpcion[],
  fila: ClaveFila,
  totales?: Map<string, number>
): number {
  return items.reduce((acc, item) => acc + medidoEnFila(item, fila, totales), 0);
}
