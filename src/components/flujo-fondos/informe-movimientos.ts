/**
 * Informe imprimible del listado de gastos o de aportes.
 *
 * Funciona igual que el del Resumen (ver informe-resumen.ts): un HTML aparte que
 * se abre en otra pestaña y dispara el diálogo de impresión, desde donde se
 * guarda como PDF. Recibe los movimientos ya filtrados por la pantalla, así que
 * el papel trae exactamente lo que se estaba viendo: el rango de fechas y los
 * demás filtros que hubiera.
 */
import { esc, urlLogo } from "@/components/flujo-fondos/informe-resumen";
import { montoEntrante, otraMoneda } from "@/lib/cambios-moneda";
import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";

type Moneda = "ARS" | "USD";

export type DatosInformeMovimientos = {
  proyectoNombre: string;
  tipo: "GASTO" | "APORTE";
  /** "Período: 01/10/2026 a 31/10/2026" o "Período: todas las fechas". */
  leyendaRango: string;
  /** Los otros filtros activos, ya en texto ("Rubro: Albañilería"). */
  filtros: string[];
  movimientos: MovimientoFondoOpcion[];
};

function monto(valor: number, moneda: Moneda) {
  const numero = valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneda === "USD" ? `USD ${numero}` : `$ ${numero}`;
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "UTC" });
}

/**
 * Equivalente en la otra moneda según el tipo de cambio del movimiento. Se
 * muestra en el papel porque es lo que se usa para consolidar en dólares.
 */
function equivalente(m: MovimientoFondoOpcion) {
  if (!m.tipoCambio) return "—";
  return m.moneda === "ARS"
    ? monto(m.monto / m.tipoCambio, "USD")
    : monto(m.monto * m.tipoCambio, "ARS");
}

function filaGasto(m: MovimientoFondoOpcion) {
  const rubro = [m.rubroNombre ?? "Sin rubro", m.subrubroNombre].filter(Boolean).join(" · ");
  return `
    <tr>
      <td class="fecha">${fecha(m.fecha)}</td>
      <td><strong>${esc(rubro)}</strong><div class="sub">${esc(m.proveedorNombre ?? "Sin proveedor")}</div></td>
      <td>${esc(m.descripcion || "—")}</td>
      <td>${esc(m.medioPagoNombre ?? "—")}${m.facturado ? '<div class="sub">Facturado</div>' : ""}</td>
      <td class="num ${m.moneda === "USD" ? "usd" : ""}">${monto(m.monto, m.moneda)}</td>
      <td class="num tc">${m.tipoCambio ? `$ ${m.tipoCambio}` : "—"}</td>
      <td class="num tc">${equivalente(m)}</td>
    </tr>`;
}

function filaAporte(m: MovimientoFondoOpcion) {
  if (m.tipo === "CAMBIO") {
    const entra = otraMoneda(m.moneda);
    return `
    <tr class="cambio">
      <td class="fecha">${fecha(m.fecha)}</td>
      <td><strong>${m.moneda === "USD" ? "Cambio de dólares a pesos" : "Cambio de pesos a dólares"}</strong></td>
      <td>${esc(m.descripcion || "—")}</td>
      <td class="num"><span class="neg">−${monto(m.monto, m.moneda)}</span><div class="pos">+${monto(montoEntrante(m), entra)}</div></td>
      <td class="num tc">${m.tipoCambio ? `$ ${m.tipoCambio}` : "—"}</td>
      <td class="num tc">—</td>
    </tr>`;
  }
  return `
    <tr>
      <td class="fecha">${fecha(m.fecha)}</td>
      <td><strong>${esc(m.inversorNombre ?? "Sin inversor")}</strong></td>
      <td>${esc(m.descripcion || "—")}</td>
      <td class="num ${m.moneda === "USD" ? "usd" : ""}">${monto(m.monto, m.moneda)}</td>
      <td class="num tc">${m.tipoCambio ? `$ ${m.tipoCambio}` : "—"}</td>
      <td class="num tc">${equivalente(m)}</td>
    </tr>`;
}

