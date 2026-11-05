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
 * Va apaisado. Un cómputo es ancho por naturaleza cuando los niveles son
 * columnas: seis niveles con sus subtotales son columnas de sobra para A4
 * vertical. Apaisado entran cómodos hasta ocho o nueve niveles por sección;
 * pasando eso, la fila de cada ítem crece hacia abajo con sub-líneas en vez de
 * la tabla crecer para el costado, que es justo lo que esta forma evita.
 *
 * Cada ítem con más de un valor por celda —el hierro mide en metros, barras y
 * kilos a la vez; una puerta suma además uno por cada sub ítem que tenga—
 * apila esos valores en líneas dentro de la misma celda, con su etiqueta una
 * sola vez en la columna del ítem (ver `etiquetasItem`) en vez de abrir una
 * columna más por cada uno.
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
  esSeccionPuertas,
  etiquetaBultos,
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
   * PUERTAS no tiene línea de cantidad propia —en vez de eso, una línea por
   * cada sub ítem que tenga cada puerta— la misma excepción que tiene la
   * grilla en pantalla (ver `esSeccionPuertas`).
   */
  const puertas = esSeccionPuertas(seccion.seccion);

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
   * arriba. Sólo tiene sentido en el total de la columna (o en la línea de
   * +10%, que es un total con otro número adentro): las barras se compran
   * una vez para toda la obra, así que ahí —y sólo ahí— corresponde el
   * redondeo.
   */
  const valoresHierroRedondeado = (item: ItemOpcion, medido: number) => {
    const kg = kgDeMetros(item, medido);
    const bultos = bultosDe(item, kg);
    return { ml: medido, barras: bultos?.enteros ?? 0, kg };
  };

  /** Los ítems de hierro de esta sección: son los que alimentan la fila del total en kg. */
  const hierroItems = items.filter((i) => esHierro(i));
  const conTotalKg = hierroItems.length > 0;

  /** Cuántos kg suman, entre todos los diámetros, lo cargado en esta columna (un piso). */
  const totalKgFila = (fila: ClaveFila): number | null => {
    const algo = hierroItems.some((i) => tieneMedidoEnFila(i, fila));
    if (!algo) return null;
    return hierroItems.reduce((acc, i) => {
      if (!tieneMedidoEnFila(i, fila)) return acc;
      return acc + kgDeMetros(i, medidoEnFila(i, fila, datos.totales));
    }, 0);
  };

  /**
   * Una línea de hierro para una de sus lecturas elegidas. `valores` null es
   * la celda sin nada cargado: pinta raya, igual que cualquier otra línea
   * vacía.
   */
  const lineaHierro = (
    unidad: UnidadHierro,
    valores: { ml: number; barras: number; kg: number } | null,
    derivada = false
  ) => {
    const clase = `sub-linea num${unidad === "ml" ? "" : " material"}${derivada ? " derivada" : ""}`;
    const valor = valores === null ? "—" : formatCantidad(valores[unidad]);
    return `<span class="${clase}">${esc(valor)}</span>`;
  };

  /**
   * Las etiquetas apiladas de la columna del ítem: una por cada línea que su
   * celda va a apilar a la derecha, para no tener que repetirla en cada nivel.
   */
  const etiquetasItem = (item: ItemOpcion) => {
    if (esHierro(item)) {
      return columnasHierro()
        .map((u) => `<span class="etiqueta">${esc(ETIQUETA_UNIDAD_HIERRO[u])}</span>`)
        .join("");
    }
    const conversion = conversionDe(item);
    return `${
      // Un ítem de PUERTAS no tiene cantidad propia: no hay etiqueta de
      // unidad del ítem, sólo una por cada sub ítem (ver más abajo).
      puertas ? "" : `<span class="etiqueta">${esc(simboloUnidad(item.unidad))}</span>`
    }${
      conMerma(item)
        ? `<span class="etiqueta">+${esc(formatCantidad(item.desperdicio ?? 0))}%</span>`
        : ""
    }${
      tieneBultos(item)
        ? `<span class="etiqueta">${esc(etiquetaBultos([item]))}</span>`
        : ""
    }${
      conversion
        ? `<span class="etiqueta">${esc(simboloUnidad(conversion.unidad))}</span>`
        : ""
    }${
      puertas
        ? item.subItems.map((s) => `<span class="etiqueta">${esc(s.nombre)}</span>`).join("")
        : ""
    }`;
  };

  /**
   * Las líneas de los sub ítems de PUERTAS de una celda, o nada si no
   * aplica. Mismo criterio que en pantalla —"—" si el sub ítem no tiene nada
   * cargado en esa fila, en vez de un cero que confundiría "no se cargó" con
   * "no lleva este sub ítem"—.
   */
  const lineasSubItemFila = (item: ItemOpcion, fila: ClaveFila) => {
    if (!puertas || esHierro(item)) return "";
    return item.subItems
      .map((subItem) => {
        const cargado = subItemMedicionesDeFila(subItem, fila).length > 0;
        return `<span class="sub-linea num cajon">${
          cargado ? esc(formatCantidad(subItemEnFila(subItem, fila))) : "—"
        }</span>`;
      })
      .join("");
  };

  /** Lo mismo que `lineasSubItemFila`, pero para el total de toda la sección. */
  const lineasSubItemTotal = (item: ItemOpcion) => {
    if (!puertas || esHierro(item)) return "";
    return item.subItems
      .map((subItem) => {
        const total = totalSubItem(subItem);
        return `<span class="sub-linea num cajon">${
          total > 0 ? esc(formatCantidad(total)) : "—"
        }</span>`;
      })
      .join("");
  };

  /** El contenido de una celda (un ítem, un nivel): las líneas que le toquen, apiladas. */
  const celdaItem = (item: ItemOpcion, fila: ClaveFila) => {
    const tiene = tieneMedidoEnFila(item, fila);
    const medido = medidoEnFila(item, fila, datos.totales);
    const derivada = esDerivadaEnFila(item, fila);
    if (esHierro(item)) {
      const valores = tiene ? valoresHierro(item, medido) : null;
      return columnasHierro()
        .map((u) => lineaHierro(u, valores, derivada))
        .join("");
    }
    // Lo que no se computó va con raya y no con cero. En el papel esa
    // diferencia es la que dice qué falta todavía. Un ítem de PUERTAS no
    // tiene esta línea: queda reemplazada del todo por sus sub ítems (ver
    // `lineasSubItemFila`).
    const linea = puertas
      ? ""
      : `<span class="sub-linea num${derivada ? " derivada" : ""}">${esc(
          tiene ? formatCantidad(medido) : "—"
        )}</span>`;
    const merma = !conMerma(item)
      ? ""
      : `<span class="sub-linea num merma">${esc(
          tiene ? formatCantidad(conDesperdicio(medido, item.desperdicio)) : "—"
        )}</span>`;
    const material =
      conversionDe(item) === null
        ? ""
        : `<span class="sub-linea num material">${esc(
            tiene ? formatCantidad(materialDe(item, medido) ?? 0) : "—"
          )}</span>`;
    return `${linea}${merma}${material}${lineasSubItemFila(item, fila)}`;
  };

  /**
   * El contenido de la celda de Total de un ítem: lo que antes se repartía
   * entre la fila de Total, la de +10% y la de bultos, ahora apilado en la
   * única celda que le queda a cada ítem del lado derecho de su fila.
   */
  const celdaItemTotal = (item: ItemOpcion) => {
    const vacio = item.mediciones.length === 0;
    const total = datos.totales.get(item.id) ?? 0;
    if (esHierro(item)) {
      // Acá, y sólo acá, las barras ya van redondeadas para arriba: es lo
      // que efectivamente se compra.
      const valores = vacio ? null : valoresHierroRedondeado(item, total);
      const base = columnasHierro()
        .map((u) => lineaHierro(u, valores))
        .join("");
      // El margen de obra sobre el hierro: 10% fijo arriba del total, aparte
      // de la merma propia de cada diámetro (que ya está adentro del número
      // de arriba). Es el número con el que se termina pidiendo en la
      // práctica, así que va en su propia línea y no reemplaza al total.
      const valores10 = vacio ? null : valoresHierroRedondeado(item, total * 1.1);
      const extra = `<span class="sub-linea extra">+10%: ${
        valores10 === null ? "—" : esc(formatCantidad(valores10.barras))
      } barras · ${
        valores10 === null ? "—" : esc(formatCantidad(valores10.kg))
      } kg</span>`;
      return `${base}${extra}`;
    }
    const linea = puertas
      ? ""
      : `<span class="sub-linea num">${esc(vacio ? "—" : formatCantidad(total))}</span>`;
    const merma = !conMerma(item)
      ? ""
      : `<span class="sub-linea num merma">${esc(
          vacio ? "—" : formatCantidad(conDesperdicio(total, item.desperdicio))
        )}</span>`;
    const material =
      conversionDe(item) === null
        ? ""
        : `<span class="sub-linea num material">${esc(
            vacio ? "—" : formatCantidad(materialDe(item, total) ?? 0)
          )}</span>`;
    // Los bultos, sólo si hay algo que pedir por bulto. Junto al entero va el
    // exacto, más chico, que es el que dice cuánto sobra del último. Va acá y
    // no por nivel por la misma razón que en pantalla: un palet se compra una
    // vez para toda la obra, y redondear para arriba planta por planta daría
    // de más una vez por planta.
    const bultos = !tieneBultos(item)
      ? ""
      : (() => {
          const b = vacio ? null : bultosDe(item, materialDe(item, total));
          const texto =
            b === null
              ? "—"
              : `<strong>${esc(String(b.enteros))}</strong> <span class="exacto">${esc(
                  formatCantidad(b.exacto)
                )}</span>`;
          return `<span class="sub-linea num material bultos">${texto}</span>`;
        })();
    return `${linea}${merma}${material}${bultos}${lineasSubItemTotal(item)}`;
  };

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
        const tieneDescripcionPropia =
          renglones.length === 1 && !!renglones[0].descripcion?.trim();
        if (renglones.length < 2 && !tieneDescripcionPropia) return [];
        return renglones.map((medicion) => {
          const parcial = parcialMedicion(medicion, item.unidad);
          const valorCelda = esHierro(item)
            ? columnasHierro()
                .map((u) => lineaHierro(u, valoresHierro(item, parcial)))
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
          ${celdas}
          <td class="total-col"></td>
        </tr>`;
        });
      })
      .join("");

  const encabezado = `
    <tr>
      <th class="item-col">Ítem</th>
      ${filas.map((fila) => `<th class="nivel">${esc(fila.nombre)}</th>`).join("")}
      <th class="total-col">Total</th>
    </tr>`;

  const cuerpo = items
    .map((item) => {
      const celdas = filas
        .map((fila) => `<td>${celdaItem(item, fila.clave)}</td>`)
        .join("");
      return `
      <tr class="fila-item">
        <th class="item-col" scope="row">
          <div class="item-nombre">${esc(item.nombre)}</div>
          ${item.modelo ? `<div class="item-modelo">${esc(item.modelo)}</div>` : ""}
          <div class="etiquetas">${etiquetasItem(item)}</div>
        </th>
        ${celdas}
        <td class="total-col">${celdaItemTotal(item)}</td>
      </tr>
      ${datos.conDetalle ? renglonesDeItem(item) : ""}`;
    })
    .join("");

  /** Cuántos kg suman, entre todos los diámetros, los totales de toda la sección. */
  const algunHierroCargado = hierroItems.some((i) => i.mediciones.length > 0);
  const totalKgGeneral = !algunHierroCargado
    ? null
    : hierroItems.reduce((acc, item) => {
        if (item.mediciones.length === 0) return acc;
        return acc + kgDeMetros(item, datos.totales.get(item.id) ?? 0);
      }, 0);

  /**
   * El total en kg de todos los diámetros juntos, por nivel: es una suma
   * cruzada entre los ítems de hierro de cada columna, así que no tiene
   * lugar en la celda de Total de ningún ítem en particular. Por eso es la
   * única fila del pie.
   */
  const pie = !conTotalKg
    ? ""
    : `
    <tr class="total-kg-fila">
      <th class="item-col" scope="row">Total kg</th>
      ${filas
        .map((fila) => {
          const valor = totalKgFila(fila.clave);
          return `<td class="num">${esc(valor === null ? "—" : formatCantidad(valor))}</td>`;
        })
        .join("")}
      <td class="total-col">${esc(
        totalKgGeneral === null ? "—" : formatCantidad(totalKgGeneral)
      )}</td>
    </tr>`;

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

function construirHtml(datos: DatosInformeRubro) {
  const conItems = datos.secciones.filter((s) => s.items.length > 0 && s.filas.length > 0);
  const cuerpo = conItems.map((s) => tablaSeccion(s, datos)).join("");
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

    /* Apaisado: la grilla es ancha por definición. El margen lo pone @page para
       que lo respeten todas las hojas y no sólo la primera. */
    @page { size: A4 landscape; margin: 12mm; }
    @media screen {
      body { padding: 12mm; max-width: 297mm; margin: 0 auto; }
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
    tr.fila-item { background: #ebebeb; }

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

    /* Las etiquetas apiladas debajo del nombre: dicen, una sola vez, qué es
       cada línea que se apila en las celdas de la derecha, en vez de abrir
       una columna de más por cada una. */
    .etiquetas { margin-top: 2px; }
    .etiqueta {
      display: block;
      font-size: 7.5px;
      font-weight: 500;
      color: var(--gris);
      text-transform: uppercase;
      letter-spacing: 0.04em;
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
    /* Los sub ítems de PUERTAS: un tono propio, para distinguirlos de la
       línea del material aunque compartan la misma idea de "dato aparte". */
    .cajon { color: #2b5f8f; }
    .bultos .exacto { font-weight: 400; font-size: 8px; color: var(--gris); }
    /* El margen del 10% sobre el hierro: un color propio, para que se lea
       como lo que es —un extra sobre el número de arriba— y no se confunda
       con el total sin margen. */
    .extra { color: #8a5a00; font-weight: 700; }

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

    /* La fila del total en kg de todos los diámetros juntos: la única fila
       del pie, porque es una suma cruzada entre los ítems de hierro de cada
       columna y no tiene lugar en la celda de Total de ningún ítem en
       particular. */
    tfoot tr.total-kg-fila th, tfoot tr.total-kg-fila td {
      background: #e2e2e2;
      font-weight: 700;
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

  ${cuerpo || `<p class="vacio">No quedó nada para imprimir con lo que elegiste.</p>`}

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
