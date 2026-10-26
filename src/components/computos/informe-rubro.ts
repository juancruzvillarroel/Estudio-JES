/**
 * El cómputo de un rubro en papel, con la misma forma que tiene en pantalla:
 * los niveles como filas, los ítems como columnas.
 *
 * Es distinto del informe general (informe-computo.ts), que lista ítem por ítem
 * hacia abajo con todo su detalle. Los dos sirven, para cosas distintas: el
 * vertical es el que se manda a cotizar —el proveedor necesita ver de dónde
 * sale cada número—, y éste es el que se lleva a la obra o a una reunión, donde
 * lo que se busca es leer de un vistazo cuánto va en cada planta.
 *
 * Va apaisado. Un cómputo es ancho por naturaleza: seis ítems con su columna de
 * desperdicio son trece columnas, y en A4 vertical eso entra ilegible. Apaisado
 * entran cómodos hasta ocho o nueve ítems por sección; pasando eso conviene
 * partir la sección, que es además como está organizada la obra.
 *
 * Quien llama ya decide qué entra: las secciones y las filas llegan filtradas y
 * en orden. Acá no se elige nada, sólo se dibuja. Así el diálogo de descarga es
 * el único lugar donde vive esa decisión.
 */

import {
  barrasDeMetros,
  bultosDe,
  conDesperdicio,
  conversionDe,
  esDerivadaEnFila,
  esHierro,
  etiquetaBultos,
  formatCantidad,
  kgDeMetros,
  materialDe,
  medicionesDeFila,
  medidoEnFila,
  parcialMedicion,
  simboloUnidad,
  tieneMedidoEnFila,
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

  /** ¿Va la columna de la merma de este ítem? Depende de lo que se eligió bajar. */
  const conMerma = (item: ItemOpcion) =>
    datos.conDesperdicio && item.desperdicio !== null;

  /**
   * Las columnas del hierro que van impresas, en orden fijo (ml, barras, kg).
   *
   * Si no se eligió ninguna (se destildaron las tres) cae en ml y nada más: una
   * columna sola, pero una, que cero columnas dejaría al ítem sin dónde poner su
   * número.
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
   * Una celda de hierro para una de sus columnas elegidas. `valores` null es la
   * fila sin nada cargado: pinta raya, igual que cualquier otra celda vacía.
   */
  const celdaHierro = (
    unidad: UnidadHierro,
    valores: { ml: number; barras: number; kg: number } | null,
    derivada = false
  ) => {
    const clase = `num${unidad === "ml" ? "" : " material"}${derivada ? " derivada" : ""}`;
    const valor = valores === null ? "—" : formatCantidad(valores[unidad]);
    return `<td class="${clase}">${esc(valor)}</td>`;
  };

  const columnasPorItem = (item: ItemOpcion) =>
    esHierro(item)
      ? columnasHierro().length
      : 1 + (conMerma(item) ? 1 : 0) + (conversionDe(item) !== null ? 1 : 0);

  /** Las celdas numéricas vacías de un ítem, todas las que le toquen. */
  const celdasVacias = (item: ItemOpcion) => {
    if (esHierro(item)) {
      return columnasHierro()
        .map((u) => `<td class="num${u === "ml" ? "" : " material"}"></td>`)
        .join("");
    }
    return `<td class="num"></td>${conMerma(item) ? `<td class="num merma"></td>` : ""}${
      conversionDe(item) !== null ? `<td class="num material"></td>` : ""
    }`;
  };

  /**
   * Los renglones que hay detrás de las celdas desglosadas de una fila, cada uno
   * como su propia fila de la tabla.
   *
   * Si las columnas de la planta baja se cargaron como C1, C2 y C3, en el papel
   * aparecen las tres abajo de PLANTA BAJA, cada una con su número en la columna
   * del ítem del que salió. Así se puede tildar una por una en la obra —que es
   * para lo que se lleva esta hoja— y la cuenta queda a la vista: los renglones
   * tienen que dar el número de arriba.
   *
   * Justamente por eso se imprime el parcial ya resuelto y no el campo
   * `cantidad`: un renglón viejo que tiene largo y ancho, o uno que descuenta,
   * aporta algo distinto de lo que dice ese campo. Una columna de números que no
   * cierran con su total es peor que no imprimir el detalle.
   *
   * El nombre del renglón va en la columna de los niveles y el número en la del
   * ítem: alcanza para saber de qué ítem es sin repetir su nombre en cada línea,
   * y deja las columnas derechas, que es lo que permite seguir leyendo la hoja.
   *
   * Sólo se desglosan las celdas de dos renglones o más. Una celda de un solo
   * renglón ya es su propio detalle: repetirla abajo es imprimir dos veces el
   * mismo número. Las derivadas no se tocan, que no tienen renglones que mostrar.
   */
  const renglonesDe = (fila: ClaveFila) =>
    items
      .flatMap((item, indice) => {
        const renglones = medicionesDeFila(item, fila).filter(
          (m) => m.origenId === null
        );
        if (renglones.length < 2) return [];
        return renglones.map((medicion) => {
          const celdas = items
            .map((otro, i) => {
              if (i !== indice) return celdasVacias(otro);
              const parcial = parcialMedicion(medicion, item.unidad);
              if (esHierro(otro)) {
                const valores = valoresHierro(otro, parcial);
                return columnasHierro()
                  .map((u) => celdaHierro(u, valores))
                  .join("");
              }
              return `<td class="num">${esc(formatCantidad(parcial))}</td>${
                conMerma(otro) ? `<td class="num merma"></td>` : ""
              }${conversionDe(otro) !== null ? `<td class="num material"></td>` : ""}`;
            })
            .join("");
          return `
        <tr class="renglon">
          <th class="nivel-col renglon-nombre" scope="row">${esc(
            medicion.descripcion ?? "—"
          )}</th>
          ${celdas}
        </tr>`;
        });
      })
      .join("");

  const encabezado = `
    <tr>
      <th class="nivel-col">Nivel</th>
      ${items
        .map(
          (item) => `
        <th class="item" colspan="${columnasPorItem(item)}">
          <div class="item-nombre">${esc(item.nombre)}</div>
          <div class="item-unidad">${esc(simboloUnidad(item.unidad))}</div>
        </th>`
        )
        .join("")}
    </tr>
    <tr class="sub">
      <th></th>
      ${items
        .map((item) => {
          if (esHierro(item)) {
            return columnasHierro()
              .map(
                (u) =>
                  `<th class="num${u === "ml" ? "" : " material"}">${esc(
                    ETIQUETA_UNIDAD_HIERRO[u]
                  )}</th>`
              )
              .join("");
          }
          const conversion = conversionDe(item);
          return `<th class="num">medido</th>${
            conMerma(item)
              ? `<th class="num merma">+${esc(formatCantidad(item.desperdicio ?? 0))}%</th>`
              : ""
          }${
            conversion
              ? `<th class="num material">×${esc(
                  formatCantidad(conversion.rinde)
                )} ${esc(simboloUnidad(conversion.unidad))}</th>`
              : ""
          }`;
        })
        .join("")}
    </tr>`;

  const cuerpo = filas
    .map((fila) => {
      const celdas = items
        .map((item) => {
          const tiene = tieneMedidoEnFila(item, fila.clave);
          const medido = medidoEnFila(item, fila.clave, datos.totales);
          const derivada = esDerivadaEnFila(item, fila.clave);
          if (esHierro(item)) {
            const valores = tiene ? valoresHierro(item, medido) : null;
            return columnasHierro()
              .map((u) => celdaHierro(u, valores, derivada))
              .join("");
          }
          // Lo que no se computó va con raya y no con cero. En el papel esa
          // diferencia es la que dice qué falta todavía.
          const valor = tiene ? formatCantidad(medido) : "—";
          const merma =
            !conMerma(item)
              ? ""
              : `<td class="num merma">${esc(
                  tiene ? formatCantidad(conDesperdicio(medido, item.desperdicio)) : "—"
                )}</td>`;
          const material =
            conversionDe(item) === null
              ? ""
              : `<td class="num material">${esc(
                  tiene ? formatCantidad(materialDe(item, medido) ?? 0) : "—"
                )}</td>`;
          return `<td class="num${derivada ? " derivada" : ""}">${esc(
            valor
          )}</td>${merma}${material}`;
        })
        .join("");

      return `
        <tr>
          <th class="nivel-col" scope="row">${esc(fila.nombre)}</th>
          ${celdas}
        </tr>
        ${datos.conDetalle ? renglonesDe(fila.clave) : ""}`;
    })
    .join("");

  const filaTotal = `
    <tr class="total">
      <th class="nivel-col" scope="row">Total</th>
      ${items
        .map((item) => {
          const total = datos.totales.get(item.id) ?? 0;
          const vacio = item.mediciones.length === 0;
          if (esHierro(item)) {
            const valores = vacio ? null : valoresHierro(item, total);
            return columnasHierro()
              .map((u) => celdaHierro(u, valores))
              .join("");
          }
          const merma = !conMerma(item)
            ? ""
            : `<td class="num merma">${esc(
                vacio ? "—" : formatCantidad(conDesperdicio(total, item.desperdicio))
              )}</td>`;
          const material =
            conversionDe(item) === null
              ? ""
              : `<td class="num material">${esc(
                  vacio ? "—" : formatCantidad(materialDe(item, total) ?? 0)
                )}</td>`;
          return `<td class="num">${esc(
            vacio ? "—" : formatCantidad(total)
          )}</td>${merma}${material}`;
        })
        .join("")}
    </tr>`;

  /**
   * La fila de los bultos, sólo si hay algo que pedir por bulto.
   *
   * Va abajo del total y no por nivel por la misma razón que en pantalla: un
   * palet se compra una vez para toda la obra, y redondear para arriba planta
   * por planta daría de más una vez por planta. Junto al entero va el exacto,
   * más chico, que es el que dice cuánto sobra del último.
   */
  const conBulto = items.filter(
    (i) => i.porBulto !== null && conversionDe(i) !== null
  );
  const etiquetaBulto = etiquetaBultos(conBulto);

  const filaBultos =
    conBulto.length === 0
      ? ""
      : `
    <tr class="bultos">
      <th class="nivel-col" scope="row">${esc(etiquetaBulto)}</th>
      ${items
        .map((item) => {
          const total = datos.totales.get(item.id) ?? 0;
          const bultos =
            item.mediciones.length === 0
              ? null
              : bultosDe(item, materialDe(item, total));
          const texto =
            bultos === null
              ? "—"
              : `<strong>${esc(String(bultos.enteros))}</strong> <span class="exacto">${esc(
                  formatCantidad(bultos.exacto)
                )}</span>`;
          // El hierro ya tiene sus propias columnas (ml/barras/kg, las que se
          // elijan): el total de barras a pedir va adentro de la que
          // corresponda —"barras" si está, o la primera que haya— y el resto
          // vacías, para no desarmar el colspan del encabezado.
          if (esHierro(item)) {
            const columnas = columnasHierro();
            const indice = Math.max(columnas.indexOf("barras"), 0);
            return columnas
              .map((_, i) =>
                i === indice ? `<td class="num material">${texto}</td>` : `<td></td>`
              )
              .join("");
          }
          const vacios = `<td></td>${conMerma(item) ? `<td class="merma"></td>` : ""}`;
          if (conversionDe(item) === null) return vacios;
          return `${vacios}<td class="num material">${texto}</td>`;
        })
        .join("")}
    </tr>`;

  const pie = `${filaTotal}${filaBultos}`;

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
        <tfoot>${pie}</tfoot>
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

    table.grilla { width: 100%; border-collapse: collapse; }
    table.grilla th, table.grilla td {
      border: 1px solid var(--linea);
      padding: 3px 5px;
      break-inside: avoid;
    }

    /* La columna de niveles es la que se lee para saber de qué fila es cada
       número: va en gris, alineada a la izquierda, y no se corta. */
    .nivel-col {
      text-align: left;
      font-weight: 600;
      background: #f2f2f2;
      width: 26mm;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    thead th.item {
      background: #ebebeb;
      font-size: 10px;
      vertical-align: bottom;
    }
    thead th.item .item-nombre { font-weight: 700; }
    thead th.item .item-unidad { font-weight: 400; color: var(--gris); font-size: 8.5px; }
    thead tr.sub th {
      background: #f7f7f7;
      font-size: 8px;
      font-weight: 500;
      color: var(--gris);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    /* La columna del desperdicio, más clara: es la derivada de al lado, no un
       dato independiente, y en gris se lee como lo que es. */
    .merma { background: #fafafa; color: var(--gris); }
    /* Las celdas que salen de una cuenta sobre otro ítem, en bastardilla: se ve
       de un vistazo qué se midió en obra y qué se calculó. */
    .derivada { font-style: italic; color: var(--gris); }
    /* La columna del material, un tono más marcada: es la que se copia al
       pedido, así que tiene que encontrarse sin buscarla. */
    .material { background: #f0f0f0; font-weight: 600; }

    tfoot tr.total th, tfoot tr.total td {
      background: #e2e2e2;
      font-weight: 700;
      border-top: 2px solid var(--oscuro);
    }
    tfoot tr.bultos th, tfoot tr.bultos td { background: #ededed; }
    tfoot tr.bultos th.nivel-col { font-size: 8.5px; }
    tfoot tr.bultos td.material { font-size: 11px; }
    tfoot tr.bultos .exacto { font-weight: 400; font-size: 8px; color: var(--gris); }

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
         arriba y no es un nivel más. */
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