function construirHtml(d: DatosInformeMovimientos) {
  const esGasto = d.tipo === "GASTO";
  const titulo = esGasto ? "Gastos" : "Aportes";
  // En el papel se lee de arriba hacia abajo como un libro: del más viejo al
  // más nuevo, al revés que la pantalla, que muestra primero lo último cargado.
  const ordenados = [...d.movimientos].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.createdAt.localeCompare(b.createdAt)
  );

  // Los totales son solo de gastos o aportes: un cambio de moneda no es plata
  // nueva (igual que en la pantalla y en el Resumen).
  const propios = ordenados.filter((m) => m.tipo !== "CAMBIO");
  const total = (moneda: Moneda) =>
    propios.filter((m) => m.moneda === moneda).reduce((acc, m) => acc + m.monto, 0);
  const totalEnUSD = propios.reduce(
    (acc, m) => acc + (m.moneda === "USD" ? m.monto : m.tipoCambio ? m.monto / m.tipoCambio : 0),
    0
  );
  const sinTipoCambio = propios.filter((m) => m.moneda === "ARS" && !m.tipoCambio).length;
  const cantidadCambios = ordenados.length - propios.length;

  const encabezadoTabla = esGasto
    ? `<th>Fecha</th><th>Rubro / Proveedor</th><th>Descripción</th><th>Medio de pago</th><th class="num">Monto</th><th class="num">TC</th><th class="num">Equivale</th>`
    : `<th>Fecha</th><th>Inversor</th><th>Descripción</th><th class="num">Monto</th><th class="num">TC</th><th class="num">Equivale</th>`;

  const cuerpo =
    ordenados.length === 0
      ? `<tr><td colspan="${esGasto ? 7 : 6}" class="vacio">No hay ${titulo.toLowerCase()} en este período.</td></tr>`
      : ordenados.map(esGasto ? filaGasto : filaAporte).join("");

  const generado = new Date().toLocaleDateString("es-AR");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${titulo} - ${esc(d.proyectoNombre)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #1f1f1f;
      font-size: 10px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #2b2b2b; padding-bottom: 10px; }
    header img { width: 56px; height: auto; }
    header h1 { font-size: 17px; margin: 0; }
    header p { margin: 2px 0 0; color: #6f6f6f; font-size: 10px; }
    .filtros { margin: 8px 0 0; color: #6f6f6f; font-size: 9.5px; }
    .kpis { display: flex; gap: 8px; margin: 12px 0; }
    .kpi { flex: 1; border: 1px solid #e4e4e4; border-radius: 6px; padding: 8px 10px; background: #fafafa; }
    .kpi span { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6f6f6f; }
    .kpi strong { font-size: 15px; font-variant-numeric: tabular-nums; }
    .kpi.oscura { background: #2b2b2b; border-color: #2b2b2b; }
    .kpi.oscura span { color: rgba(255,255,255,0.7); }
    .kpi.oscura strong { color: #fff; }
    .nota { color: #6f6f6f; font-size: 9px; margin: -4px 0 10px; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    th { background: #2b2b2b; color: #fff; font-weight: 600; text-align: left; padding: 6px 7px; font-size: 9px; }
    td { padding: 6px 7px; border-bottom: 1px solid #e4e4e4; vertical-align: top; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    tr.cambio td { background: #f3f6fa !important; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .fecha { white-space: nowrap; color: #6f6f6f; }
    .sub { color: #6f6f6f; font-size: 9px; }
    .usd { color: #177245; font-weight: 600; }
    .tc { color: #6f6f6f; }
    .pos { color: #177245; }
    .neg { color: #b3261e; }
    .vacio { text-align: center; color: #6f6f6f; padding: 18px; }
  </style>
</head>
<body>
  <header>
    <img id="logo" src="${urlLogo()}" alt="JES & arqs" />
    <div>
      <h1>${esc(d.proyectoNombre)}</h1>
      <p>${titulo} · ${esc(d.leyendaRango)} · Generado el ${generado}</p>
    </div>
  </header>
  ${d.filtros.length > 0 ? `<p class="filtros">Filtros: ${d.filtros.map(esc).join(" · ")}</p>` : ""}

  <div class="kpis">
    <div class="kpi"><span>Cantidad</span><strong>${propios.length}</strong></div>
    <div class="kpi"><span>Total en pesos</span><strong>${monto(total("ARS"), "ARS")}</strong></div>
    <div class="kpi"><span>Total en dólares</span><strong>${monto(total("USD"), "USD")}</strong></div>
    <div class="kpi oscura"><span>Todo en dólares</span><strong>${monto(totalEnUSD, "USD")}</strong></div>
  </div>
  ${
    sinTipoCambio > 0 || cantidadCambios > 0
      ? `<p class="nota">${[
          sinTipoCambio > 0
            ? `${sinTipoCambio} ${sinTipoCambio === 1 ? "movimiento" : "movimientos"} en pesos sin tipo de cambio ${sinTipoCambio === 1 ? "queda" : "quedan"} fuera de "Todo en dólares".`
            : "",
          cantidadCambios > 0
            ? `Los cambios de moneda se listan pero no suman a los totales.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")}</p>`
      : ""
  }

  <table>
    <thead><tr>${encabezadoTabla}</tr></thead>
    <tbody>${cuerpo}</tbody>
  </table>

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
      setTimeout(imprimir, 2500);
    })();
  </script>
</body>
</html>`;
}

export function abrirInformeMovimientos(datos: DatosInformeMovimientos) {
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
