/**
 * El cómputo de un rubro en papel, con la misma forma que tiene en pantalla:
 * los ítems como filas, los niveles como columnas.
 *
 * Es distinto del informe general (informe-computo.ts), que lista ítem por ítem
 * hacia abajo con todo su detalle. Los dos sirven, para cosas distintas: el
 * vertical es el que se manda a cotizar —el proveedor necesita ver de dónde
 * sale cada número—, y éste es el que se lleva a la obra o a una reunión, donde
 * lo que se busca es leer de un vistazo cuánto va en cada planta.
 *
 * Va en A4 vertical, como el resto de los papeles del estudio: se pidió así
 * para que se archive y se imprima junto con ellos. La grilla es ancha por
 * naturaleza cuando los niveles son columnas, así que con muchos niveles las
 * columnas quedan angostas y un nombre largo se corta con "…"; para eso está
 * elegir en el diálogo sólo los niveles que hacen falta. La fila de cada ítem
 * crece hacia abajo con sub-líneas en vez de la tabla crecer para el costado.
 *
 * Cada ítem con más de un valor —el hierro mide en metros, barras y kilos a
 * la vez; cualquier ítem puede tener además uno por cada sub ítem que
 * tenga— abre una fila propia por cada uno de esos valores debajo de la fila
 * de título, con su etiqueta a la izquierda: la misma estructura fila por
 * fila que tiene en pantalla, no apilados dentro de una sola celda.
 *
 * Quien llama ya decide qué entra: las secciones, las filas y los ítems llegan
 * filtrados y en orden. Acá no se elige nada, sólo se dibuja. Así el diálogo de
 * descarga es el único lugar donde vive esa decisión.
 */

import {
  barrasDeMetros,
  bultosDe,
  conDesperdicio,
  conversionDe,
  esDerivadaEnFila,
  esHierro,
  esSeccionMamposteria,
  esSeccionPuertas,
  etiquetaBultos,
  mayuscula,
  formatCantidad,
  kgDeMetros,
  materialDe,
  medicionesDeFila,
  medidoEnFila,
  parcialMedicion,
  simboloUnidad,
  subItemEnFila,
  subItemMedicionesDeFila,
  tieneBultos,
  tieneMedidoEnFila,
  totalSubItem,
  TIPO_COMPUTO_LABEL,
  type ClaveFila,
  type ItemOpcion,
  type SeccionOpcion,
} from "@/lib/computos";

/** Cuáles de las tres lecturas del hierro (ml, barras, kg) van en el papel. */
export type UnidadHierro = "ml" | "barras" | "kg";

export const UNIDADES_HIERRO: UnidadHierro[] = ["ml", "barras", "kg"];

const ETIQUETA_UNIDAD_HIERRO: Record<UnidadHierro, string> = {
  ml: "ml",
  barras: "barras",
  kg: "kg",
};

/** Una fila de la grilla impresa: ya elegida y ya ordenada. */
export type FilaInforme = { clave: ClaveFila; nombre: string };

export type SeccionInforme = {
  seccion: SeccionOpcion;
  /** Las filas que se van a imprimir, en orden. */
  filas: FilaInforme[];
  /** Las columnas, en orden. */
  items: ItemOpcion[];
  /** Cuándo se tocó por última vez este rubro de este lado. Null = nunca. */
  modificadoEl: Date | null;
};

export type DatosInformeRubro = {
  proyectoNombre: string;
  rubroNombre: string;
  /** Los totales de TODA la obra: una fila derivada puede salir de otro rubro. */
  totales: Map<string, number>;
  secciones: SeccionInforme[];
  /** Si va la segunda columna de cada ítem, lo medido más la merma. */
  conDesperdicio: boolean;
  /** Si los renglones de las celdas desglosadas van como filas aparte. */
  conDetalle: boolean;
  /**
   * Qué lecturas del hierro van impresas: ml, barras, kg, o varias juntas.
   *
   * El hierro no tiene columna de desperdicio propia —la merma va metida
   * adentro de la cuenta de barras y de kilos, igual que en pantalla—, así que
   * no usa `conDesperdicio` para nada: elige sus columnas por su cuenta.
   */
  unidadesHierro: Record<UnidadHierro, boolean>;
};

