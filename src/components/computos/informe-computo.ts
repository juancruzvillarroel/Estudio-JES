/**
 * Genera el cómputo imprimible de una obra, para mandárselo a un proveedor que
 * tiene que cotizar o para llevarlo a una reunión.
 *
 * Mismo mecanismo que el informe de tarea y el de flujo de fondos: se arma un
 * documento HTML independiente, se abre en una pestaña nueva y se dispara el
 * diálogo de impresión del navegador, de donde se guarda como PDF.
 *
 * Se puede imprimir la obra entera o un rubro solo, porque así se manda: al
 * contratista de albañilería se le manda albañilería, no las doscientas
 * partidas de la obra. El rubro solo es el uso normal; el completo, el que se
 * archiva.
 *
 * A diferencia del informe de tarea, acá el detalle NO se recorta: van todas
 * las filas de cada ítem, con su cálculo y su parcial. Un cómputo sin las filas
 * que lo justifican es un número que el otro tiene que creer; con las filas, lo
 * puede revisar. Ese es justamente el papel que se manda a cotizar.
 */

import {
  agruparPorNivel,
  calcularTotales,
  dimensionesDe,
  formatCantidad,
  formulaMedicion,
  parcialMedicion,
  simboloUnidad,
  subtotalNivel,
  SIN_SUBRUBRO,
  type ItemOpcion,
} from "@/lib/computos";
import type { NivelOpcion } from "@/lib/niveles";

type RubroInforme = { id: string; nombre: string; subrubros: { id: string; nombre: string }[] };

