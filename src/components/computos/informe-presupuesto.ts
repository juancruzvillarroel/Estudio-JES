/**
 * El pedido de presupuesto de un cómputo: un listado prolijo para mandarle a
 * un proveedor o contratista a que cotice.
 *
 * Es distinto del informe del rubro (informe-rubro.ts), que reproduce la
 * grilla con los niveles como filas para controlar en obra. Éste no tiene
 * niveles ni desglose: al proveedor no le interesa de qué piso sale cada
 * metro, le interesa cuánto le tiene que cotizar de cada cosa. Por eso es
 * una lista vertical, ítem por ítem, con la cantidad ya final —la misma que
 * se compraría, bultos redondeados incluidos— y columnas en blanco para que
 * la complete con el precio.
 *
 * Va vertical y en A4 apaisado no: es una lista angosta (ítem, modelo,
 * cantidad, unidad, precio, total), no una grilla ancha como el informe del
 * rubro.
 *
 * Igual que el informe del rubro, quien llama ya decide qué entra: los
 * ítems llegan filtrados y en orden. Acá no se elige nada, sólo se dibuja.
 */

import {
  cantidadFinalCompra,
  esSeccionPuertas,
  formatCantidad,
  TIPO_COMPUTO_LABEL,
  type ItemOpcion,
  type TipoComputo,
} from "@/lib/computos";

export type SeccionPresupuesto = {
  nombre: string;
  /** Los ítems elegidos de esta sección, en orden. */
  items: ItemOpcion[];
};