/** Escapa el texto que se inyecta en el HTML del informe. */
function esc(texto: string) {
  return texto.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

/** Fecha larga y legible ("13 de agosto de 2026"). */
function fechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Fecha corta, para repetir al lado de cada sección sin ocupar renglón: "6/10/2026". */
function fechaCorta(fecha: Date) {
  return fecha.toLocaleDateString("es-AR");
}

/** La ventana se abre en `about:blank`: el logo necesita la URL absoluta. */
function urlLogo() {
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  return `${origen}/logo-jes.png`;
}

function tablaSeccion(seccion: SeccionInforme, datos: DatosInformeRubro) {
  const { items, filas } = seccion;

  /**
   * Con un solo nivel exportado, la columna del nivel y la del TOTAL dirían
   * lo mismo dos veces. Queda una sola, con el nombre del nivel arriba, pero
   * con lo que muestra el TOTAL: las barras y los bultos ya redondeados para
   * arriba, que es lo que se compra. Los totales ya llegan recortados a lo
   * exportado (ver el diálogo), así que el número es el de ese nivel.
   */
  const unNivel = filas.length === 1;

  /**
   * PUERTAS no tiene línea de cantidad propia —en vez de eso, una línea por
   * cada sub ítem que tenga cada puerta— la misma excepción que tiene la
   * grilla en pantalla (ver `esSeccionPuertas`).
   */
  const puertas = esSeccionPuertas(seccion.seccion);

  /**
   * La mampostería de Cómputos 2 se imprime igual que se ve en pantalla: sin
   * la línea de unidades y con los palets ya redondeados para arriba en cada
   * celda, sin decimales (ver `mamposteria2` en seccion-grilla.tsx).
   */
  const mamposteria2 = seccion.seccion.esComputos2 && esSeccionMamposteria(seccion.seccion);

  /** ¿Va la línea de la merma de este ítem? Depende de lo que se eligió bajar. */
  const conMerma = (item: ItemOpcion) =>
    datos.conDesperdicio && item.desperdicio !== null;

  /**
   * Las lecturas del hierro que van impresas, en orden fijo (ml, barras, kg).
   *
   * Si no se eligió ninguna (se destildaron las tres) cae en ml y nada más:
   * una línea sola, pero una, que ninguna línea dejaría al ítem sin dónde
   * poner su número.
   */
  const columnasHierro = () => {
    const elegidas = UNIDADES_HIERRO.filter((u) => datos.unidadesHierro[u]);
    return elegidas.length > 0 ? elegidas : (["ml"] as UnidadHierro[]);
  };

  /** Las tres lecturas de una medida en metros de hierro, ya convertidas. */
  const valoresHierro = (item: ItemOpcion, metros: number) => ({
    ml: metros,
    barras: barrasDeMetros(item, metros),
    kg: kgDeMetros(item, metros),
  });

  /**
   * Lo mismo que `valoresHierro`, pero con las barras ya redondeadas para
   * arriba. Sólo tiene sentido en el total de la columna: las barras se
   * compran una vez para toda la obra, así que ahí —y sólo ahí— corresponde
   * el redondeo (igual que en pantalla).
   */
  const valoresHierroTotal = (item: ItemOpcion, medido: number) => {
    const kg = kgDeMetros(item, medido);
    const bultos = bultosDe(item, kg);
    return { ml: medido, barras: bultos?.enteros ?? 0, kg };
  };


  /**
   * Una línea de valor cualquiera, en su propia celda: ya no apila nada, es
   * un solo número (o una raya) por celda, igual que en pantalla.
   */
  const celda = (texto: string, clase = "", derivada = false) =>
    `<span class="sub-linea num${clase ? ` ${clase}` : ""}${derivada ? " derivada" : ""}">${esc(texto)}</span>`;

  /**
   * Una línea de la fila de un ítem: la de "medido" (si tiene) se fusiona
   * con la fila de título, igual que en pantalla; las demás —merma, bultos,
   * material, cada lectura del hierro, cada sub ítem— abren su propia fila
   * debajo, con su etiqueta a la izquierda.
   */
  type LineaInforme = {
    etiqueta: string | null;
    /** Un sub ítem: se carga a mano, así que no va sombreado como las líneas calculadas. */
    esSubItem?: boolean;
    celda: (fila: ClaveFila) => string;
    total: () => string;
  };

  /** Las líneas de un ítem de hierro: una por cada lectura elegida (ml, barras, kg). */
  const lineasHierro = (item: ItemOpcion): LineaInforme[] =>
    columnasHierro().map((u) => ({
      etiqueta: ETIQUETA_UNIDAD_HIERRO[u],
      celda: (fila) => {
        const tiene = tieneMedidoEnFila(item, fila);
        const medido = medidoEnFila(item, fila, datos.totales);
        const derivada = esDerivadaEnFila(item, fila);
        const valores = tiene ? valoresHierro(item, medido) : null;
        return celda(valores === null ? "—" : formatCantidad(valores[u]), u === "ml" ? "" : "material", derivada);
      },
      total: () => {
        const vacio = item.mediciones.length === 0;
        const total = datos.totales.get(item.id) ?? 0;
        // Acá, y sólo acá, las barras ya van redondeadas para arriba: es lo
        // que efectivamente se compra.
        const valores = vacio ? null : valoresHierroTotal(item, total);
        return celda(valores === null ? "—" : formatCantidad(valores[u]), u === "ml" ? "" : "material");
      },
    }));

  /** Las líneas de un ítem que no es de hierro: medido, merma, bultos, material. */
  const lineasRegulares = (item: ItemOpcion): LineaInforme[] => {
    const lineas: LineaInforme[] = [];
    // Un ítem de PUERTAS no tiene línea de cantidad propia: queda
    // reemplazada del todo por sus sub ítems (ver `lineasSubItemsDe`).
    if (!puertas) {
      lineas.push({
        etiqueta: null,
        celda: (fila) => {
          const tiene = tieneMedidoEnFila(item, fila);
          const medido = medidoEnFila(item, fila, datos.totales);
          const derivada = esDerivadaEnFila(item, fila);
          return celda(tiene ? formatCantidad(medido) : "—", "", derivada);
        },
        total: () => {
          // Igual que en pantalla: en la mampostería de Cómputos 2 el Total
          // no lleva los m² sin desperdicio.
          if (mamposteria2) return "";
          const vacio = item.mediciones.length === 0;
          const total = datos.totales.get(item.id) ?? 0;
          return celda(vacio ? "—" : formatCantidad(total));
        },
      });
    }
    if (conMerma(item)) {
      lineas.push({
        etiqueta: `+${formatCantidad(item.desperdicio ?? 0)}%`,
        celda: (fila) => {
          const tiene = tieneMedidoEnFila(item, fila);
          const medido = medidoEnFila(item, fila, datos.totales);
          return celda(tiene ? formatCantidad(conDesperdicio(medido, item.desperdicio)) : "—", "merma");
        },
        total: () => {
          const vacio = item.mediciones.length === 0;
          const total = datos.totales.get(item.id) ?? 0;
          return celda(vacio ? "—" : formatCantidad(conDesperdicio(total, item.desperdicio)));
        },
      });
    }
    if (tieneBultos(item)) {
      lineas.push({
        etiqueta: mayuscula(etiquetaBultos([item])),
        celda: (fila) => {
          const tiene = tieneMedidoEnFila(item, fila);
          const medido = medidoEnFila(item, fila, datos.totales);
          // Sin redondear, como toda celda de nivel: el redondeo para arriba
          // es sólo del total (ver `bultosDe` y la línea `total` de abajo).
          const b = tiene ? bultosDe(item, materialDe(item, medido)) : null;
          if (!tiene) return celda("—", "muted");
          return mamposteria2
            ? celda(String(b?.enteros ?? 0))
            : celda(formatCantidad(b?.exacto ?? 0), "muted");
        },
        total: () => {
          const vacio = item.mediciones.length === 0;
          const total = datos.totales.get(item.id) ?? 0;
          const b = vacio ? null : bultosDe(item, materialDe(item, total));
          const texto =
            b === null
              ? "—"
              : mamposteria2
                ? `<strong>${esc(String(b.enteros))}</strong>`
                : `<strong>${esc(String(b.enteros))}</strong> <span class="exacto">${esc(
                    formatCantidad(b.exacto)
                  )}</span>`;
          return `<span class="sub-linea num">${texto}</span>`;
        },
      });
    }
    if (conversionDe(item) && !mamposteria2) {
      lineas.push({
        etiqueta: simboloUnidad(conversionDe(item)!.unidad),
        celda: (fila) => {
          const tiene = tieneMedidoEnFila(item, fila);
          const medido = medidoEnFila(item, fila, datos.totales);
          return celda(tiene ? formatCantidad(materialDe(item, medido) ?? 0) : "—", "material");
        },
        total: () => {
          const vacio = item.mediciones.length === 0;
          const total = datos.totales.get(item.id) ?? 0;
          return celda(vacio ? "—" : formatCantidad(materialDe(item, total) ?? 0), "material");
        },
      });
    }
    return lineas;
  };

  /**
   * Las líneas de los sub ítems de un ítem, una por cada uno que tenga —la
   * misma generalización que tiene la grilla en pantalla, ya no sólo para
   * PUERTAS—. Mismo criterio que en pantalla: "—" si el sub ítem no tiene
   * nada cargado en esa fila, en vez de un cero que confundiría "no se
   * cargó" con "no lleva este sub ítem".
   */
  const lineasSubItemsDe = (item: ItemOpcion): LineaInforme[] =>
    item.subItems.map((subItem) => ({
      etiqueta: subItem.nombre,
      esSubItem: true,
      celda: (fila) => {
        const cargado = subItemMedicionesDeFila(subItem, fila).length > 0;
        return celda(cargado ? formatCantidad(subItemEnFila(subItem, fila)) : "—");
      },
      total: () => {
        const total = totalSubItem(subItem);
        return celda(total > 0 ? formatCantidad(total) : "—");
      },
    }));

  /** Todas las líneas de un ítem, en el orden en que se dibujan. */
  const lineasDe = (item: ItemOpcion): LineaInforme[] => [
    ...(esHierro(item) ? lineasHierro(item) : lineasRegulares(item)),
    ...lineasSubItemsDe(item),
  ];

  /**
   * Los renglones que hay detrás de las celdas desglosadas de un ítem, cada
   * uno como su propia fila de la tabla.
   *
   * Si las columnas de la planta baja se cargaron como C1, C2 y C3, en el
   * papel aparecen las tres abajo de la fila del ítem, cada una con su
   * número en la columna del nivel del que salió. Así se puede tildar una
   * por una en la obra —que es para lo que se lleva esta hoja— y la cuenta
   * queda a la vista: los renglones tienen que dar el número de arriba.
   *
   * Justamente por eso se imprime el parcial ya resuelto y no el campo
   * `cantidad`: un renglón viejo que tiene largo y ancho, o uno que
   * descuenta, aporta algo distinto de lo que dice ese campo. Una fila de
   * números que no cierran con su total es peor que no imprimir el detalle.
   *
   * El nombre del renglón va en la columna del ítem y el número en la del
   * nivel: alcanza para saber de qué nivel es sin repetir su nombre en cada
   * línea, y deja las demás celdas de la fila en blanco.
   *
   * Sólo se desglosan las celdas de dos renglones o más. Una celda de un
   * solo renglón ya es su propio detalle: repetirla abajo es imprimir dos
   * veces el mismo número. La excepción es cuando ese renglón único tiene
   * una descripción propia (por ejemplo "Base B1"): ahí el renglón no es un
   * simple duplicado del total, es la única referencia escrita a qué
   * corresponde ese número, y perderla en el papel deja la cuenta sin
   * explicación.
   */
  const renglonesDeItem = (item: ItemOpcion) =>
    filas
      .flatMap((fila) => {
        const renglones = medicionesDeFila(item, fila.clave).filter(
          (m) => m.origenId === null
        );
        // La fórmula de una celda no se imprime (vive aparte, en `formula`):
        // sólo una descripción propia justifica una fila de detalle.
        const tieneDescripcionPropia =
          renglones.length === 1 && !!renglones[0].descripcion?.trim();
        if (renglones.length < 2 && !tieneDescripcionPropia) return [];
        return renglones.map((medicion) => {
          const parcial = parcialMedicion(medicion, item.unidad);
          const valorCelda = esHierro(item)
            ? columnasHierro()
                .map((u) => celda(formatCantidad(valoresHierro(item, parcial)[u]), u === "ml" ? "" : "material"))
                .join("")
            : `<span class="sub-linea num">${esc(formatCantidad(parcial))}</span>`;
          const celdas = filas
            .map((f) => (f === fila ? `<td>${valorCelda}</td>` : `<td></td>`))
            .join("");
          return `
        <tr class="renglon">
          <th class="item-col renglon-nombre" scope="row">${esc(
            medicion.descripcion ?? "—"
          )}</th>
          <td class="unidad-col"></td>
          ${celdas}
          ${unNivel ? "" : `<td class="total-col"></td>`}
        </tr>`;
        });
      })
      .join("");

  const encabezado = `
    <tr>
      <th class="item-col">Ítem</th>
      <th class="unidad-col">Unidad</th>
      ${
        unNivel
          ? `<th class="total-col">${esc(filas[0].nombre)}</th>`
          : `${filas.map((fila) => `<th class="nivel">${esc(fila.nombre)}</th>`).join("")}
      <th class="total-col">TOTAL</th>`
      }
    </tr>`;

  /**
   * Las celdas de valores de una línea: una por nivel más la del TOTAL, o,
   * con un solo nivel, sólo la del TOTAL (ver `unNivel`). Si el TOTAL de esa
   * línea va en blanco a propósito (la mampostería de Cómputos 2), cae en la
   * celda del nivel para que la fila no quede sin su número.
   */
  const celdasDeLinea = (linea: LineaInforme) => {
    if (unNivel) {
      return `<td class="total-col">${linea.total() || linea.celda(filas[0].clave)}</td>`;
    }
    return `${filas.map((fila) => `<td>${linea.celda(fila.clave)}</td>`).join("")}<td class="total-col">${linea.total()}</td>`;
  };

  /**
   * La fila (o filas) de un ítem: la línea "medido" —si tiene— se fusiona
   * con la fila de título, igual que en pantalla; las demás abren su propia
   * fila debajo, con su etiqueta a la izquierda y la columna de Unidad en
   * blanco para no repetirla.
   */
  const filaDeItem = (item: ItemOpcion) => {
    const lineas = lineasDe(item);
    const principal = lineas.find((l) => l.etiqueta === null) ?? null;
    const resto = principal ? lineas.filter((l) => l !== principal) : lineas;

    const celdasTitulo = principal
      ? celdasDeLinea(principal)
      : `<td colspan="${unNivel ? 1 : filas.length + 1}"></td>`;

    const filaTitulo = `
      <tr class="fila-item">
        <th class="item-col" scope="row">
          <div class="item-nombre">${esc(item.nombre)}</div>
          ${item.modelo ? `<div class="item-modelo">${esc(item.modelo)}</div>` : ""}
        </th>
        <td class="unidad-col">${esc(simboloUnidad(item.unidad))}</td>
        ${celdasTitulo}
      </tr>`;

    const filasResto = resto
      .map(
        (linea) => `
      <tr class="linea-extra${linea.esSubItem ? "" : " linea-calculada"}">
        <th class="item-col linea-nombre" scope="row">${esc(linea.etiqueta ?? "")}</th>
        <td class="unidad-col"></td>
        ${celdasDeLinea(linea)}
      </tr>`
      )
      .join("");

    return `${filaTitulo}${filasResto}${datos.conDetalle ? renglonesDeItem(item) : ""}`;
  };

  const cuerpo = items.map((item) => filaDeItem(item)).join("");

  /**
   * El pie de la tabla: cuánto suman todos los ítems de la sección en cada
   * nivel y en todo lo exportado. Por ejemplo, los m³ de hormigón de toda la
   * planta baja (columnas, vigas, losas, tabiques...). Es el mismo pie que
   * tiene la grilla en pantalla (ver `TotalesPorFila` en seccion-grilla.tsx).
   *
   * Suma lo medido, lo de la primera línea de cada ítem (con las plantas de
   * la planta tipo ya multiplicadas), sin desperdicio. Sumar m² con ml no da
   * nada que signifique algo, así que va una fila por cada unidad que haya en
   * la sección. En el hierro se suman también los kg: los metros de un Ø6 y de
   * un Ø25 pesan muy distinto, y el peso es lo que se pide.
   *
   * El total de cada renglón es la suma de sus niveles: los totales ya llegan
   * recortados a lo exportado, así que da lo mismo que sumar la columna TOTAL.
   * Con un solo nivel (ver `unNivel`) va sólo esa celda.
   */
  const enFila = (item: ItemOpcion, fila: ClaveFila) =>
    medidoEnFila(item, fila, datos.totales) +
    item.subItems.reduce((acc, si) => acc + subItemEnFila(si, fila), 0);
  const cargadoEnFila = (item: ItemOpcion, fila: ClaveFila) =>
    tieneMedidoEnFila(item, fila) ||
    item.subItems.some((si) => subItemMedicionesDeFila(si, fila).length > 0);

  type RenglonPie = { clave: string; unidad: string; porFila: (number | null)[] };
  const renglonesPie: RenglonPie[] = [];
  /** Suma de a un ítem, dejando null ("—") la columna donde ninguno cargó nada. */
  const sumarEn = (renglon: RenglonPie, item: ItemOpcion, valor: (fila: ClaveFila) => number) =>
    filas.forEach((fila, i) => {
      if (!cargadoEnFila(item, fila.clave)) return;
      renglon.porFila[i] = (renglon.porFila[i] ?? 0) + valor(fila.clave);
    });

  for (const item of items) {
    let renglon = renglonesPie.find((r) => r.clave === item.unidad);
    if (!renglon) {
      renglon = { clave: item.unidad, unidad: simboloUnidad(item.unidad), porFila: filas.map(() => null) };
      renglonesPie.push(renglon);
    }
    sumarEn(renglon, item, (fila) => enFila(item, fila));
  }

  const hierroItems = items.filter((i) => esHierro(i));
  if (hierroItems.length > 0) {
    const kg: RenglonPie = { clave: "kg", unidad: "kg", porFila: filas.map(() => null) };
    for (const item of hierroItems) sumarEn(kg, item, (fila) => kgDeMetros(item, enFila(item, fila)));
    renglonesPie.push(kg);
  }

  const cantidadPie = (valor: number | null) => esc(valor === null ? "—" : formatCantidad(valor));

  const pie = renglonesPie
    .map((renglon, indice) => {
      const conAlgo = renglon.porFila.filter((v): v is number => v !== null);
      const total = conAlgo.length === 0 ? null : conAlgo.reduce((a, b) => a + b, 0);
      return `
    <tr class="total-fila${indice === 0 ? " primera" : ""}">
      <th class="item-col" scope="row">${indice === 0 ? "Total" : ""}</th>
      <td class="unidad-col">${esc(renglon.unidad)}</td>
      ${unNivel ? "" : renglon.porFila.map((v) => `<td class="num">${cantidadPie(v)}</td>`).join("")}
      <td class="total-col">${cantidadPie(total)}</td>
    </tr>`;
    })
    .join("");

  return `
    <section class="bloque">
      <h2>
        <span>
          ${esc(seccion.seccion.nombre)}
          <span class="lado">${esc(TIPO_COMPUTO_LABEL[seccion.seccion.tipo])}</span>
        </span>
        ${
          seccion.modificadoEl
            ? `<span class="modificado">Modificado el ${esc(fechaCorta(seccion.modificadoEl))}</span>`
            : ""
        }
      </h2>
      <table class="grilla">
        <thead>${encabezado}</thead>
        <tbody>${cuerpo}</tbody>
        ${pie ? `<tfoot>${pie}</tfoot>` : ""}
      </table>
    </section>`;
}

/**
 * El resumen del pie: hormigón, barras y kilos de todo lo que se exporta, en
 * dos cuadros: uno por sección (cuánto hormigón y cuánto hierro lleva cada
 * parte de la estructura) y otro por diámetro (lo que se le pide al
 * corralón). Cada uno cierra con su total, así que el número general está en
 * los dos y tiene que dar igual.
 *
 * Sale de los mismos totales que las tablas, que ya llegan recortados a lo
 * que se eligió (niveles, renglones, planta tipo "x planta"), así que el
 * resumen no repite ninguna cuenta y no puede contradecirlas.
 *
 * - Hormigón es todo ítem que mide en m³, sin la merma: el mismo número que la
 *   columna TOTAL.
 * - Las barras se redondean para arriba por ítem y recién después se suman,
 *   igual que en el TOTAL de cada tabla; redondear la suma daría menos barras
 *   de las que en verdad hay que comprar.
 * - El diámetro sale del nombre del ítem ("Ø8"): no hay un campo para eso, y
 *   es el nombre con el que la plantilla arma cada hierro. Dos secciones con
 *   un "Ø8" cada una suman en la misma fila.
 *
 * Si van los dos lados del rubro, cuenta sólo Materiales: la mano de obra
 * suele medir lo mismo (los m³ que se hormigonan, los kg que se atan) y
 * sumarla duplicaría todo. Si sólo va mano de obra, cuenta ésa.
 *
 * Devuelve "" cuando lo exportado no tiene ni hierro ni m³: en los rubros que
 * no son estructura el resumen no tiene nada que decir.
 */
function resumenExportado(conItems: SeccionInforme[], datos: DatosInformeRubro) {
  const hayMateriales = conItems.some((s) => s.seccion.tipo === "MATERIALES");
  const secciones = conItems.filter((s) => !hayMateriales || s.seccion.tipo === "MATERIALES");

  const total = (i: ItemOpcion) => datos.totales.get(i.id) ?? 0;
  const esHormigon = (i: ItemOpcion) => i.unidad === "M3" && !esHierro(i);
  const kgDe = (i: ItemOpcion) => kgDeMetros(i, total(i));
  const barrasDe = (i: ItemOpcion) => bultosDe(i, kgDe(i))?.enteros ?? 0;

  type Suma = { m3: number; barras: number; kg: number; conHormigon: boolean; conHierro: boolean };
  const sumar = (items: ItemOpcion[]): Suma => {
    const hormigon = items.filter(esHormigon);
    const hierros = items.filter((i) => esHierro(i));
    return {
      m3: hormigon.reduce((acc, i) => acc + total(i), 0),
      barras: hierros.reduce((acc, i) => acc + barrasDe(i), 0),
      kg: hierros.reduce((acc, i) => acc + kgDe(i), 0),
      conHormigon: hormigon.length > 0,
      conHierro: hierros.length > 0,
    };
  };

  const porSeccion = secciones
    .map((s) => ({ nombre: s.seccion.nombre, suma: sumar(s.items) }))
    .filter((f) => f.suma.conHormigon || f.suma.conHierro);
  if (porSeccion.length === 0) return "";
  const general = sumar(secciones.flatMap((s) => s.items));

  /** Los hierros agrupados por diámetro, del más fino al más grueso. */
  const diametros = new Map<string, { nombre: string; kgPorMetro: number; barras: number; kg: number }>();
  for (const item of secciones.flatMap((s) => s.items).filter((i) => esHierro(i))) {
    const nombre = item.nombre.trim().replace(/\s+/g, " ");
    const clave = nombre.toUpperCase();
    const fila = diametros.get(clave) ?? { nombre, kgPorMetro: item.rinde ?? 0, barras: 0, kg: 0 };
    fila.barras += barrasDe(item);
    fila.kg += kgDe(item);
    diametros.set(clave, fila);
  }
  const porDiametro = [...diametros.values()].sort((a, b) => a.kgPorMetro - b.kgPorMetro);

  const num = (valor: number, hay: boolean) =>
    `<td class="num">${esc(hay ? formatCantidad(valor) : "—")}</td>`;

  const tablaSecciones = `
    <table class="grilla resumen-tabla">
      <thead>
        <tr>
          <th class="item-col">Sección</th>
          ${general.conHormigon ? `<th>Hormigón m³</th>` : ""}
          ${general.conHierro ? `<th>Barras</th><th>Hierro kg</th>` : ""}
        </tr>
      </thead>
      <tbody>
        ${porSeccion
          .map(
            ({ nombre, suma }) => `
        <tr>
          <th class="item-col" scope="row">${esc(nombre)}</th>
          ${general.conHormigon ? num(suma.m3, suma.conHormigon) : ""}
          ${general.conHierro ? `${num(suma.barras, suma.conHierro)}${num(suma.kg, suma.conHierro)}` : ""}
        </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr class="total-fila primera">
          <th class="item-col" scope="row">Total</th>
          ${general.conHormigon ? num(general.m3, true) : ""}
          ${general.conHierro ? `${num(general.barras, true)}${num(general.kg, true)}` : ""}
        </tr>
      </tfoot>
    </table>`;

  const tablaDiametros =
    porDiametro.length === 0
      ? ""
      : `
    <table class="grilla resumen-tabla">
      <thead>
        <tr><th class="item-col">Diámetro</th><th>Barras</th><th>Hierro kg</th></tr>
      </thead>
      <tbody>
        ${porDiametro
          .map(
            (d) => `
        <tr>
          <th class="item-col" scope="row">${esc(d.nombre)}</th>
          ${num(d.barras, true)}${num(d.kg, true)}
        </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr class="total-fila primera">
          <th class="item-col" scope="row">Total</th>
          ${num(general.barras, true)}${num(general.kg, true)}
        </tr>
      </tfoot>
    </table>`;

  return `
  <section class="resumen">
    <h2>Resumen de lo exportado</h2>
    <div class="resumen-cuadros">${tablaSecciones}${tablaDiametros}</div>
  </section>`;
}

function construirHtml(datos: DatosInformeRubro) {
  const conItems = datos.secciones.filter((s) => s.items.length > 0 && s.filas.length > 0);
  const cuerpo = conItems.map((s) => tablaSeccion(s, datos)).join("");
  const resumen = resumenExportado(conItems, datos);
  const cuantosItems = conItems.reduce((acc, s) => acc + s.items.length, 0);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(datos.rubroNombre)} - ${esc(datos.proyectoNombre)}</title>
  <style>
    :root {
      --tinta: #1f1f1f;
      --gris: #6f6f6f;
      --linea: #d9d9d9;
      --oscuro: #2b2b2b;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: var(--tinta);
      font-size: 10px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* A4 vertical (ver el comentario del principio). El margen lo pone @page
       para que lo respeten todas las hojas y no sólo la primera. */
    @page { size: A4 portrait; margin: 12mm; }
    @media screen {
      body { padding: 12mm; max-width: 210mm; margin: 0 auto; }
    }

    header.doc {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid var(--oscuro);
      padding-bottom: 10px;
      break-inside: avoid;
    }
    header.doc .logo { width: 54px; height: auto; }
    header.doc h1 { font-size: 17px; margin: 0; letter-spacing: -0.01em; }
    header.doc p { margin: 2px 0 0; color: var(--gris); font-size: 10px; }

    .bloque { margin-top: 14px; break-inside: auto; }
    .bloque h2 {
      background: var(--oscuro);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 5px 10px;
      border-radius: 4px;
      margin: 0 0 6px;
      display: flex;
      justify-content: space-between;
      /* Que el título de la sección no quede solo al pie de una hoja. */
      break-after: avoid;
      break-inside: avoid;
    }
    .bloque h2 .lado {
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      opacity: 0.75;
    }
    /* La fecha va aparte del nombre y del lado, pegada al borde derecho: es un
       dato de control y no del título, así que no entra en la misma frase. */
    .bloque h2 .modificado {
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      font-size: 9px;
      opacity: 0.75;
      white-space: nowrap;
    }

    /* table-layout fijo es lo que hace que el ancho de la tabla sea una
       promesa y no una sugerencia: con muchas columnas (hierro con varios
       diámetros, o PUERTAS con varios sub ítems por puerta), una tabla "auto" se
       estira para que cada número entre sin cortarse, y esa franja de más se
       sale del margen de la página al imprimir. Fija, el ancho nunca pasa del
       100% del contenedor -que ya respeta el margen de @page-, y lo que no
       entra en una celda se recorta con puntos suspensivos en vez de
       ensanchar la hoja. */
    table.grilla { width: 100%; border-collapse: collapse; table-layout: fixed; }
    /* La primera columna (los nombres) y la fila de títulos llevan una línea
       más gruesa, igual que en pantalla: son el encabezado de la tabla. */
    table.grilla tr > :first-child { border-right: 2px solid #9a9a9a; }
    table.grilla thead th { border-bottom: 2px solid #9a9a9a; }
    /* Toda la fila de títulos y toda la columna de Total con el mismo peso
       de letra, aunque cada celda traiga el suyo. */
    table.grilla thead th,
    table.grilla td.total-col,
    table.grilla td.total-col * { font-weight: 700; }
    table.grilla th, table.grilla td {
      border: 1px solid var(--linea);
      padding: 2px 4px;
      break-inside: avoid;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* La fila de cada ítem, con un fondo propio para que se distinga de
       entrada de la fila de al lado: ya no alcanza con que sólo la columna
       del ítem tenga su gris, toda la fila lo lleva. */
    tr.fila-item { background: #f2f2f2; }
    /* De punta a punta el mismo gris: el nombre, la unidad y el total no
       llevan un tono propio en la fila del ítem. */
    tr.fila-item th, tr.fila-item td { background: #f2f2f2; }

    /* La columna del ítem es la que se lee para saber de qué fila es cada
       número: va en gris más oscuro que el resto de la fila, alineada
       arriba a la izquierda, y no se corta. Más ancha que una columna de
       nivel común, porque ahora también lleva el nombre del ítem, su modelo
       cuando tiene, y las etiquetas apiladas de lo que mide cada línea de
       sus celdas. */
    .item-col {
      text-align: left;
      vertical-align: top;
      background: #e0e0e0;
      width: 34mm;
    }
    /* El encabezado de la columna del ítem se centra, como cualquier título
       de columna; el pie no —"Total kg" o "Total" son títulos de fila, y los
       títulos de fila siempre van a la izquierda, igual que en pantalla. */
    thead .item-col {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 8.5px;
      vertical-align: middle;
      text-align: center;
      background: #cfcfcf;
    }
    tfoot .item-col {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 8.5px;
      vertical-align: middle;
      text-align: left;
    }
    tbody th.item-col { font-weight: 400; }
    .item-nombre { font-weight: 700; font-size: 9.5px; }
    .item-modelo { color: var(--gris); font-size: 8px; }

    /* La columna de Unidad: la misma que tiene la grilla en pantalla, al
       lado del nombre del ítem. Va una sola vez en la fila de título; las
       filas de líneas extra (merma, bultos, material, hierro, sub ítems) la
       dejan en blanco para no repetirla. */
    .unidad-col {
      width: 14mm;
      text-align: center;
      background: #f3f3f3;
      color: var(--gris);
      font-size: 8.5px;
    }
    thead .unidad-col {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 8.5px;
      text-align: center;
      background: #cfcfcf;
      color: var(--tinta);
    }

    thead th.nivel {
      background: #cfcfcf;
      font-size: 9.5px;
      text-align: center;
    }

    /* Los números son lo que más se amontona: un ítem con varias líneas por
       celda —hierro en ml, barras y kilos a la vez; una puerta que suma
       además una por cada sub ítem— ya mete varias líneas de texto en el
       alto de una sola fila. Achicar la fuente de las líneas, y no de toda
       la tabla, es lo que las deja sueltas y legibles sin perder los
       títulos, que necesitan su tamaño para leerse de lejos. */
    .sub-linea {
      display: block;
      text-align: center;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      font-size: 9px;
    }
    .num { text-align: center; }
    /* La línea del desperdicio, más clara: es la derivada de al lado, no un
       dato independiente, y en gris se lee como lo que es. */
    .merma { color: var(--gris); }
    /* Las líneas que salen de una cuenta sobre otro ítem, en bastardilla: se
       ve de un vistazo qué se midió en obra y qué se calculó. */
    .derivada { font-style: italic; color: var(--gris); }
    /* La línea del material, más marcada: es la que se copia al pedido, así
       que tiene que encontrarse sin buscarla. */
    .material { font-weight: 600; }
    /* La línea de los bultos (antes de redondear), en gris: es la derivada
       del material de al lado, igual criterio que la merma. */
    .muted { color: var(--gris); }
    .exacto { font-weight: 400; font-size: 8px; color: var(--gris); }

    /* La columna de Total, al final de cada fila: va aparte, con un borde
       grueso a la izquierda, porque no es una celda más del nivel de al
       lado —es la suma de toda la fila del ítem— y tiene que leerse como
       tal. */
    .total-col {
      border-left: 2px solid var(--oscuro);
      background: #f3f3f3;
      font-weight: 700;
      text-align: center;
    }
    thead th.total-col { font-size: 9.5px; background: #cfcfcf; }

    /* Las filas de líneas extra de un ítem —merma, bultos, material, cada
       lectura del hierro, cada sub ítem—: un escalón más claro que la fila
       de título de la que cuelgan, con su etiqueta a la izquierda en vez de
       apilada en la columna del ítem. La sangría dice, sin escribirlo, que
       es una línea de detalle y no un ítem más. */
    tr.linea-extra th, tr.linea-extra td { background: #f0f0f0; }
    /* Las que salen solas de la cuenta del ítem (+10%, Palets, material,
       hierro) van en un gris algo más oscuro que la fila del ítem, igual
       que en pantalla: a simple vista se separa lo cargado de lo calculado.
       Los sub ítems, que se cargan a mano, quedan en el gris claro. */
    tr.linea-calculada th, tr.linea-calculada td { background: #e3e3e3; }
    tr.linea-calculada th.linea-nombre { background: #d9d9d9; }
    tr.linea-extra th.linea-nombre {
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      font-size: 8.5px;
      color: var(--gris);
      padding-left: 12px;
    }

    /* El pie de cada tabla: lo que suman todos los ítems en cada nivel, una
       fila por unidad. Es una suma cruzada entre ítems, así que no tiene
       lugar en la celda de Total de ninguno en particular. La raya gruesa va
       sólo arriba de la primera: las demás son parte del mismo pie. */
    tfoot tr.total-fila th, tfoot tr.total-fila td {
      background: #e2e2e2;
      font-weight: 700;
    }
    tfoot tr.total-fila.primera th, tfoot tr.total-fila.primera td {
      border-top: 2px solid var(--oscuro);
    }

    /* Los renglones de una celda desglosada: la misma grilla, un escalón más
       claro y un cuerpo más chico. Se leen como lo que son —de dónde sale el
       número de arriba— sin salirse de las columnas. */
    tr.renglon td, tr.renglon th {
      background: #fcfcfc;
      color: var(--gris);
      font-size: 8.5px;
      padding: 2px 5px;
    }
    tr.renglon th.renglon-nombre {
      background: #f8f8f8;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      /* La sangría es lo que dice, sin escribirlo, que cuelga de la fila de
         arriba y no es un ítem más. */
      padding-left: 14px;
    }

    .vacio { font-size: 10px; color: var(--gris); margin: 14px 0 0; }

    /* El resumen del pie: los dos cuadros uno al lado del otro, angostos, con
       la misma tinta que las grillas para que se lean como parte del cómputo. */
    section.resumen {
      margin-top: 18px;
      border-top: 3px solid var(--oscuro);
      padding-top: 8px;
      break-inside: avoid;
    }
    section.resumen h2 {
      font-size: 11px;
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    section.resumen .resumen-cuadros {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    /* Sin el ancho fijo de la grilla: estos cuadros son de pocas columnas y
       se ajustan a lo que dicen, en vez de estirarse a toda la hoja. */
    section.resumen table.resumen-tabla { width: auto; table-layout: auto; }
    section.resumen table.resumen-tabla td.num { min-width: 22mm; text-align: right; }
  </style>
</head>
<body>
  <header class="doc">
    <img class="logo" id="logo" src="${urlLogo()}" alt="JES &amp; arqs" />
    <div>
      <h1>${esc(datos.proyectoNombre)}</h1>
      <p>${esc(datos.rubroNombre)} — ${conItems.length} ${conItems.length === 1 ? "sección" : "secciones"}, ${cuantosItems} ${cuantosItems === 1 ? "ítem" : "ítems"}</p>
      <p>Generado el ${esc(fechaLarga(new Date().toISOString()))}</p>
    </div>
  </header>

  ${cuerpo ? `${cuerpo}${resumen}` : `<p class="vacio">No quedó nada para imprimir con lo que elegiste.</p>`}

  <script>
    (function () {
      var logo = document.getElementById("logo");
      var impreso = false;
      function imprimir() {
        if (impreso) return;
        impreso = true;
        setTimeout(function () { window.focus(); window.print(); }, 120);
      }
      if (!logo || logo.complete) imprimir();
      else { logo.onload = imprimir; logo.onerror = imprimir; }
      // Red de seguridad por si la imagen nunca resuelve.
      setTimeout(imprimir, 2500);
    })();
  </script>
</body>
</html>`;
}

export function abrirInformeRubro(datos: DatosInformeRubro) {
  const ventana = window.open("", "_blank");
  if (!ventana) {
    window.alert(
      "El navegador bloqueó la ventana del informe. Permití las ventanas emergentes para este sitio y volvé a intentar."
    );
    return;
  }
  ventana.document.write(construirHtml(datos));
  ventana.document.close();
}