type DatosInforme = {
  proyectoNombre: string;
  rubros: RubroInforme[];
  items: ItemOpcion[];
  niveles: NivelOpcion[];
  /** Cuando viene, se imprime sólo ese rubro. */
  soloRubroId?: string;
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

/** La ventana se abre en `about:blank`: el logo necesita la URL absoluta. */
function urlLogo() {
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  return `${origen}/logo-jes.png`;
}

/** Contexto de cálculo que necesitan las filas derivadas y el corte por nivel. */
type Contexto = {
  totales: Map<string, number>;
  porId: Map<string, ItemOpcion>;
  niveles: NivelOpcion[];
};

/** Un renglón: de dónde sale, cómo se calculó y cuánto da. */
function filaMedicion(
  medicion: ItemOpcion["mediciones"][number],
  item: ItemOpcion,
  ctx: Contexto
) {
  const totalOrigen = medicion.origenId ? (ctx.totales.get(medicion.origenId) ?? 0) : 0;
  const parcial = parcialMedicion(medicion, item.unidad, totalOrigen);
  const formula = formulaMedicion(medicion, item.unidad, totalOrigen);

  // En una fila derivada la primera columna dice de qué ítem sale, que es su
  // "dónde": el proveedor tiene que poder ver que los ladrillos salieron de los
  // metros de mampostería y no de una estimación a ojo.
  const donde = medicion.origenId
    ? `<span class="origen">de ${esc(ctx.porId.get(medicion.origenId)?.nombre ?? "—")}</span>`
    : esc(medicion.descripcion ?? "—");

  return `
    <tr${medicion.deduccion ? ' class="deduccion"' : ""}>
      <td>${donde}${medicion.deduccion ? ' <span class="marca">descuenta</span>' : ""}</td>
      <td class="formula">${formula ? esc(formula) : ""}</td>
      <td class="num">${esc(formatCantidad(parcial))}</td>
    </tr>`;
}

/**
 * Un ítem con todo su detalle.
 *
 * Un ítem sin filas se imprime igual, con el total en blanco: en el papel que
 * se manda a cotizar, lo que falta computar es información tan útil como lo
 * computado, y esconderlo haría creer que el cómputo está cerrado.
 */
function bloqueItem(item: ItemOpcion, ctx: Contexto) {
  const unidad = simboloUnidad(item.unidad);
  const total = ctx.totales.get(item.id) ?? 0;
  const dims = dimensionesDe(item.unidad);

  const encabezado = `
    <div class="item-cab">
      <div class="item-nombre">${esc(item.nombre)}</div>
      <div class="item-total">${
        item.mediciones.length === 0
          ? `<span class="pendiente">a computar</span>`
          : `${esc(formatCantidad(total))} <span class="unidad">${esc(unidad)}</span>`
      }</div>
    </div>
    ${item.notas ? `<p class="notas">${esc(item.notas)}</p>` : ""}`;

  if (item.mediciones.length === 0) {
    return `<div class="item">${encabezado}</div>`;
  }

  const hayDerivadas = item.mediciones.some((m) => m.origenId !== null);

  // En el papel, a diferencia de la pantalla, los niveles vacíos no se imprimen:
  // el cómputo que se manda a cotizar tiene que decir qué hay, no qué falta por
  // planta. Lo que falta ya se avisa arriba, en el total ("a computar").
  const grupos = agruparPorNivel(item.mediciones, ctx.niveles).filter(
    (g) => g.mediciones.length > 0
  );
  // Un ítem que va entero y no se reparte por plantas (excavación, cerco) no
  // necesita que le pongan un título arriba diciendo que es de toda la obra.
  const conTitulos = !(grupos.length === 1 && grupos[0]?.id === null);

  const cuerpo = grupos
    .map((g) => {
      const filas = g.mediciones.map((m) => filaMedicion(m, item, ctx)).join("");
      if (!conTitulos) return filas;
      const subtotal = subtotalNivel(g, item.unidad, ctx.totales);
      return `
          <tr class="nivel">
            <td colspan="2">${esc(g.nombre)}</td>
            <td class="num">${esc(formatCantidad(subtotal))}</td>
          </tr>
          ${filas}`;
    })
    .join("");

  return `
    <div class="item">
      ${encabezado}
      <table class="mediciones">
        <thead>
          <tr>
            <th>${hayDerivadas ? "Detalle" : "Dónde"}</th>
            <th>${dims.length > 0 || hayDerivadas ? "Cálculo" : ""}</th>
            <th class="num">${esc(unidad)}</th>
          </tr>
        </thead>
        <tbody>
          ${cuerpo}
        </tbody>
      </table>
    </div>`;
}

function construirHtml(datos: DatosInforme) {
  const generadoEl = fechaLarga(new Date().toISOString());

  // Los totales se calculan sobre TODO el cómputo aunque se imprima un rubro
  // solo: un ítem de materiales puede salir de un ítem de otro rubro, y el
  // número tiene que ser el mismo en el papel que en la pantalla.
  const ctx: Contexto = {
    totales: calcularTotales(datos.items),
    porId: new Map(datos.items.map((i) => [i.id, i])),
    niveles: datos.niveles,
  };

  const rubros = datos.soloRubroId
    ? datos.rubros.filter((r) => r.id === datos.soloRubroId)
    : datos.rubros;

  // Agrupado por rubro y subrubro, igual que en pantalla: los grupos sin ítems
  // no se imprimen.
  const secciones = rubros
    .map((rubro) => {
      const delRubro = datos.items.filter((i) => i.rubroId === rubro.id);
      const grupos = [
        ...rubro.subrubros.map((s) => ({
          nombre: s.nombre,
          items: delRubro.filter((i) => i.subrubroId === s.id),
        })),
        { nombre: SIN_SUBRUBRO, items: delRubro.filter((i) => i.subrubroId === null) },
      ].filter((g) => g.items.length > 0);
      return { rubro, grupos };
    })
    .filter((s) => s.grupos.length > 0);

  const cuerpo = secciones
    .map(
      ({ rubro, grupos }) => `
      <h2 class="seccion">${esc(rubro.nombre)}</h2>
      ${grupos
        .map(
          (g) => `
        ${grupos.length > 1 ? `<h3 class="subseccion">${esc(g.nombre)}</h3>` : ""}
        ${g.items.map((i) => bloqueItem(i, ctx)).join("")}`
        )
        .join("")}`
    )
    .join("");

  const impresos = secciones.flatMap((s) => s.grupos.flatMap((g) => g.items));
  const computados = impresos.filter((i) => i.mediciones.length > 0).length;
  const subtitulo = datos.soloRubroId
    ? `Cómputo — ${secciones[0]?.rubro.nombre ?? ""}`
    : "Cómputo de obra";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cómputo - ${esc(datos.proyectoNombre)}</title>
  <style>
    :root {
      --tinta: #1f1f1f;
      --gris: #6f6f6f;
      --linea: #e4e4e4;
      --oscuro: #2b2b2b;
      --rojo: #a33;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: var(--tinta);
      font-size: 11px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* El margen lo pone @page, no el padding del body: así lo respetan TODAS
       las hojas y la segunda no arranca pegada al borde. */
    @page { size: A4; margin: 16mm 15mm; }
    @media screen {
      body { padding: 16mm 15mm; max-width: 210mm; margin: 0 auto; }
    }

    header.doc {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid var(--oscuro);
      padding-bottom: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    header.doc .logo { width: 62px; height: auto; }
    header.doc h1 { font-size: 19px; margin: 0; letter-spacing: -0.01em; }
    header.doc p { margin: 2px 0 0; color: var(--gris); font-size: 10.5px; }
    header.doc .meta { font-size: 9.5px; }

    h2.seccion {
      background: var(--oscuro);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 7px 12px;
      border-radius: 5px;
      margin: 18px 0 10px;
      /* Que no quede el título de rubro solo al pie de una hoja. */
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
    }
    h3.subseccion {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gris);
      border-bottom: 1px solid var(--linea);
      padding-bottom: 3px;
      margin: 14px 0 8px;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Sin break-inside: avoid en el ítem entero: uno con cuarenta filas no
       entra en ninguna hoja y forzarlo dejaría el texto cortado. Se cuida sólo
       que el encabezado arrastre consigo el principio de la tabla y que ningún
       renglón se parta al medio. */
    .item { margin: 0 0 12px; }
    .item-cab {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1.5px solid var(--oscuro);
      padding-bottom: 3px;
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
    }
    .item-nombre { font-size: 11.5px; font-weight: 700; }
    .item-total { font-size: 12.5px; font-weight: 700; white-space: nowrap; }
    .item-total .unidad { font-weight: 400; color: var(--gris); font-size: 10px; }
    .item-total .pendiente {
      font-weight: 400;
      font-style: italic;
      color: var(--gris);
      font-size: 10px;
    }
    .notas { margin: 4px 0 0; font-size: 9.5px; color: var(--gris); }

    table.mediciones { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.mediciones th {
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--gris);
      text-align: left;
      font-weight: 600;
      padding: 2px 4px;
    }
    table.mediciones td {
      padding: 3px 4px;
      border-bottom: 1px solid #f1f1f1;
      /* Un renglón nunca se parte entre dos hojas. */
      break-inside: avoid;
      page-break-inside: avoid;
    }
    table.mediciones tr:last-child td { border-bottom: none; }
    /* El renglón que abre un nivel: en gris claro, con el subtotal de la planta
       a la derecha. Es lo que hace que el contratista pueda cotizar por piso
       sin volver a sumar nada. */
    tr.nivel td {
      background: #f6f6f6;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--gris);
      border-bottom: 1px solid var(--linea);
      break-after: avoid;
      page-break-after: avoid;
    }
    .num { text-align: right; white-space: nowrap; }
    .formula { color: var(--gris); font-size: 10px; white-space: nowrap; }
    /* Las filas calculadas en bastardilla: se lee de un vistazo qué se midió en
       obra y qué salió de una cuenta sobre otro ítem. */
    .origen { font-style: italic; color: var(--gris); }
    /* Las deducciones en rojo y con la marca al lado: el signo menos solo es
       fácil de pasar por alto en una tabla larga. */
    tr.deduccion td { color: var(--rojo); }
    .marca {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .vacio { font-size: 9.5px; color: var(--gris); margin: 6px 0 0; }
  </style>
</head>
<body>
  <header class="doc">
    <img class="logo" id="logo" src="${urlLogo()}" alt="JES &amp; arqs" />
    <div>
      <h1>${esc(datos.proyectoNombre)}</h1>
      <p>${esc(subtitulo)}</p>
      <p class="meta">Generado el ${esc(generadoEl)} — ${impresos.length} ítems, ${computados} computados</p>
    </div>
  </header>

  ${cuerpo || `<p class="vacio">El cómputo de esta obra está vacío.</p>`}

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

export function abrirInformeComputo(datos: DatosInforme) {
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
