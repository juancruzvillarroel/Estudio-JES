"use client";

import { useRef, useState, useTransition } from "react";
import { CornerDownRight, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  actualizarDerivada,
  actualizarMedicion,
  crearMedicion,
  eliminarMedicion,
} from "@/actions/computos";
import { DerivarDialog } from "@/components/computos/derivar-dialog";
import {
  agruparPorNivel,
  dimensionesDe,
  formatCantidad,
  medidaATexto,
  parcialMedicion,
  parseMedida,
  simboloUnidad,
  subtotalNivel,
  type DimensionComputo,
  type ItemOpcion,
  type MedicionOpcion,
} from "@/lib/computos";
import type { NivelOpcion } from "@/lib/niveles";
import { cn } from "@/lib/utils";

const ETIQUETA_DIMENSION: Record<DimensionComputo, string> = {
  largo: "Largo",
  ancho: "Ancho",
  alto: "Alto",
};

/** Lo que se tipea en una fila, antes de convertirse en números. */
type Borrador = {
  descripcion: string;
  /** Id del nivel de la obra. Vacío = no es de ninguna planta. */
  nivelId: string;
  cantidad: string;
  largo: string;
  ancho: string;
  alto: string;
  desperdicio: string;
  deduccion: boolean;
};

const borradorVacio = (nivelId: string): Borrador => ({
  descripcion: "",
  nivelId,
  cantidad: "",
  largo: "",
  ancho: "",
  alto: "",
  desperdicio: "",
  deduccion: false,
});

const aBorrador = (m: MedicionOpcion): Borrador => ({
  descripcion: m.descripcion ?? "",
  nivelId: m.nivelId ?? "",
  cantidad: medidaATexto(m.cantidad),
  largo: medidaATexto(m.largo),
  ancho: medidaATexto(m.ancho),
  alto: medidaATexto(m.alto),
  desperdicio: m.desperdicio === null ? "" : medidaATexto(m.desperdicio),
  deduccion: m.deduccion,
});

/** Los números que viajan al servidor, leídos de lo que se tipeó. */
function aDatos(borrador: Borrador) {
  return {
    descripcion: borrador.descripcion.trim() || null,
    nivelId: borrador.nivelId || null,
    // Vacío vale 1: la cantidad es "cuántas veces se repite esta medida", y lo
    // normal es una sola. Escribir el 1 en cada fila sería trabajo de más.
    cantidad: parseMedida(borrador.cantidad) ?? 1,
    largo: parseMedida(borrador.largo),
    ancho: parseMedida(borrador.ancho),
    alto: parseMedida(borrador.alto),
    deduccion: borrador.deduccion,
  };
}

/** El parcial de lo que se está tipeando, para mostrarlo mientras se escribe. */
function parcialDeBorrador(
  borrador: Borrador,
  item: ItemOpcion,
  origenId: string | null = null,
  totalOrigen = 0
) {
  const datos = aDatos(borrador);
  const desperdicio = borrador.desperdicio.trim() === "" ? null : parseMedida(borrador.desperdicio);
  return parcialMedicion(
    {
      ...datos,
      id: "",
      itemId: item.id,
      filaExtraId: null,
      origenId,
      desperdicio,
      orden: 0,
      repeticiones: 1,
      cajonC10: null,
      cajonC15: null,
      cajonC18: null,
    },
    item.unidad,
    totalOrigen
  );
}

/** Una celda de medida: angosta, alineada a la derecha y con el teclado numérico. */
function CeldaNumero({
  valor,
  onChange,
  onEnter,
  placeholder,
  etiqueta,
  inputRef,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  etiqueta: string;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
}) {
  return (
    <Input
      ref={inputRef}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={placeholder}
      aria-label={etiqueta}
      inputMode="decimal"
      className={cn("h-8 w-full px-2 text-right text-sm tabular-nums", className)}
    />
  );
}

/**
 * El selector de nivel de una fila, pegado a la izquierda del "dónde".
 *
 * Va acá y no como una columna propia porque la fila ya está bajo el título de
 * su nivel: esto no está para informar, está para mover el renglón de piso
 * cuando se cargó en el equivocado, que en una tabla de treinta filas pasa.
 *
 * Es un select nativo y no el del sistema de diseño a propósito: hay uno por
 * renglón, y acá pesa más que sea liviano y se maneje con el teclado que que
 * combine con el resto.
 */