export type DatosInformePresupuesto = {
  proyectoNombre: string;
  rubroNombre: string;
  tipo: TipoComputo;
  /** Cuándo se tocó por última vez este lado del cómputo. Null = nunca. */
  modificadoEl: Date | null;
  secciones: SeccionPresupuesto[];
  /** Los totales de toda la obra: una fila derivada puede salir de otro ítem. */
  totales: Map<string, number>;
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

/** Fecha corta ("6/10/2026"). */
function fechaCorta(fecha: Date) {
  return fecha.toLocaleDateString("es-AR");
}

/** La ventana se abre en `about:blank`: el logo necesita la URL absoluta. */
function urlLogo() {
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  return `${origen}/logo-jes.png`;
}

function filaItem(item: ItemOpcion, datos: DatosInformePresupuesto) {
  const total = datos.totales.get(item.id) ?? 0;
  const vacio = item.mediciones.length === 0;
  const { cantidad, unidad } = cantidadFinalCompra(item, total);

  return `
    <tr>
      <td class="item-nombre">
        ${esc(item.nombre)}
        ${item.modelo ? `<div class="modelo">${esc(item.modelo)}</div>` : ""}
      </td>
      <td class="num">${esc(vacio ? "—" : formatCantidad(cantidad))}</td>
      <td class="unidad">${esc(unidad)}</td>
      <td class="precio"></td>
      <td class="precio"></td>
    </tr>`;
}

/**
 * El cierre de la sección de PUERTAS: una fila que suma la cantidad final de
 * compra de todos los tipos de puerta (P1, P2, P3...), porque todos comparten
 * la misma unidad ("un") y es la única sección donde esa suma es un dato que
 * se usa de verdad —cuántas puertas en total hay que cotizar, más allá de
 * cómo se repartan entre tipos. Ningún otro rubro mezcla ítems con la misma
 * unidad de esta forma, así que no hace falta en ningún otro lado.
 *
 * Va en la columna "Unidad" y no en una nueva porque ahí es donde se venía
 * repitiendo "un" fila tras fila: ese lugar queda libre para el total en
 * cuanto deja de hacer falta repetirlo en cada tipo.
 */
function filaTotalPuertas(seccion: SeccionPresupuesto, datos: DatosInformePresupuesto) {
  const total = seccion.items.reduce((acc, item) => {
    const { cantidad } = cantidadFinalCompra(item, datos.totales.get(item.id) ?? 0);
    return acc + cantidad;
  }, 0);

  return `
    <tr class="fila-total">
      <td class="item-nombre">TOTAL PUERTAS</td>
      <td class="num"></td>
      <td class="unidad num">${esc(formatCantidad(total))}</td>
      <td class="precio"></td>
      <td class="precio"></td>
    </tr>`;
}

function tablaSeccion(seccion: SeccionPresupuesto, datos: DatosInformePresupuesto) {
  const puertas = esSeccionPuertas(seccion);
  return `
    <section class="bloque">
      <h2>${esc(seccion.nombre)}</h2>
      <table class="lista">
        <thead>
          <tr>
            <th class="item-nombre">Ítem</th>
            <th class="num">Cantidad</th>
            <th class="unidad">Unidad</th>
            <th class="precio">Precio unitario</th>
            <th class="precio">Total</th>
          </tr>
        </thead>
        <tbody>
          ${seccion.items.map((item) => filaItem(item, datos)).join("")}
          ${puertas ? filaTotalPuertas(seccion, datos) : ""}
        </tbody>
      </table>
    </section>`;
}

function construirHtml(datos: DatosInformePresupuesto) {
  const conItems = datos.secciones.filter((s) => s.items.length > 0);
  const cuerpo = conItems.map((s) => tablaSeccion(s, datos)).join("");
  const cuantosItems = conItems.reduce((acc, s) => acc + s.items.length, 0);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Presupuesto ${esc(datos.rubroNombre)} - ${esc(datos.proyectoNombre)}</title>
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
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Vertical: una lista angosta entra cómoda en A4 de pie. */
    @page { size: A4 portrait; margin: 16mm; }
    @media screen {
      body { padding: 16mm; max-width: 210mm; margin: 0 auto; }
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

    .bloque { margin-top: 16px; break-inside: auto; }
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
      break-after: avoid;
      break-inside: avoid;
    }

    table.lista { width: 100%; border-collapse: collapse; }
    table.lista th, table.lista td {
      border: 1px solid var(--linea);
      padding: 5px 8px;
      break-inside: avoid;
      vertical-align: top;
    }
    table.lista thead th {
      background: #ebebeb;
      font-size: 9px;
      font-weight: 600;
      color: var(--gris);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: left;
    }
    table.lista thead th.num,
    table.lista thead th.precio { text-align: right; }

    .item-nombre { width: 46%; font-weight: 500; }
    .item-nombre .modelo {
      margin-top: 1px;
      font-size: 9.5px;
      font-weight: 400;
      color: var(--gris);
    }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
    .unidad { color: var(--gris); font-size: 10px; }
    /* La fila de cierre de PUERTAS, con el total sumado en la columna
       Unidad: un tono de fondo y un borde más grueso arriba para que se lea
       como el cierre de la tabla y no como un tipo de puerta más. */
    tr.fila-total td { background: #f0f0f0; border-top: 2px solid var(--oscuro); }
    tr.fila-total .item-nombre {
      font-size: 9.5px;
      font-weight: 600;
      color: var(--gris);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    tr.fila-total .unidad { font-size: 11px; color: var(--tinta); }
    /* Las columnas que completa el proveedor van en blanco, con el ancho ya
       reservado: así la hoja se imprime lista para escribir a mano o a
       máquina, sin que el proveedor tenga que adivinar dónde va cada dato. */
    .precio { width: 17%; }

    .vacio { font-size: 10px; color: var(--gris); margin: 14px 0 0; }
  </style>
</head>
<body>
  <header class="doc">
    <img class="logo" id="logo" src="${urlLogo()}" alt="JES &amp; arqs" />
    <div>
      <h1>${esc(datos.proyectoNombre)}</h1>
      <p>Pedido de presupuesto — ${esc(datos.rubroNombre)} · ${esc(TIPO_COMPUTO_LABEL[datos.tipo])} — ${cuantosItems} ${cuantosItems === 1 ? "ítem" : "ítems"}</p>
      <p>
        Generado el ${esc(fechaLarga(new Date().toISOString()))}
        ${datos.modificadoEl ? ` · Cómputo modificado el ${esc(fechaCorta(datos.modificadoEl))}` : ""}
      </p>
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

export function abrirInformePresupuesto(datos: DatosInformePresupuesto) {
  const ventana = window.open("", "_blank");
  if (!ventana) {
    window.alert(
      "El navegador bloqueó la ventana del pedido. Permití las ventanas emergentes para este sitio y volvé a intentar."
    );
    return;
  }
  ventana.document.write(construirHtml(datos));
  ventana.document.close();
}
