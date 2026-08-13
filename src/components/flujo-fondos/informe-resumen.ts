/**
 * Genera el informe imprimible del resumen de flujo de fondos.
 *
 * Se arma como un documento HTML independiente que se abre en una pestaña
 * nueva y dispara el diálogo de impresión del navegador (de ahí se guarda como
 * PDF). Se hace así, y no con `@media print` sobre la app, para que el papel no
 * arrastre la navegación ni las pestañas, y para no sumar una dependencia de
 * generación de PDF.
 *
 * El módulo es puramente de presentación: recibe todos los números ya
 * calculados y formateados por el componente del resumen.
 */

/** Paleta fija para los rubros: mismo orden ⇒ mismo color entre informes. */
const COLORES_RUBRO = [
  "#2f6fb3",
  "#e2711d",
  "#4c9a6a",
  "#f5b301",
  "#8e5ea2",
  "#c0504d",
  "#17a2b8",
  "#e07a5f",
  "#5b9bd5",
  "#7f8c8d",
];

export type FilaInversorInforme = {
  nombre: string;
  porcentaje: number;
  aportadoTexto: string;
  correspondeTexto: string;
  saldoTexto: string;
  saldoNegativo: boolean;
};

export type BloqueInforme = {
  titulo: string;
  aportadoTexto: string;
  gastadoTexto: string;
  saldoTexto: string;
  saldoNegativo: boolean;
  /** Porcentaje del aporte que ya se ejecutó, para la barra de progreso. */
  ejecutado: number;
  filas: FilaInversorInforme[];
};

export type RubroInforme = {
  etiqueta: string;
  montoTexto: string;
  /** Participación sobre el gasto total del período. */
  porcentaje: number;
};

export type MedioPagoInforme = {
  nombre: string;
  montoTexto: string;
  porcentaje: number;
  facturado: boolean;
};

export type FacturacionInforme = {
  facturadoTexto: string;
  noFacturadoTexto: string;
  facturadoPorcentaje: number;
  noFacturadoPorcentaje: number;
  cantidadFacturados: number;
  cantidadNoFacturados: number;
  medios: MedioPagoInforme[];
};

export type DatosInforme = {
  proyectoNombre: string;
  leyendaRango: string;
  generadoEl: string;
  consolidado: BloqueInforme;
  porMoneda: BloqueInforme[];
  sinTipoCambio: number;
  rubros: RubroInforme[];
  facturacion: FacturacionInforme | null;
  gastoTotalTexto: string;
  costoM2: {
    superficieTexto: string;
    totalTexto: string;
    terrenoPorM2Texto: string;
    terrenoTotalTexto: string;
    terrenoPorcentaje: number;
    construccionPorM2Texto: string;
    construccionTotalTexto: string;
    construccionPorcentaje: number;
  } | null;
  ventas: {
    vendidoTexto: string;
    cantidadUSD: number;
    cantidadARS: number;
    m2VendidosTexto: string;
    avanceM2: number | null;
    promedioTexto: string;
    resultadoTexto: string;
    resultadoNegativo: boolean;
  } | null;
};

