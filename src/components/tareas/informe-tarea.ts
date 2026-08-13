/**
 * Genera el informe imprimible de una tarea, para mandárselo a quien la tiene
 * que hacer (un contratista, un proveedor, alguien del estudio).
 *
 * Mismo mecanismo que el informe de flujo de fondos: se arma un documento HTML
 * independiente, se abre en una pestaña nueva y se dispara el diálogo de
 * impresión del navegador, de donde se guarda como PDF. Así el papel no
 * arrastra la navegación de la app y no hace falta una dependencia de
 * generación de PDF.
 *
 * Es a propósito un papel corto: obra, tarea y checklist. Prioridad, rubro,
 * asignados y avance son datos de seguimiento interno, no le dicen nada a quien
 * recibe la hoja para ir tildando.
 */

import type { TareaItemOpcion, TareaOpcion } from "@/lib/tareas";

/** Escapa el texto que se inyecta en el HTML del informe. */
function esc(texto: string) {
  return texto.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

/**
 * Fecha larga y legible ("13 de agosto de 2026"). No se usa `formatFecha` de
 * utils porque aquella fuerza UTC para las fechas que son "día calendario"
 * (las de un <input type="date">), y acá lo que se muestra es un timestamp
 * real: hay que leerlo en la zona horaria de quien imprime.
 */
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

/** Un renglón del checklist, con el casillero tildado o vacío. */
function filaItem(item: TareaItemOpcion) {
  return `
    <li class="${item.completado ? "hecho" : ""}">
      <span class="casilla">${item.completado ? "&#10003;" : ""}</span>
      <span>${esc(item.texto)}</span>
    </li>`;
}

function seccionChecklist(tarea: TareaOpcion) {
  if (tarea.items.length === 0 && tarea.secciones.length === 0) {
    return `<p class="vacio">La tarea no tiene sub ítems cargados.</p>`;
  }

  const sueltos =
    tarea.items.length > 0 ? `<ul class="items">${tarea.items.map(filaItem).join("")}</ul>` : "";

  // Sin `break-inside: avoid` en el grupo: una sección más larga que la hoja
  // no entra a la fuerza en ninguna página y el texto termina cortado. Se
  // dejan quebrar y se cuida solo que ningún renglón se parta al medio y que
  // el título no quede solo al pie (ver el CSS).
  const secciones = tarea.secciones
    .map(
      (s) => `
      <div class="grupo">
        <div class="grupo-titulo">${esc(s.titulo)}</div>
        ${
          s.items.length > 0
            ? `<ul class="items">${s.items.map(filaItem).join("")}</ul>`
            : `<p class="vacio">Sin sub ítems.</p>`
        }
      </div>`
    )
    .join("");

  return sueltos + secciones;
}

function construirHtml(tarea: TareaOpcion) {
  const generadoEl = fechaLarga(new Date().toISOString());

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Tarea - ${esc(tarea.proyectoNombre)} - ${esc(tarea.titulo)}</title>
  <style>
    :root {
      --tinta: #1f1f1f;
      --gris: #6f6f6f;
      --linea: #e4e4e4;
      --oscuro: #2b2b2b;
      --verde: #177245;
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
       las hojas. Con el padding, la segunda página en adelante arrancaba
       pegada al borde y el contenido se iba contra el filo del papel. */
    @page { size: A4; margin: 16mm 15mm; }
    /* En pantalla no hay @page, así que ahí sí hace falta el padding para que
       la vista previa se parezca al papel. */
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
      margin: 20px 0 12px;
      /* Que no quede el título de sección solo al pie de una hoja. */
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
    }

    .titulo-tarea {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin: 0 0 6px;
      break-after: avoid;
      page-break-after: avoid;
    }
    .descripcion {
      white-space: pre-line;
      margin: 0;
      font-size: 11px;
      color: #333;
    }

    ul.items { list-style: none; margin: 0; padding: 0; }
    ul.items li {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      padding: 6px 2px;
      border-bottom: 1px solid #f1f1f1;
      /* Un renglón nunca se parte entre dos hojas. */
      break-inside: avoid;
      page-break-inside: avoid;
    }
    ul.items li:last-child { border-bottom: none; }
    ul.items li.hecho { color: var(--gris); text-decoration: line-through; }
    .casilla {
      flex: 0 0 auto;
      width: 12px;
      height: 12px;
      margin-top: 1px;
      border: 1.4px solid #9a9a9a;
      border-radius: 3px;
      text-align: center;
      line-height: 10px;
      font-size: 10px;
      color: var(--verde);
      text-decoration: none;
    }

    .grupo { margin-top: 14px; }
    .grupo-titulo {
      border-bottom: 1.5px solid var(--oscuro);
      padding-bottom: 4px;
      margin-bottom: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      /* Un título de sección arrastra al menos el primer sub ítem consigo. */
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
    }

    .vacio { font-size: 9.5px; color: var(--gris); margin: 6px 0 0; }
  </style>
</head>
<body>
  <header class="doc">
    <img class="logo" id="logo" src="${urlLogo()}" alt="JES &amp; arqs" />
    <div>
      <h1>${esc(tarea.proyectoNombre)}</h1>
      <p>Informe de tarea</p>
      <p class="meta">Generado el ${esc(generadoEl)}</p>
    </div>
  </header>

  <h2 class="seccion">Tarea</h2>
  <p class="titulo-tarea">${esc(tarea.titulo)}</p>
  ${tarea.descripcion ? `<p class="descripcion">${esc(tarea.descripcion)}</p>` : ""}

  <h2 class="seccion">Checklist</h2>
  ${seccionChecklist(tarea)}

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

export function abrirInformeTarea(tarea: TareaOpcion) {
  const ventana = window.open("", "_blank");
  if (!ventana) {
    window.alert(
      "El navegador bloqueó la ventana del informe. Permití las ventanas emergentes para este sitio y volvé a intentar."
    );
    return;
  }
  ventana.document.write(construirHtml(tarea));
  ventana.document.close();
}