function SelectNivel({
  valor,
  niveles,
  onChange,
}: {
  valor: string;
  niveles: NivelOpcion[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Nivel"
      title="Nivel de la obra"
      className={cn(
        "h-8 max-w-32 shrink-0 rounded-lg border border-input bg-transparent px-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        valor === "" && "text-muted-foreground"
      )}
    >
      <option value="">—</option>
      {niveles.map((n) => (
        <option key={n.id} value={n.id}>
          {n.nombre}
        </option>
      ))}
    </select>
  );
}

/**
 * Una fila cargada, medida o derivada.
 *
 * Se edita en el lugar, como una planilla: los campos son los de siempre y lo
 * que se escribe se guarda al salir de la celda. No hay botón de guardar por
 * fila porque cargar un cómputo es escribir treinta renglones seguidos, y un
 * clic por renglón lo vuelve insoportable.
 *
 * El guardado va en `onBlur` y sólo si algo cambió: así moverse con el tabulador
 * por una fila que no se tocó no dispara seis llamadas al servidor. El nivel es
 * la excepción y se guarda al elegirlo, porque cambiarlo mueve la fila a otro
 * grupo de la tabla y esperar al blur dejaría el renglón en el lugar viejo.
 *
 * En una fila derivada no hay nivel ni medidas: hay un origen (que no se edita,
 * se cambia borrando la fila), un coeficiente y un desperdicio. Comparten el
 * mismo renglón de tabla porque comparten el total, y verlas juntas es
 * exactamente el punto: se lee de un saque qué se midió y qué se calculó.
 */
function FilaMedicion({
  medicion,
  item,
  niveles,
  origen,
  totalOrigen,
  proyectoId,
  conDesperdicio,
  onSaved,
  onDeleted,
}: {
  medicion: MedicionOpcion;
  item: ItemOpcion;
  niveles: NivelOpcion[];
  /** El ítem del que sale, si la fila es derivada. */
  origen: ItemOpcion | null;
  totalOrigen: number;
  proyectoId: string;
  /** Si la tabla muestra la columna de desperdicio (hay alguna derivada). */
  conDesperdicio: boolean;
  onSaved: (m: MedicionOpcion) => void;
  onDeleted: (id: string) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(aBorrador(medicion));
  const [guardado, setGuardado] = useState<Borrador>(aBorrador(medicion));
  const [prev, setPrev] = useState(medicion);
  const [, startTransition] = useTransition();

  // Si la fila cambió del lado del servidor (otro guardado, un revalidate), se
  // vuelve a partir de lo que llegó.
  if (medicion !== prev) {
    setPrev(medicion);
    setBorrador(aBorrador(medicion));
    setGuardado(aBorrador(medicion));
  }

  const derivada = medicion.origenId !== null;
  const parcial = parcialDeBorrador(borrador, item, medicion.origenId, totalOrigen);

  const guardar = (siguiente: Borrador) => {
    const igual = (Object.keys(siguiente) as (keyof Borrador)[]).every(
      (k) => siguiente[k] === guardado[k]
    );
    if (igual) return;

    setGuardado(siguiente);
    startTransition(async () => {
      const datos = aDatos(siguiente);
      const result = derivada
        ? await actualizarDerivada(proyectoId, medicion.id, {
            descripcion: datos.descripcion,
            cantidad: datos.cantidad,
            desperdicio:
              siguiente.desperdicio.trim() === "" ? null : parseMedida(siguiente.desperdicio),
            deduccion: datos.deduccion,
          })
        : await actualizarMedicion(proyectoId, medicion.id, datos);
      if (!result.success) {
        toast.error(result.error);
        // Vuelve a lo último que el servidor confirmó: dejar en pantalla un
        // número que no se guardó es peor que perder lo que se tipeó, porque el
        // total que se lee dejaría de ser el que está en la base.
        setBorrador(aBorrador(medicion));
        setGuardado(aBorrador(medicion));
        return;
      }
      onSaved(result.medicion);
    });
  };

  const campo = (clave: keyof Borrador, valor: string) =>
    setBorrador((prev) => ({ ...prev, [clave]: valor }));

  /** Los cambios que no pasan por el teclado se guardan al toque. */
  const guardarYa = (siguiente: Borrador) => {
    setBorrador(siguiente);
    guardar(siguiente);
  };

  return (
    <tr
      className={cn(
        "border-b last:border-b-0",
        borrador.deduccion && "bg-error-bg/50",
        derivada && !borrador.deduccion && "bg-muted/20"
      )}
      onBlur={(e) => {
        // Sólo cuando el foco se va de la fila entera: moverse de largo a ancho
        // no tiene por qué guardar dos veces.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        guardar(borrador);
      }}
    >
      <td className="py-1 pr-2 pl-2">
        {derivada ? (
          <div className="flex min-w-0 items-baseline gap-1.5 py-1 text-sm">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />
            <span className="min-w-0 truncate">{origen?.nombre ?? "origen borrado"}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatCantidad(totalOrigen)}{" "}
              {origen ? simboloUnidad(origen.unidad) : ""}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <SelectNivel
              valor={borrador.nivelId}
              niveles={niveles}
              onChange={(v) => guardarYa({ ...borrador, nivelId: v })}
            />
            <Input
              value={borrador.descripcion}
              onChange={(e) => campo("descripcion", e.target.value)}
              placeholder="Dónde"
              aria-label="Descripción"
              className="h-8 px-2 text-sm"
            />
          </div>
        )}
      </td>
      <td className="w-20 py-1 pr-1">
        <CeldaNumero
          valor={borrador.cantidad}
          onChange={(v) => campo("cantidad", v)}
          placeholder="1"
          etiqueta={derivada ? "Coeficiente" : "Cantidad"}
        />
      </td>
      {/* Las columnas de medida existen por la unidad del ítem; una fila
          derivada no las usa y las deja vacías en vez de desalinear la tabla. */}
      {dimensionesDe(item.unidad).map((dim) =>
        derivada ? (
          <td key={dim} className="w-24 py-1 pr-1" />
        ) : (
          <td key={dim} className="w-24 py-1 pr-1">
            <CeldaNumero
              valor={borrador[dim]}
              onChange={(v) => campo(dim, v)}
              etiqueta={ETIQUETA_DIMENSION[dim]}
            />
          </td>
        )
      )}
      {conDesperdicio && (
        <td className="w-20 py-1 pr-1">
          {derivada ? (
            <CeldaNumero
              valor={borrador.desperdicio}
              onChange={(v) => campo("desperdicio", v)}
              placeholder="0"
              etiqueta="Desperdicio en porcentaje"
            />
          ) : null}
        </td>
      )}
      <td className="w-28 py-1 pr-1 text-right">
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            borrador.deduccion && "text-error"
          )}
        >
          {formatCantidad(parcial)}
        </span>
      </td>
      <td className="w-20 py-1 pr-2">
        <div className="flex items-center justify-end gap-0.5">
          <Tooltip
            content={
              borrador.deduccion ? "Descuenta del total" : "Convertir en descuento"
            }
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={borrador.deduccion ? "Dejar de descontar" : "Descontar esta fila"}
              aria-pressed={borrador.deduccion}
              onClick={() => guardarYa({ ...borrador, deduccion: !borrador.deduccion })}
              className={cn(borrador.deduccion && "text-error")}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Eliminar fila">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Eliminar fila"
              onClick={() => {
                startTransition(async () => {
                  const result = await eliminarMedicion(proyectoId, medicion.id);
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  onDeleted(medicion.id);
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}

/**
 * La fila en blanco al pie de cada nivel, siempre lista para escribir.
 *
 * Es lo que reemplaza al "botón de agregar y después completar el diálogo": se
 * escribe y se aprieta Enter, la fila se guarda y el foco vuelve al principio de
 * una fila nueva. Treinta ambientes se cargan sin tocar el mouse.
 *
 * Hay una por nivel y cada una nace con su nivel puesto: se baja hasta el piso
 * que se está computando y se escribe ahí, sin tener que elegir el piso en cada
 * renglón.
 */
function FilaNueva({
  item,
  nivelId,
  proyectoId,
  conDesperdicio,
  onCreated,
}: {
  item: ItemOpcion;
  /** Nivel al que se agrega. Vacío = toda la obra. */
  nivelId: string;
  proyectoId: string;
  conDesperdicio: boolean;
  onCreated: (m: MedicionOpcion) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(borradorVacio(nivelId));
  const [pending, startTransition] = useTransition();
  const primeraCelda = useRef<HTMLInputElement>(null);

  const dims = dimensionesDe(item.unidad);
  const parcial = parcialDeBorrador(borrador, item);

  // Una fila que no tiene ni descripción ni ninguna medida está vacía y no se
  // guarda: es el estado normal del pie de la tabla, no algo a reportar.
  const hayAlgo =
    borrador.descripcion.trim() !== "" ||
    borrador.cantidad.trim() !== "" ||
    dims.some((d) => borrador[d].trim() !== "");

  const agregar = () => {
    if (!hayAlgo || pending) return;
    startTransition(async () => {
      const result = await crearMedicion(proyectoId, item.id, aDatos(borrador));
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onCreated(result.medicion);
      setBorrador(borradorVacio(nivelId));
      primeraCelda.current?.focus();
    });
  };

  const campo = (clave: keyof Borrador, valor: string) =>
    setBorrador((prev) => ({ ...prev, [clave]: valor }));

  return (
    <tr className="border-b bg-muted/20 last:border-b-0">
      <td className="py-1 pr-2 pl-2">
        <Input
          ref={primeraCelda}
          value={borrador.descripcion}
          onChange={(e) => campo("descripcion", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Agregar medición…"
          aria-label="Descripción de la medición nueva"
          className="h-8 px-2 text-sm"
        />
      </td>
      <td className="w-20 py-1 pr-1">
        <CeldaNumero
          valor={borrador.cantidad}
          onChange={(v) => campo("cantidad", v)}
          onEnter={agregar}
          placeholder="1"
          etiqueta="Cantidad de la medición nueva"
        />
      </td>
      {dims.map((dim) => (
        <td key={dim} className="w-24 py-1 pr-1">
          <CeldaNumero
            valor={borrador[dim]}
            onChange={(v) => campo(dim, v)}
            onEnter={agregar}
            etiqueta={`${ETIQUETA_DIMENSION[dim]} de la medición nueva`}
          />
        </td>
      ))}
      {conDesperdicio && <td className="w-20 py-1 pr-1" />}
      <td className="w-28 py-1 pr-1 text-right">
        <span className="text-sm tabular-nums text-muted-foreground">
          {hayAlgo ? formatCantidad(parcial) : ""}
        </span>
      </td>
      <td className="w-20 py-1 pr-2">
        <div className="flex justify-end">
          <Tooltip content="Agregar medición">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Agregar medición"
              disabled={!hayAlgo || pending}
              onClick={agregar}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}

/**
 * Las filas de un ítem: de dónde sale su total, nivel por nivel.
 *
 * Esta tabla es la razón de ser del módulo. El cómputo no es el número final,
 * es la lista de ambientes, medidas y cuentas que lo justifican: quien lo
 * revisa tiene que poder leer fila por fila y entender por qué el contrapiso da
 * 148 m² y por qué hacen falta 19.530 ladrillos.
 *
 * El corte por nivel es el que manda la obra: se computa, se contrata y se paga
 * por planta. Por eso los niveles están SIEMPRE, incluso vacíos — un piso sin
 * filas no es un espacio desperdiciado, es lo que todavía falta computar, y
 * verlo listado ahorra la mitad de la revisión.
 *
 * Los niveles vacíos ocupan un renglón y nada más: recién al tocar "agregar" se
 * abre su fila de carga. Con una obra de ocho pisos, diez filas de entrada
 * abiertas de gusto convertirían cada ítem en un formulario en vez de una
 * planilla.
 */
export function MedicionesTabla({
  item,
  items,
  niveles,
  totales,
  proyectoId,
  onItemChange,
}: {
  item: ItemOpcion;
  /** Todo el cómputo: hace falta para nombrar los orígenes y para derivar. */
  items: ItemOpcion[];
  niveles: NivelOpcion[];
  totales: Map<string, number>;
  proyectoId: string;
  onItemChange: (item: ItemOpcion) => void;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const dims = dimensionesDe(item.unidad);
  const total = totales.get(item.id) ?? 0;
  const porId = new Map(items.map((i) => [i.id, i]));

  // La columna de desperdicio sólo aparece si hay alguna fila derivada: en un
  // cómputo de mano de obra no existe y sería una columna vacía a lo largo de
  // toda la tabla.
  const conDesperdicio = item.mediciones.some((m) => m.origenId !== null);
  const columnas = 2 + dims.length + (conDesperdicio ? 1 : 0);

  const grupos = agruparPorNivel(item.mediciones, niveles);

  const reemplazarMedicion = (m: MedicionOpcion) =>
    onItemChange({
      ...item,
      mediciones: item.mediciones.map((x) => (x.id === m.id ? m : x)),
    });

  const agregarMedicion = (m: MedicionOpcion) =>
    onItemChange({ ...item, mediciones: [...item.mediciones, m] });

  const sacarMedicion = (id: string) =>
    onItemChange({ ...item, mediciones: item.mediciones.filter((x) => x.id !== id) });

  const abrir = (clave: string) =>
    setAbiertos((prev) => new Set(prev).add(clave));

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-md">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">Dónde</th>
              <th className="w-20 py-1.5 pr-1 text-right font-medium">Cant.</th>
              {dims.map((dim) => (
                <th key={dim} className="w-24 py-1.5 pr-1 text-right font-medium">
                  {ETIQUETA_DIMENSION[dim]}
                </th>
              ))}
              {conDesperdicio && (
                <th className="w-20 py-1.5 pr-1 text-right font-medium">Desp. %</th>
              )}
              <th className="w-28 py-1.5 pr-1 text-right font-medium">
                Parcial ({simboloUnidad(item.unidad)})
              </th>
              <th className="w-20" />
            </tr>
          </thead>

          {grupos.map((grupo) => {
            const clave = grupo.id ?? "";
            const vacio = grupo.mediciones.length === 0;
            const subtotal = subtotalNivel(grupo, item.unidad, totales);

            return (
              <tbody key={clave || "__sin__"} className="border-b last:border-b-0">
                <tr className="bg-muted/40">
                  <td colSpan={columnas} className="px-2 py-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "text-xs font-semibold tracking-wide uppercase",
                          vacio ? "text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {grupo.nombre}
                      </span>
                      {vacio && !abiertos.has(clave) && (
                        <button
                          type="button"
                          onClick={() => abrir(clave)}
                          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          agregar
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-1 pr-1 text-right">
                    {!vacio && (
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {formatCantidad(subtotal)}
                      </span>
                    )}
                  </td>
                  <td />
                </tr>

                {grupo.mediciones.map((m) => (
                  <FilaMedicion
                    key={m.id}
                    medicion={m}
                    item={item}
                    niveles={niveles}
                    origen={m.origenId ? (porId.get(m.origenId) ?? null) : null}
                    totalOrigen={m.origenId ? (totales.get(m.origenId) ?? 0) : 0}
                    proyectoId={proyectoId}
                    conDesperdicio={conDesperdicio}
                    onSaved={reemplazarMedicion}
                    onDeleted={sacarMedicion}
                  />
                ))}

                {(!vacio || abiertos.has(clave)) && (
                  <FilaNueva
                    item={item}
                    nivelId={clave}
                    proyectoId={proyectoId}
                    conDesperdicio={conDesperdicio}
                    onCreated={agregarMedicion}
                  />
                )}
              </tbody>
            );
          })}

          {item.mediciones.length > 0 && (
            <tfoot>
              <tr className="border-t-2">
                <td className="px-2 py-2 text-xs text-muted-foreground" colSpan={columnas}>
                  {item.mediciones.length} {item.mediciones.length === 1 ? "fila" : "filas"}
                  {item.mediciones.some((m) => m.deduccion) && " (las rojas descuentan)"}
                </td>
                <td className="py-2 pr-1 text-right text-sm font-semibold tabular-nums">
                  {formatCantidad(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="px-2 pb-1">
        <DerivarDialog
          proyectoId={proyectoId}
          item={item}
          items={items}
          totales={totales}
          onCreated={agregarMedicion}
          trigger={
            <Button type="button" variant="ghost" size="xs" className="text-muted-foreground">
              <CornerDownRight className="h-3.5 w-3.5" />
              Sale de otro ítem
            </Button>
          }
        />
      </div>
    </div>
  );
}