/** Escapa el texto que se inyecta en el HTML del informe. */
function esc(texto: string) {
  return texto.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

function ancho(porcentaje: number) {
  return Math.min(Math.max(porcentaje, 0), 100).toFixed(2);
}

function claseSaldo(negativo: boolean) {
  return negativo ? "neg" : "pos";
}

function tablaInversores(filas: FilaInversorInforme[]) {
  if (filas.length === 0) return "";
  return `
    <table class="inversores">
      <thead>
        <tr>
          <th>Inversor</th>
          <th class="num">Part.</th>
          <th class="num">Aportó</th>
          <th class="num">Le corresponde</th>
          <th class="num">Saldo</th>
        </tr>
      </thead>
      <tbody>
        ${filas
          .map(
            (f) => `
        <tr>
          <td class="nombre">${esc(f.nombre)}</td>
          <td class="num tenue">${f.porcentaje}%</td>
          <td class="num grande">${esc(f.aportadoTexto)}</td>
          <td class="num tenue">${esc(f.correspondeTexto)}</td>
          <td class="num fuerte ${claseSaldo(f.saldoNegativo)}">${esc(f.saldoTexto)}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

/** Bloque secundario (una moneda), en formato tarjeta compacta. */
function tarjetaMoneda(b: BloqueInforme) {
  return `
  <section class="tarjeta">
    <h3>${esc(b.titulo)}</h3>
    <div class="cuerpo">
      <div class="linea"><span>Aportado</span><span class="num">${esc(b.aportadoTexto)}</span></div>
      <div class="linea"><span>Gastado</span><span class="num">${esc(b.gastadoTexto)}</span></div>
      <div class="progreso compacta">
        <div class="pista"><div class="relleno" style="width:${ancho(b.ejecutado)}%"></div></div>
      </div>
      <div class="linea total"><span>Saldo</span><span class="num ${claseSaldo(
        b.saldoNegativo
      )}">${esc(b.saldoTexto)}</span></div>
      ${
        b.filas.length > 0
          ? `<table class="inversores compacta">
        <thead><tr><th>Inversor</th><th class="num">Aportó</th><th class="num">Saldo</th></tr></thead>
        <tbody>
          ${b.filas
            .map(
              (f) => `<tr>
            <td class="nombre">${esc(f.nombre)} <span class="tenue">${f.porcentaje}%</span></td>
            <td class="num grande">${esc(f.aportadoTexto)}</td>
            <td class="num fuerte ${claseSaldo(f.saldoNegativo)}">${esc(f.saldoTexto)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>`
          : ""
      }
    </div>
  </section>`;
}

function seccionRubros(rubros: RubroInforme[], gastoTotalTexto: string) {
  if (rubros.length === 0) {
    return `<p class="vacio">No hay gastos con rubro asignado en el período seleccionado.</p>`;
  }

  // La barra de cada fila se mide contra el rubro más grande: así el mayor
  // llena la celda y las diferencias entre rubros se leen de un vistazo.
  const mayor = Math.max(...rubros.map((r) => r.porcentaje));

  const apilada = rubros
    .map(
      (r, i) =>
        `<div style="width:${ancho(r.porcentaje)}%;background:${
          COLORES_RUBRO[i % COLORES_RUBRO.length]
        }" title="${esc(r.etiqueta)}"></div>`
    )
    .join("");

  const filas = rubros
    .map((r, i) => {
      const color = COLORES_RUBRO[i % COLORES_RUBRO.length];
      const relativo = mayor > 0 ? (r.porcentaje / mayor) * 100 : 0;
      return `
      <tr>
        <td class="nombre"><span class="punto" style="background:${color}"></span>${esc(
          r.etiqueta
        )}</td>
        <td class="celda-barra">
          <div class="barra"><div style="width:${ancho(relativo)}%;background:${color}"></div></div>
        </td>
        <td class="num grande">${esc(r.montoTexto)}</td>
        <td class="num pct">${r.porcentaje.toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}%</td>
      </tr>`;
    })
    .join("");

  return `
  <div class="apilada">${apilada}</div>
  <table class="rubros">
    <thead>
      <tr>
        <th>Rubro</th>
        <th class="celda-barra"></th>
        <th class="num">Gastado</th>
        <th class="num">Part.</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr>
        <td class="nombre">Total del período</td>
        <td></td>
        <td class="num">${esc(gastoTotalTexto)}</td>
        <td class="num">100%</td>
      </tr>
    </tfoot>
  </table>`;
}

const COLOR_FACTURADO = "#177245";
const COLOR_SIN_FACTURA = "#9a9a9a";

function seccionFacturacion(f: FacturacionInforme | null) {
  if (!f) return "";

  const plural = (n: number) => (n === 1 ? "gasto" : "gastos");
  const pct = (valor: number) => valor.toLocaleString("es-AR", { maximumFractionDigits: 1 });

  const filas = f.medios
    .map((m) => {
      const color = m.facturado ? COLOR_FACTURADO : COLOR_SIN_FACTURA;
      return `
      <tr>
        <td class="nombre"><span class="punto" style="background:${color}"></span>${esc(
          m.nombre
        )}</td>
        <td class="num tenue">${m.facturado ? "Con factura" : "Sin factura"}</td>
        <td class="num grande">${esc(m.montoTexto)}</td>
        <td class="num pct">${pct(m.porcentaje)}%</td>
      </tr>`;
    })
    .join("");

  return `
  <h2 class="seccion">
    <span>Facturación de gastos</span>
    <span class="chip">${pct(f.facturadoPorcentaje)}% facturado</span>
  </h2>
  <div class="kpis">
    <div class="kpi destacada">
      <span>Con factura (IVA)</span>
      <strong class="pos">${esc(f.facturadoTexto)}</strong>
    </div>
    <div class="kpi">
      <span>Sin factura</span>
      <strong>${esc(f.noFacturadoTexto)}</strong>
    </div>
  </div>
  <div class="apilada">
    <div style="width:${ancho(f.facturadoPorcentaje)}%;background:${COLOR_FACTURADO}"></div>
    <div style="width:${ancho(f.noFacturadoPorcentaje)}%;background:${COLOR_SIN_FACTURA}"></div>
  </div>
  <table class="rubros">
    <thead>
      <tr>
        <th>Medio de pago</th>
        <th class="num"></th>
        <th class="num">Gastado</th>
        <th class="num">Part.</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <p class="nota">
    ${f.cantidadFacturados} ${plural(f.cantidadFacturados)} con factura y
    ${f.cantidadNoFacturados} ${plural(f.cantidadNoFacturados)} sin factura.
    Un gasto se considera facturado según el medio de pago con el que se abonó.
  </p>`;
}

function seccionCostoM2(costo: DatosInforme["costoM2"]) {
  if (!costo) {
    return `<p class="vacio">No hay m² vendibles cargados en el proyecto, así que no se puede calcular el costo por m².</p>`;
  }

  return `
  <div class="kpis">
    <div class="kpi destacada">
      <span>Costo total por m²</span>
      <strong>${esc(costo.totalTexto)}</strong>
    </div>
    <div class="kpi">
      <span>Superficie vendible</span>
      <strong>${esc(costo.superficieTexto)}</strong>
    </div>
  </div>
  <div class="apilada">
    <div style="width:${ancho(costo.terrenoPorcentaje)}%;background:#e2711d"></div>
    <div style="width:${ancho(costo.construccionPorcentaje)}%;background:#2f6fb3"></div>
  </div>
  <table class="rubros">
    <tbody>
      <tr>
        <td class="nombre"><span class="punto" style="background:#e2711d"></span>Incidencia del terreno</td>
        <td class="num grande">${esc(costo.terrenoPorM2Texto)}</td>
        <td class="num tenue">${esc(costo.terrenoTotalTexto)}</td>
        <td class="num pct">${costo.terrenoPorcentaje.toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}%</td>
      </tr>
      <tr>
        <td class="nombre"><span class="punto" style="background:#2f6fb3"></span>Costo de construcción</td>
        <td class="num grande">${esc(costo.construccionPorM2Texto)}</td>
        <td class="num tenue">${esc(costo.construccionTotalTexto)}</td>
        <td class="num pct">${costo.construccionPorcentaje.toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}%</td>
      </tr>
    </tbody>
  </table>
  <p class="nota">La incidencia toma lo gastado en el rubro de adquisición de terreno; la construcción, todo el resto.</p>`;
}

function seccionVentas(ventas: DatosInforme["ventas"]) {
  if (!ventas) return "";

  return `
  <h2 class="seccion">Ventas y resultado</h2>
  <div class="kpis">
    <div class="kpi">
      <span>Vendido</span>
      <strong>${esc(ventas.vendidoTexto)}</strong>
    </div>
    <div class="kpi destacada">
      <span>Resultado bruto</span>
      <strong class="${claseSaldo(ventas.resultadoNegativo)}">${esc(ventas.resultadoTexto)}</strong>
    </div>
  </div>
  ${
    ventas.avanceM2 != null
      ? `<div class="progreso">
    <div class="pista"><div class="relleno verde" style="width:${ancho(ventas.avanceM2)}%"></div></div>
    <div class="pie"><span>m² vendidos</span><span>${esc(ventas.m2VendidosTexto)}</span></div>
  </div>`
      : ""
  }
  <table class="rubros">
    <tbody>
      <tr><td class="nombre">Unidades vendidas (en dólares)</td><td class="num grande">${
        ventas.cantidadUSD
      }</td></tr>
      <tr><td class="nombre">Precio promedio de venta</td><td class="num grande">${esc(
        ventas.promedioTexto
      )}</td></tr>
    </tbody>
  </table>
  ${
    ventas.cantidadARS > 0
      ? `<p class="nota">${ventas.cantidadARS} ${
          ventas.cantidadARS === 1
            ? "venta en pesos no se incluye"
            : "ventas en pesos no se incluyen"
        } en estos totales.</p>`
      : ""
  }`;
}

/**
 * La ventana del informe se abre en `about:blank`, que no tiene una URL base
 * contra la cual resolver rutas relativas. Por eso el logo se pide con la URL
 * absoluta del origen de la app.
 */
function urlLogo() {
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  return `${origen}/logo-jes.png`;
}

function encabezado(d: DatosInforme, mini: boolean, subtitulo: string) {
  return `
  <header class="doc${mini ? " mini" : ""}">
    <img class="logo" ${mini ? "" : 'id="logo"'} src="${urlLogo()}" alt="JES & arqs" />
    <div>
      <h1>${esc(d.proyectoNombre)}</h1>
      <p>${esc(subtitulo)}</p>
      ${
        mini
          ? ""
          : `<p class="meta">${esc(d.leyendaRango)} · Generado el ${esc(d.generadoEl)}</p>`
      }
    </div>
  </header>`;
}

function construirHtml(d: DatosInforme) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Resumen de flujo de fondos - ${esc(d.proyectoNombre)}</title>
  <style>
    :root {
      --tinta: #1f1f1f;
      --gris: #6f6f6f;
      --linea: #e4e4e4;
      --oscuro: #2b2b2b;
      --verde: #177245;
      --rojo: #b3261e;
      --acento: #2f6fb3;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: var(--tinta);
      font-size: 11px;
      line-height: 1.4;
      padding: 18mm 14mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .hoja { break-after: page; page-break-after: always; }
    .hoja:last-child { break-after: auto; page-break-after: auto; }

    header.doc {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid var(--oscuro);
      padding-bottom: 12px;
      margin-bottom: 6px;
    }
    header.doc .logo { width: 62px; height: auto; }
    header.doc h1 { font-size: 19px; margin: 0; letter-spacing: -0.01em; }
    header.doc p { margin: 2px 0 0; color: var(--gris); font-size: 10.5px; }
    header.doc .meta { font-size: 9.5px; }
    header.doc.mini { border-bottom-width: 2px; margin-bottom: 4px; }
    header.doc.mini .logo { width: 42px; }
    header.doc.mini h1 { font-size: 14px; }

    h2.seccion {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--oscuro);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 7px 12px;
      border-radius: 5px;
      margin: 20px 0 12px;
    }
    h2.seccion .chip {
      background: rgba(255, 255, 255, 0.18);
      border-radius: 99px;
      padding: 2px 9px;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .kpis { display: flex; gap: 10px; margin-bottom: 12px; }
    .kpi {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--linea);
      border-radius: 8px;
      padding: 10px 12px;
      background: #fafafa;
    }
    .kpi span {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--gris);
      margin-bottom: 3px;
    }
    .kpi strong { font-size: 19px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .kpi.destacada { background: var(--oscuro); border-color: var(--oscuro); }
    .kpi.destacada span { color: rgba(255, 255, 255, 0.68); }
    .kpi.destacada strong { color: #fff; }
    .kpi.destacada .pos { color: #7ee2a8; }
    .kpi.destacada .neg { color: #ff9d92; }
    .pos { color: var(--verde); }
    .neg { color: var(--rojo); }

    .progreso { margin-bottom: 14px; }
    .progreso.compacta { margin: 6px 0 4px; }
    .progreso .pista { height: 7px; border-radius: 99px; background: #ececec; overflow: hidden; }
    .progreso .relleno { height: 100%; background: var(--acento); border-radius: 99px; }
    .progreso .relleno.verde { background: var(--verde); }
    .progreso .pie {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: var(--gris);
      margin-top: 4px;
    }

    table { width: 100%; border-collapse: collapse; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .tenue { color: var(--gris); }
    .fuerte { font-weight: 700; }
    .grande { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
    td.nombre { font-weight: 500; }

    table.inversores { margin-top: 4px; }
    table.inversores th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--gris);
      text-align: left;
      font-weight: 600;
      padding: 0 8px 5px;
      border-bottom: 1.5px solid var(--oscuro);
    }
    table.inversores td { padding: 7px 8px; border-bottom: 1px solid var(--linea); }
    table.inversores tbody tr:last-child td { border-bottom: none; }
    table.inversores.compacta th { font-size: 8.5px; padding-bottom: 4px; }
    table.inversores.compacta td { padding: 5px 4px; font-size: 10px; }
    table.inversores.compacta .grande { font-size: 11.5px; }

    .columnas { display: flex; gap: 14px; align-items: flex-start; }
    .columnas > * { flex: 1; min-width: 0; }
    .tarjeta { border: 1px solid var(--linea); border-radius: 8px; overflow: hidden; break-inside: avoid; }
    .tarjeta h3 { margin: 0; background: #f1f1f1; padding: 7px 10px; font-size: 11px; font-weight: 600; }
    .tarjeta .cuerpo { padding: 10px; }
    .linea { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: 10.5px; color: var(--gris); }
    .linea .num { color: var(--tinta); font-weight: 500; }
    .linea.total {
      border-top: 1px solid var(--oscuro);
      margin-top: 5px;
      padding-top: 6px;
      color: var(--tinta);
      font-weight: 600;
    }
    .linea.total .num { font-size: 13px; font-weight: 700; }

    .apilada {
      display: flex;
      height: 14px;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 14px;
      background: #ececec;
    }
    .apilada > div { height: 100%; }

    table.rubros td { padding: 6px 8px; border-bottom: 1px solid var(--linea); }
    table.rubros th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--gris);
      text-align: left;
      font-weight: 600;
      padding: 0 8px 5px;
      border-bottom: 1.5px solid var(--oscuro);
    }
    table.rubros tfoot td {
      border-bottom: none;
      border-top: 1.5px solid var(--oscuro);
      font-weight: 700;
      padding-top: 7px;
    }
    .punto { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 7px; vertical-align: middle; }
    td.celda-barra, th.celda-barra { width: 34%; }
    .barra { background: #f0f0f0; border-radius: 3px; height: 9px; width: 100%; overflow: hidden; }
    .barra > div { height: 100%; border-radius: 3px; }
    .pct { width: 52px; color: var(--gris); }

    .nota, .vacio { font-size: 9.5px; color: var(--gris); margin: 8px 0 0; }
    .bloque { break-inside: avoid; page-break-inside: avoid; }

    @page { size: A4; margin: 0; }
    @media print { body { padding: 14mm; } }
  </style>
</head>
<body>
  <div class="hoja">
    ${encabezado(d, false, "Resumen de flujo de fondos")}

    <h2 class="seccion">
      <span>${esc(d.consolidado.titulo)}</span>
      <span class="chip">Consolidado</span>
    </h2>

    <div class="kpis">
      <div class="kpi"><span>Aportado</span><strong>${esc(
        d.consolidado.aportadoTexto
      )}</strong></div>
      <div class="kpi"><span>Gastado</span><strong>${esc(d.consolidado.gastadoTexto)}</strong></div>
      <div class="kpi destacada"><span>Saldo</span><strong class="${claseSaldo(
        d.consolidado.saldoNegativo
      )}">${esc(d.consolidado.saldoTexto)}</strong></div>
    </div>

    <div class="progreso">
      <div class="pista"><div class="relleno" style="width:${ancho(
        d.consolidado.ejecutado
      )}%"></div></div>
      <div class="pie"><span>Ejecución del aporte</span><span>${d.consolidado.ejecutado.toLocaleString(
        "es-AR",
        { maximumFractionDigits: 1 }
      )}%</span></div>
    </div>

    ${tablaInversores(d.consolidado.filas)}

    ${
      d.sinTipoCambio > 0
        ? `<p class="nota">${d.sinTipoCambio} ${
            d.sinTipoCambio === 1
              ? "movimiento en pesos sin tipo de cambio queda fuera"
              : "movimientos en pesos sin tipo de cambio quedan fuera"
          } del consolidado.</p>`
        : ""
    }

    <h2 class="seccion"><span>Detalle por moneda</span></h2>
    <div class="columnas">
      ${d.porMoneda.map(tarjetaMoneda).join("")}
    </div>
  </div>

  <div class="hoja">
    ${encabezado(d, true, "Gastos por rubro")}
    <h2 class="seccion">
      <span>Gastos por rubro</span>
      <span class="chip">${esc(d.leyendaRango)}</span>
    </h2>
    ${seccionRubros(d.rubros, d.gastoTotalTexto)}
    ${d.facturacion ? `<div class="bloque">${seccionFacturacion(d.facturacion)}</div>` : ""}
  </div>

  <div>
    ${encabezado(d, true, "Costo por m² y resultado")}
    <h2 class="seccion"><span>Costo por m² vendible</span></h2>
    ${seccionCostoM2(d.costoM2)}
    ${seccionVentas(d.ventas)}
  </div>

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

export function abrirInformeResumen(datos: DatosInforme) {
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
