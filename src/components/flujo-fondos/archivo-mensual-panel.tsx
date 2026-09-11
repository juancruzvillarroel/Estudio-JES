"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claveMes, formatMesLargo } from "@/lib/presupuesto";
import { formatFecha } from "@/lib/utils";

/**
 * Un papel adjunto, ya despegado de si vino de un gasto o de una factura.
 *
 * El panel no necesita saber de dónde salió cada uno: lo único que hace con
 * ellos es agruparlos por mes, listarlos y meterlos en un ZIP.
 */
export type PapelArchivado = {
  /**
   * El día del gasto o de la factura, no el de la subida. Es el que importa
   * para archivar: un comprobante de agosto cargado tarde pertenece a agosto.
   */
  fecha: string;
  url: string;
  /** Con qué se lo reconoce en la lista y adentro del ZIP. */
  nombre: string;
};

/**
 * La extensión que traía el archivo original.
 *
 * El blob se guarda como "flujo-fondos/<uuid>-<nombre original>", así que el
 * final de la URL todavía dice si es un PDF o una foto. Sin esto los archivos
 * salen del ZIP sin extensión y Windows no sabe con qué abrirlos.
 */
function extension(url: string) {
  const archivo = url.split("?")[0].split("/").pop() ?? "";
  const punto = archivo.lastIndexOf(".");
  return punto > 0 ? archivo.slice(punto) : "";
}

/** Windows no acepta \ / : * ? " < > | en el nombre de un archivo. */
function limpiar(texto: string) {
  return texto.replace(/[\\/:*?"<>|]/g, "-").trim();
}

/**
 * Cómo se llama el papel adentro del ZIP: "2026-09-05 Ferretería Mitre.pdf".
 *
 * La fecha va adelante para que el descomprimido quede ordenado por día solo.
 * El `usados` es para los repetidos: dos gastos del mismo día al mismo
 * proveedor darían el mismo nombre y el segundo pisaría al primero adentro del
 * ZIP, sin aviso.
 */
function nombreEnZip(papel: PapelArchivado, usados: Set<string>) {
  const base = `${papel.fecha.slice(0, 10)} ${limpiar(papel.nombre)}`;
  const ext = extension(papel.url);
  let nombre = `${base}${ext}`;
  let repeticion = 2;
  while (usados.has(nombre)) {
    nombre = `${base} (${repeticion})${ext}`;
    repeticion += 1;
  }
  usados.add(nombre);
  return nombre;
}

/** "2026-09" → "09-2026", que es como se lee un mes en un nombre de archivo. */
function mesParaArchivo(clave: string) {
  const [anio, mes] = clave.split("-");
  return `${mes}-${anio}`;
}

/**
 * Baja todos los papeles y los entrega en un ZIP.
 *
 * Se arma en el navegador y no en el servidor porque los blobs son públicos:
 * pasarlos por una ruta del servidor solo agregaría una copia de ida y vuelta
 * de todos los archivos del mes por cada click.
 *
 * Devuelve cuántos no se pudieron bajar. Un blob borrado a mano tira 404 y no
 * es motivo para dejar sin descarga a los otros veinte del mes.
 */
async function armarZip(papeles: PapelArchivado[], nombreZip: string) {
  // jszip se carga recién acá: son unos cien kB que no tienen por qué viajar
  // con la página para un botón que se toca una vez por mes.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usados = new Set<string>();
  let fallaron = 0;

  for (const papel of papeles) {
    try {
      const respuesta = await fetch(papel.url);
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      zip.file(nombreEnZip(papel, usados), await respuesta.blob());
    } catch {
      fallaron += 1;
    }
  }

  if (fallaron === papeles.length) {
    throw new Error("No se pudo bajar ninguno de los archivos. Probá de nuevo en un rato.");
  }

  const contenido = await zip.generateAsync({ type: "blob" });
  const href = URL.createObjectURL(contenido);
  const link = document.createElement("a");
  link.href = href;
  link.download = nombreZip;
  link.click();
  URL.revokeObjectURL(href);

  return fallaron;
}

/**
 * El archivo de papeles de la obra, mes por mes.
 *
 * Existe porque el comprobante y la factura de un gasto terminan en carpetas
 * distintas a fin de mes, y hasta ahora la única forma de juntarlos era entrar
 * gasto por gasto y bajar los adjuntos de a uno. Acá cada mes muestra las dos
 * pilas por separado, cada una con su descarga completa en un ZIP.
 */
export function ArchivoMensualPanel({
  comprobantes,
  facturas,
}: {
  comprobantes: PapelArchivado[];
  /** Las de los gastos y las cargadas en la sección: para archivar dan igual. */
  facturas: PapelArchivado[];
}) {
  // Del mes más nuevo al más viejo: lo que se está archivando ahora es lo de
  // arriba, y lo de hace un año casi nunca se vuelve a tocar.
  const meses = [...new Set([...comprobantes, ...facturas].map((p) => claveMes(p.fecha)))]
    .sort()
    .reverse();

  const delMes = (papeles: PapelArchivado[], mes: string) =>
    papeles.filter((p) => claveMes(p.fecha) === mes).sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="flex flex-col gap-3 border-t pt-6">
      <div>
        <h3 className="text-sm font-medium">Archivo del mes</h3>
        <p className="text-xs text-muted-foreground">
          Los papeles de la obra ordenados por mes: de un lado los comprobantes de pago y del otro
          las facturas. Cada pila se baja entera en un ZIP.
        </p>
      </div>

      {meses.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Todavía no hay papeles adjuntos. Se van juntando solos a medida que le cargás el
          comprobante o la factura a cada gasto.
        </div>
      ) : (
        meses.map((mes) => (
          <div key={mes} className="rounded-lg border p-4">
            <p className="text-sm font-medium capitalize">{formatMesLargo(mes)}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ColumnaPapeles titulo="Comprobantes" papeles={delMes(comprobantes, mes)} mes={mes} />
              <ColumnaPapeles titulo="Facturas" papeles={delMes(facturas, mes)} mes={mes} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Una de las dos pilas del mes, con su lista plegada y su botón de descarga. */
function ColumnaPapeles({
  titulo,
  papeles,
  mes,
}: {
  titulo: string;
  papeles: PapelArchivado[];
  /** "AAAA-MM", solo para nombrar el ZIP. */
  mes: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const descargar = async () => {
    setBajando(true);
    setAviso(null);
    try {
      const fallaron = await armarZip(papeles, `${titulo} ${mesParaArchivo(mes)}.zip`);
      if (fallaron > 0) {
        setAviso(
          fallaron === 1
            ? "Un archivo no se pudo bajar y quedó afuera del ZIP."
            : `${fallaron} archivos no se pudieron bajar y quedaron afuera del ZIP.`
        );
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo armar el ZIP.");
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {titulo} ({papeles.length})
        </p>
        <Button
          variant="outline"
          size="xs"
          disabled={papeles.length === 0 || bajando}
          onClick={descargar}
        >
          {bajando ? <Loader2 className="animate-spin" /> : <Download />}
          {bajando ? "Armando…" : "Descargar todo"}
        </Button>
      </div>

      {papeles.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin archivos este mes.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {abierto ? "Ocultar" : "Ver"} los archivos
          </button>
          {abierto && (
            <ul className="flex flex-col gap-1">
              {papeles.map((papel) => (
                <li key={papel.url} className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <a
                    href={papel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate underline-offset-2 hover:underline"
                  >
                    {formatFecha(papel.fecha)} · {papel.nombre}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {aviso && <p className="text-xs text-error">{aviso}</p>}
    </div>
  );
}
