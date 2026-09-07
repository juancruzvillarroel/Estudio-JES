"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CURVAS,
  CURVA_INFO,
  distribuir,
  formatMes,
  formatMesLargo,
  formatMonto,
  formatPorcentaje,
  formatUSD,
  pesosCurva,
  porcentajesExactos,
  tramoSugerido,
  type CurvaPresupuesto,
  type FilaPresupuesto,
  type GrillaPresupuesto,
  type PresupuestoItemOpcion,
} from "@/lib/presupuesto";
import {
  guardarPresupuestoItem,
  moverPresupuestoItem,
  reacomodarPresupuesto,
} from "@/actions/presupuesto";
import { PresupuestoCurva } from "@/components/flujo-fondos/presupuesto-curva";

/**
 * Ancho de una columna de mes, en píxeles.
 *
 * Es fijo y la tabla scrollea, en vez de repartir el ancho disponible entre los
 * meses que haya. Dos motivos: con 24 meses un ancho proporcional deja columnas
 * de 30px donde no entra ni "12.500", y sobre todo el arrastre se vuelve
 * trivial de calcular —píxeles sobre ancho fijo da meses— sin tener que medir
 * el contenedor ni recalcular cuando la ventana cambia de tamaño.
 */
const ANCHO_MES = 88;

/**
 * Cómo se leen los números de la grilla.
 *
 * "monto" es cuánta plata cae ese mes; "porcentaje" es qué parte del total de
 * esa misma fila representa. Son dos preguntas distintas sobre los mismos
 * datos: una sirve para pagar, la otra para ver la forma del gasto sin que un
 * rubro caro tape a uno barato.
 */
type ModoLectura = "monto" | "porcentaje";

/** Ancho de la columna de nombres, que queda fija mientras se scrollea. */
const ANCHO_NOMBRE = 260;

/**
 * Estado de un arrastre en curso.
 *
 * Se guarda el punto de partida (`xInicial` y los valores originales) y no el
 * último movimiento porque cada `pointermove` se calcula contra el origen: si
 * se fuera acumulando delta a delta, los redondeos a mes entero se sumarían y
 * la barra terminaría corrida respecto del mouse.
 */
type Arrastre = {
  clave: string;
  itemId: string;
  modo: "mover" | "inicio" | "fin";
  xInicial: number;
  mesInicioOriginal: number;
  duracionOriginal: number;
  mesInicio: number;
  duracion: number;
  /** Si el puntero llegó a cambiar algo. Distingue un arrastre de un clic. */
  movio: boolean;
};

function clamp(valor: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valor));
}

/**
 * Flujo de egresos proyectado: cuándo se gasta lo que se presupuestó.
 *
 * Es la mitad "cuándo" de la solapa Presupuesto. Los montos no se tocan acá —se
 * cargan en Rubros—: cada rubro presupuestado es una barra que se corre y se
 * estira sobre los meses de la obra, y una curva decide cómo se reparte el
 * total adentro de ese tramo. Los montos mensuales nunca se escriben, se
 * derivan; es lo que separa esto de una planilla.
 */
export function PresupuestoFlujo({
  proyectoId,
  grilla,
  fechaInicio,
  duracionMeses,
  onGuardado,
  onIrADatos,
  onIrARubros,
}: {
  proyectoId: string;
  grilla: GrillaPresupuesto;
  fechaInicio: string | null;
  duracionMeses: number | null;
  onGuardado: (item: PresupuestoItemOpcion) => void;
  /** Lleva a "Datos del proyecto" cuando falta la línea de tiempo. */
  onIrADatos?: () => void;
  /** Lleva a la sub-solapa Rubros cuando no hay ningún monto cargado. */
  onIrARubros?: () => void;
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [verEjecutado, setVerEjecutado] = useState(false);
  const [modo, setModo] = useState<ModoLectura>("monto");
  const [, startTransition] = useTransition();

  /**
   * Los textos de una fila entera, según el modo.
   *
   * Devuelve el arreglo completo y no el texto de una celda porque el porcentaje
   * se reparte por resto mayor mirando la fila junta: redondeando cada celda por
   * su cuenta, un rubro parejo de 18 meses muestra dieciocho "5,6%" que suman
   * 100,8%. El reparto le da la décima que sobra a los meses de resto más alto,
   * así lo que se ve suma 100,0% exacto.
   *
   * Sirve para las filas que se reparten un total —una barra, el egreso del
   * mes—; el acumulado va por otro camino.
   */
  const textos = (valores: number[]) =>
    modo === "porcentaje"
      ? porcentajesExactos(valores).map(formatPorcentaje)
      : valores.map(formatMonto);

  /**
   * Textos de una fila acumulada.
   *
   * Acá cada celda no es una parte de un reparto sino "cuánto llevo puesto sobre
   * el total", así que se divide contra el total y no contra la suma de la fila
   * —que sumaría muchas veces la misma plata—. El último mes da 100% solo.
   */
  const textosAcumulados = (valores: number[], total: number) =>
    modo === "porcentaje"
      ? valores.map((v) => (total > 0 ? formatPorcentaje(Math.round((v / total) * 1000) / 10) : ""))
      : valores.map(formatMonto);

  /**
   * Reacomoda todas las líneas cargadas según la etapa de obra de su rubro.
   *
   * Existe porque el estimado automático solo se aplica a las líneas nuevas: las
   * que ya estaban cargadas —o las de una obra a la que le cambiaron la
   * duración— se quedaron donde estaban. Es un botón y no algo automático
   * porque pisa tramos que el usuario pudo haber acomodado a mano.
   */
  const reacomodar = () => {
    if (!duracionMeses) return;
    const total = grilla.filas.length;
    const tramos = grilla.filas.flatMap((fila, indice) => {
      const posicion = { indice, total };
      const sugerido = tramoSugerido(fila.nombre, duracionMeses, posicion);
      const lineas = [
        ...(fila.item ? [fila.item] : []),
        ...fila.subrubros.flatMap((s) => (s.item ? [s.item] : [])),
      ];
      return lineas.map((item) => ({ itemId: item.id, ...sugerido }));
    });

    if (tramos.length === 0) return;

    startTransition(async () => {
      const result = await reacomodarPresupuesto(proyectoId, tramos);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      for (const item of result.items) onGuardado(item);
      toast.success(
        `Se reacomodaron ${result.items.length} ${
          result.items.length === 1 ? "línea" : "líneas"
        } según la etapa de obra de cada rubro.`
      );
    });
  };

  if (!fechaInicio || !duracionMeses) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm font-medium">Falta la línea de tiempo de la obra</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          El flujo proyectado ubica cada rubro en un tramo de meses. Cargá la fecha de inicio y la
          duración de la obra en Datos del proyecto y esta pantalla se dibuja sola.
        </p>
        {onIrADatos && (
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onIrADatos}>
            Ir a Datos del proyecto
          </Button>
        )}
      </div>
    );
  }

  // Ya no hay estado vacío por falta de montos: sin un solo peso cargado la
  // pantalla igual muestra el reparto propuesto de los 27 rubros. Ver el plan
  // completo antes de tener precios es justamente para lo que sirve.

  const totalMeses = duracionMeses;
  const anchoTimeline = totalMeses * ANCHO_MES;
  const anchoTotal = ANCHO_NOMBRE + anchoTimeline + 110;
  const picoMensual = Math.max(...grilla.meses.map((m) => grilla.porMes.get(m) ?? 0));
  const sinMontos = grilla.totalPresupuestado === 0;

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------------------------------------------------------------------- */
  /*  Arrastre                                                               */
  /* ---------------------------------------------------------------------- */

  const empezarArrastre = (
    e: React.PointerEvent,
    clave: string,
    item: PresupuestoItemOpcion,
    modo: Arrastre["modo"]
  ) => {
    // Solo el botón principal: con el secundario se abre el menú del navegador
    // y el puntero nunca suelta, dejando la barra pegada al mouse.
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({
      clave,
      itemId: item.id,
      modo,
      xInicial: e.clientX,
      mesInicioOriginal: item.mesInicio,
      duracionOriginal: item.duracionMeses,
      mesInicio: item.mesInicio,
      duracion: item.duracionMeses,
      movio: false,
    });
  };

  const moverArrastre = (e: React.PointerEvent) => {
    if (!arrastre) return;
    const delta = Math.round((e.clientX - arrastre.xInicial) / ANCHO_MES);

    let mesInicio = arrastre.mesInicioOriginal;
    let duracion = arrastre.duracionOriginal;

    if (arrastre.modo === "mover") {
      mesInicio = clamp(arrastre.mesInicioOriginal + delta, 0, totalMeses - duracion);
    } else if (arrastre.modo === "inicio") {
      // El extremo derecho queda clavado: se corre el arranque y la duración se
      // ajusta sola. Sin esto, estirar por la izquierda movería toda la barra.
      const fin = arrastre.mesInicioOriginal + arrastre.duracionOriginal;
      mesInicio = clamp(arrastre.mesInicioOriginal + delta, 0, fin - 1);
      duracion = fin - mesInicio;
    } else {
      duracion = clamp(arrastre.duracionOriginal + delta, 1, totalMeses - mesInicio);
    }

    if (mesInicio === arrastre.mesInicio && duracion === arrastre.duracion) return;
    setArrastre({ ...arrastre, mesInicio, duracion, movio: true });
  };

  const soltarArrastre = () => {
    if (!arrastre) return;
    const a = arrastre;
    setArrastre(null);

    // Un clic seco sobre la barra abre el editor. Se distingue por `movio` y no
    // por un handler de onClick aparte, que dispararía también al final de cada
    // arrastre y abriría el popover cada vez que se corre una barra.
    if (!a.movio) {
      setEditando(a.clave);
      return;
    }
    if (a.mesInicio === a.mesInicioOriginal && a.duracion === a.duracionOriginal) return;

    startTransition(async () => {
      const result = await moverPresupuestoItem(proyectoId, a.itemId, a.mesInicio, a.duracion);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onGuardado(result.item);
    });
  };

  /* ---------------------------------------------------------------------- */
  /*  Piezas del render                                                      */
  /* ---------------------------------------------------------------------- */

  const barra = (clave: string, item: PresupuestoItemOpcion, tono: "rubro" | "subrubro") => {
    const activo = arrastre?.itemId === item.id;
    const mesInicio = activo ? arrastre.mesInicio : item.mesInicio;
    const duracion = activo ? arrastre.duracion : item.duracionMeses;
    // Lo que se gasta cada mes de la barra. Es lo mismo que suma la fila de
    // totales de abajo, así que el número que se lee acá y el de la columna
    // cierran siempre.
    const montos = distribuir(item.montoUSD, item.curva, duracion);
    const maxMonto = Math.max(...montos);
    const etiquetas = textos(montos);

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`${formatUSD(item.montoUSD)}, de ${formatMesLargo(
          grilla.meses[mesInicio] ?? grilla.meses[0]
        )} por ${duracion} ${duracion === 1 ? "mes" : "meses"}. Arrastrá para moverlo.`}
        onPointerDown={(e) => empezarArrastre(e, clave, item, "mover")}
        onPointerMove={moverArrastre}
        onPointerUp={soltarArrastre}
        onPointerCancel={soltarArrastre}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditando(clave);
          }
        }}
        className={cn(
          "group absolute inset-y-1 flex touch-none overflow-hidden rounded-md ring-1 select-none",
          activo ? "cursor-grabbing" : "cursor-grab",
          tono === "rubro"
            ? "bg-foreground/15 ring-foreground/25"
            : "bg-foreground/10 ring-foreground/20",
          activo && "ring-2 ring-ring"
        )}
        style={{ left: mesInicio * ANCHO_MES + 2, width: duracion * ANCHO_MES - 4 }}
      >
        {/* Cada mes de la barra es una columnita: la altura dice cómo se reparte
            el gasto —así "campana" o "decreciente" se entienden sin leer la
            explicación— y encima va el monto de ese mes. La forma sola obliga a
            estimar a ojo cuánto cae en cada mes, que es justo el dato que se
            viene a buscar acá. */}
        {montos.map((monto, i) => (
          <div key={i} className="relative min-w-0 flex-1">
            <div
              className="absolute inset-x-px bottom-0 rounded-t-sm bg-foreground/20"
              style={{ height: `${Math.max(8, (monto / maxMonto) * 100)}%` }}
            />
            <span className="pointer-events-none relative flex h-full items-center justify-center overflow-hidden px-1 text-[10px] font-medium tabular-nums">
              {etiquetas[i]}
            </span>
          </div>
        ))}

        {/* Manijas para estirar. Son finas a propósito: el gesto habitual es
            correr la barra entera, estirarla es la excepción. */}
        <span
          onPointerDown={(e) => empezarArrastre(e, clave, item, "inicio")}
          onPointerMove={moverArrastre}
          onPointerUp={soltarArrastre}
          onPointerCancel={soltarArrastre}
          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none transition-colors group-hover:bg-foreground/25"
        />
        <span
          onPointerDown={(e) => empezarArrastre(e, clave, item, "fin")}
          onPointerMove={moverArrastre}
          onPointerUp={soltarArrastre}
          onPointerCancel={soltarArrastre}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none transition-colors group-hover:bg-foreground/25"
        />
      </div>
    );
  };

  /**
   * La barra de un rubro que todavía no tiene monto.
   *
   * Muestra el reparto propuesto en porcentajes: en qué meses va a caer y qué
   * parte del rubro se lleva cada uno, sumando 100%. El "cuándo" no depende del
   * "cuánto", así que no hay razón para esconderlo hasta que haya un precio.
   *
   * Es de solo lectura y punteada. No se guarda nada en la base: es la misma
   * cuenta que va a usar la línea cuando se cargue el monto, así que la barra
   * aparece exactamente donde estaba la propuesta. Persistir filas en cero para
   * poder arrastrarlas dejaría basura por cada rubro que nadie presupuestó.
   */
  const barraSugerida = (fila: FilaPresupuesto, indice: number) => {
    const sugerido = tramoSugerido(fila.nombre, totalMeses, {
      indice,
      total: grilla.filas.length,
    });
    const pesos = pesosCurva(sugerido.curva, sugerido.duracionMeses);
    const maxPeso = Math.max(...pesos);
    // Siempre en porcentaje, incluso mirando la grilla en USD: sin monto
    // cargado no hay plata que mostrar, y el reparto es justamente lo que esta
    // barra viene a contar. Suman 100% exacto.
    const etiquetas = porcentajesExactos(pesos).map(formatPorcentaje);

    return (
      <div
        aria-label={`Propuesta: ${fila.nombre} de ${formatMesLargo(
          grilla.meses[sugerido.mesInicio] ?? grilla.meses[0]
        )} por ${sugerido.duracionMeses} ${sugerido.duracionMeses === 1 ? "mes" : "meses"}. Sin monto cargado.`}
        title={`Reparto propuesto. Cargá el monto en Rubros y esta línea se vuelve editable.`}
        className="pointer-events-none absolute inset-y-1 flex overflow-hidden rounded-md border border-dashed border-foreground/25 opacity-70"
        style={{
          left: sugerido.mesInicio * ANCHO_MES + 2,
          width: sugerido.duracionMeses * ANCHO_MES - 4,
        }}
      >
        {pesos.map((peso, i) => (
          <div key={i} className="relative min-w-0 flex-1">
            <div
              className="absolute inset-x-px bottom-0 rounded-t-sm bg-foreground/10"
              style={{ height: `${Math.max(8, (peso / maxPeso) * 100)}%` }}
            />
            <span className="relative flex h-full items-center justify-center overflow-hidden px-1 text-[10px] tabular-nums text-muted-foreground">
              {etiquetas[i]}
            </span>
          </div>
        ))}
      </div>
    );
  };

  /** Franja fina con el gasto real del mes, para comparar contra la barra. */
  const franjaEjecutado = (fila: FilaPresupuesto) => {
    const max = Math.max(...grilla.meses.map((m) => fila.ejecutadoPorMes.get(m) ?? 0));
    if (max <= 0) return null;
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-2.5 items-end">
        {grilla.meses.map((mes) => {
          const monto = fila.ejecutadoPorMes.get(mes) ?? 0;
          return (
            <div
              key={mes}
              className="flex h-full items-end px-px"
              style={{ width: ANCHO_MES }}
              title={`${formatMesLargo(mes)}: ${formatUSD(monto)} ejecutado`}
            >
              <div
                className="w-full rounded-t-sm bg-warning"
                style={{ height: `${(monto / max) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const celdaNombre = (
    fila: FilaPresupuesto,
    opciones: {
      clave: string;
      rubroId: string;
      subrubroId: string | null;
      derivado: boolean;
      nivel: "rubro" | "subrubro";
      /** Nombre del rubro padre: define la etapa de obra, también del subrubro. */
      nombreEtapa: string;
      indice: number;
      expandible?: boolean;
      abierto?: boolean;
      onToggle?: () => void;
    }
  ) => {
    const { clave, derivado, nivel } = opciones;
    const abiertoEditor = editando === clave;
    const item = fila.item;
    const sugerido = tramoSugerido(opciones.nombreEtapa, totalMeses, {
      indice: opciones.indice,
      total: grilla.filas.length,
    });

    const tramo = item
      ? `${formatMes(grilla.meses[clamp(item.mesInicio, 0, totalMeses - 1)])} → ${formatMes(
          grilla.meses[clamp(item.mesInicio + item.duracionMeses - 1, 0, totalMeses - 1)]
        )} · ${CURVA_INFO[item.curva].nombre}`
      : null;

    return (
      <div
        className={cn(
          "sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-0.5 border-r px-3 py-2",
          nivel === "rubro" ? "bg-background" : "bg-muted/20 pl-8"
        )}
        style={{ width: ANCHO_NOMBRE }}
      >
        <div className="flex items-center gap-1.5">
          {opciones.expandible ? (
            <button
              type="button"
              onClick={opciones.onToggle}
              className="shrink-0 text-muted-foreground"
              aria-label={opciones.abierto ? "Contraer" : "Expandir"}
            >
              {opciones.abierto ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            nivel === "rubro" && <span className="w-3.5 shrink-0" />
          )}
          <span
            className={cn(
              "truncate text-xs",
              nivel === "rubro" ? "font-medium" : "text-muted-foreground"
            )}
            title={fila.nombre}
          >
            {fila.nombre}
          </span>
        </div>

        <div className="flex items-center gap-2 pl-5">
          {derivado ? (
            <span className="text-[11px] text-muted-foreground">
              {formatUSD(fila.presupuestado)} · de subrubros
            </span>
          ) : !item ? (
            // Sin monto igual se dice cuándo pasaría y con qué forma: es lo que
            // la barra punteada está dibujando al lado.
            <span className="text-[11px] text-muted-foreground italic">
              {formatMes(grilla.meses[clamp(sugerido.mesInicio, 0, totalMeses - 1)])} →{" "}
              {formatMes(
                grilla.meses[
                  clamp(sugerido.mesInicio + sugerido.duracionMeses - 1, 0, totalMeses - 1)
                ]
              )}{" "}
              · propuesto
            </span>
          ) : (
            <Popover open={abiertoEditor} onOpenChange={(v) => setEditando(v ? clave : null)}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:bg-muted hover:text-foreground"
                  />
                }
              >
                {tramo}
              </PopoverTrigger>
              <PopoverContent className="w-80">
                {abiertoEditor && (
                  <FormularioTramo
                    proyectoId={proyectoId}
                    rubroId={opciones.rubroId}
                    subrubroId={opciones.subrubroId}
                    nombre={fila.nombre}
                    item={item}
                    meses={grilla.meses}
                    onGuardado={(guardado) => {
                      onGuardado(guardado);
                      setEditando(null);
                    }}
                  />
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    );
  };

  const desvio = grilla.totalEjecutado - grilla.totalPresupuestado;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border p-3">
        <div>
          <p className="text-xs text-muted-foreground">Presupuestado</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatUSD(grilla.totalPresupuestado)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ejecutado</p>
          <p className="text-lg font-semibold tabular-nums">{formatUSD(grilla.totalEjecutado)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Desvío</p>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums",
              desvio > 0 ? "text-error" : desvio < 0 ? "text-success" : "text-foreground"
            )}
          >
            {desvio > 0 ? "+" : ""}
            {formatUSD(desvio)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mes más pesado</p>
          <p className="text-lg font-semibold tabular-nums">{formatUSD(picoMensual)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Dos opciones con nombre y no un interruptor de sí/no: un switch
              pelado obliga a acordarse de qué significa apagado. Acá se ve al
              mismo tiempo en qué modo está y cuál es el otro. */}
          <div
            role="group"
            aria-label="Cómo leer los números"
            className="flex items-center rounded-md border p-0.5"
          >
            {(
              [
                ["monto", "USD", "Ver los montos en dólares"],
                ["porcentaje", "%", "Ver qué parte del total es cada mes"],
              ] as const
            ).map(([valor, etiqueta, ayuda]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setModo(valor)}
                aria-pressed={modo === valor}
                title={ayuda}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  modo === valor
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={reacomodar}>
            Reacomodar según la obra
          </Button>

          <Button
            type="button"
            variant={verEjecutado ? "default" : "outline"}
            size="sm"
            onClick={() => setVerEjecutado((v) => !v)}
          >
            {verEjecutado ? "Ocultar ejecutado" : "Mostrar ejecutado"}
          </Button>
        </div>
      </div>

      <PresupuestoCurva grilla={grilla} verEjecutado={verEjecutado} />

      {sinMontos && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Todavía no hay montos cargados, así que lo que ves es el{" "}
            <span className="font-medium text-foreground">reparto propuesto</span>: en qué meses cae
            cada rubro y qué porcentaje se lleva cada mes. A medida que cargues los montos, cada
            línea se planta en ese mismo lugar y los porcentajes pasan a ser plata.
          </p>
          {onIrARubros && (
            <Button type="button" variant="outline" size="sm" onClick={onIrARubros}>
              Cargar montos
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Arrastrá cada barra para moverla de mes y agarrala de las puntas para estirarla. El dibujo
        de adentro es cómo se reparte el gasto mes a mes; para cambiarlo, tocá la barra. Las líneas
        punteadas son rubros sin monto: muestran el reparto propuesto y se vuelven editables apenas
        les cargues un número.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <div style={{ minWidth: anchoTotal }}>
          {/* Encabezado de meses */}
          <div className="flex bg-neutral-800 text-white">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-semibold"
              style={{ width: ANCHO_NOMBRE }}
            >
              Rubro
            </div>
            <div className="flex shrink-0" style={{ width: anchoTimeline }}>
              {grilla.meses.map((mes, i) => (
                <div
                  key={mes}
                  className={cn(
                    "shrink-0 px-1 py-2 text-center text-[11px] font-medium",
                    i > 0 && "border-l border-neutral-700/60"
                  )}
                  style={{ width: ANCHO_MES }}
                  title={formatMesLargo(mes)}
                >
                  {formatMes(mes)}
                </div>
              ))}
            </div>
            <div className="flex-1 border-l border-neutral-700 px-2 py-2 text-right text-xs font-semibold">
              Total
            </div>
          </div>

          {/* Filas */}
          {grilla.filas.map((fila, indice) => {
            const abierto = expandidos.has(fila.id);
            const expandible = fila.subrubros.length > 0;

            return (
              <Fragment key={fila.id}>
                <div className="flex border-b hover:bg-muted/20">
                  {celdaNombre(fila, {
                    clave: fila.id,
                    rubroId: fila.id,
                    subrubroId: null,
                    derivado: fila.derivado,
                    nivel: "rubro",
                    nombreEtapa: fila.nombre,
                    indice,
                    expandible,
                    abierto,
                    onToggle: () => toggle(fila.id),
                  })}

                  <div className="relative shrink-0" style={{ width: anchoTimeline, height: 44 }}>
                    <Cuadricula meses={grilla.meses} />
                    {fila.derivado ? (
                      <BloquesDerivados fila={fila} meses={grilla.meses} textos={textos} />
                    ) : fila.item ? (
                      barra(fila.id, fila.item, "rubro")
                    ) : (
                      barraSugerida(fila, indice)
                    )}
                    {verEjecutado && franjaEjecutado(fila)}
                  </div>

                  <div className="flex flex-1 items-center justify-end px-2 text-xs font-semibold tabular-nums">
                    {formatMonto(fila.presupuestado)}
                  </div>
                </div>

                {abierto &&
                  fila.subrubros.map((sub) => {
                    const clave = `${fila.id}::${sub.id}`;
                    return (
                      <div key={sub.id} className="flex border-b bg-muted/10">
                        {celdaNombre(sub, {
                          clave,
                          rubroId: fila.id,
                          subrubroId: sub.id,
                          derivado: false,
                          nivel: "subrubro",
                          nombreEtapa: fila.nombre,
                          indice,
                        })}

                        <div
                          className="relative shrink-0"
                          style={{ width: anchoTimeline, height: 40 }}
                        >
                          <Cuadricula meses={grilla.meses} />
                          {sub.item
                            ? barra(clave, sub.item, "subrubro")
                            : // El subrubro propone el tramo de su rubro padre:
                              // la mano de obra de albañilería pasa cuando pasa
                              // la albañilería.
                              barraSugerida({ ...sub, nombre: fila.nombre }, indice)}
                          {verEjecutado && franjaEjecutado(sub)}
                        </div>

                        <div className="flex flex-1 items-center justify-end px-2 text-xs tabular-nums text-muted-foreground">
                          {formatMonto(sub.presupuestado)}
                        </div>
                      </div>
                    );
                  })}
              </Fragment>
            );
          })}

          {/* Totales */}
          <TotalFila
            titulo="Egreso del mes"
            meses={grilla.meses}
            valores={grilla.porMes}
            total={grilla.totalPresupuestado}
            className="bg-muted/40 font-semibold"
            anchoTimeline={anchoTimeline}
            textos={textos}
          />
          <TotalFila
            titulo="Acumulado"
            meses={grilla.meses}
            valores={grilla.acumuladoPorMes}
            total={grilla.totalPresupuestado}
            className="bg-muted/20 text-muted-foreground"
            anchoTimeline={anchoTimeline}
            textos={(valores) => textosAcumulados(valores, grilla.totalPresupuestado)}
          />
          {verEjecutado && (
            <TotalFila
              titulo="Ejecutado del mes"
              meses={grilla.meses}
              valores={grilla.ejecutadoPorMes}
              total={grilla.totalEjecutado}
              className="bg-warning/10 text-warning"
              anchoTimeline={anchoTimeline}
              textos={textos}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Líneas verticales que separan los meses, para poder leer dónde cae una barra. */
function Cuadricula({ meses }: { meses: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {meses.map((mes, i) => (
        <div
          key={mes}
          className={cn("h-full shrink-0", i > 0 && "border-l border-foreground/5")}
          style={{ width: ANCHO_MES }}
        />
      ))}
    </div>
  );
}

/**
 * Timeline de un rubro cuyo total sale de los subrubros: en vez de una barra
 * arrastrable, bloques por mes con la suma de lo que aportan sus subrubros.
 *
 * No es interactivo a propósito. Arrastrar acá tendría que repartir el
 * movimiento entre varios subrubros de alguna manera que el usuario no pidió;
 * es más honesto mostrar el resultado y mandar a editar el detalle.
 */
function BloquesDerivados({
  fila,
  meses,
  textos,
}: {
  fila: FilaPresupuesto;
  meses: string[];
  textos: (valores: number[]) => string[];
}) {
  const montos = meses.map((m) => fila.porMes.get(m) ?? 0);
  const max = Math.max(...montos);
  if (max <= 0) return null;

  const etiquetas = textos(montos);

  return (
    <div className="pointer-events-none absolute inset-y-2 left-0 flex">
      {meses.map((mes, i) => {
        const monto = montos[i]!;
        return (
          <div key={mes} className="relative h-full px-0.5" style={{ width: ANCHO_MES }}>
            {monto > 0 && (
              <>
                <div
                  className="absolute inset-x-0.5 bottom-0 rounded-sm bg-foreground/20"
                  style={{ height: `${Math.max(12, (monto / max) * 100)}%` }}
                />
                <span className="relative flex h-full items-center justify-center overflow-hidden text-[10px] font-medium tabular-nums">
                  {etiquetas[i]}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TotalFila({
  titulo,
  meses,
  valores,
  total,
  className,
  anchoTimeline,
  textos,
}: {
  titulo: string;
  meses: string[];
  valores: Map<string, number>;
  total: number;
  className?: string;
  anchoTimeline: number;
  textos: (valores: number[]) => string[];
}) {
  const etiquetas = textos(meses.map((m) => valores.get(m) ?? 0));

  return (
    <div className={cn("flex border-t text-xs", className)}>
      <div
        className={cn("sticky left-0 z-10 shrink-0 border-r px-3 py-2", className)}
        style={{ width: ANCHO_NOMBRE }}
      >
        {titulo}
      </div>
      <div className="flex shrink-0" style={{ width: anchoTimeline }}>
        {meses.map((mes, i) => (
          <div
            key={mes}
            className="shrink-0 px-1 py-2 text-right tabular-nums"
            style={{ width: ANCHO_MES }}
          >
            {etiquetas[i]}
          </div>
        ))}
      </div>
      {/* La columna Total va siempre en plata, incluso mirando porcentajes: es
          el ancla que le da escala a la fila. Un "100,0%" acá no diría nada. */}
      <div className="flex-1 border-l px-2 py-2 text-right tabular-nums">{formatMonto(total)}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editor del tramo                                                           */
/* -------------------------------------------------------------------------- */

/**
 * El "cuándo" de una línea: en qué mes arranca, cuánto dura y cómo se reparte.
 *
 * El monto no está acá a propósito: se carga en la sub-solapa Rubros. Tener el
 * mismo número editable en dos lugares invita a que uno de los dos quede viejo.
 *
 * El tramo también se puede escribir, aunque el gesto natural sea arrastrar,
 * porque arrastrar no funciona con teclado y porque a veces se sabe el número
 * exacto ("son cuatro meses") y apuntar con el mouse es más trabajo.
 */
function FormularioTramo({
  proyectoId,
  rubroId,
  subrubroId,
  nombre,
  item,
  meses,
  onGuardado,
}: {
  proyectoId: string;
  rubroId: string;
  subrubroId: string | null;
  nombre: string;
  item: PresupuestoItemOpcion;
  meses: string[];
  onGuardado: (item: PresupuestoItemOpcion) => void;
}) {
  const [curva, setCurva] = useState<CurvaPresupuesto>(item.curva);
  const [mesInicio, setMesInicio] = useState(item.mesInicio);
  const [duracion, setDuracion] = useState(item.duracionMeses);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const guardar = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await guardarPresupuestoItem(proyectoId, {
        rubroId,
        subrubroId,
        montoUSD: item.montoUSD,
        mesInicio: clamp(mesInicio, 0, Math.max(0, meses.length - duracion)),
        duracionMeses: clamp(duracion, 1, meses.length),
        curva,
        notas: item.notas,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onGuardado(result.item);
    });
  };

  const desde = meses[clamp(mesInicio, 0, meses.length - 1)];
  const hasta = meses[clamp(mesInicio + duracion - 1, 0, meses.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold">{nombre}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatUSD(item.montoUSD)} · el monto se edita en Rubros
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mesInicioTramo" className="text-xs">
            Empieza en el mes
          </Label>
          <Input
            id="mesInicioTramo"
            inputMode="numeric"
            className="w-20"
            value={String(mesInicio + 1)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n)) setMesInicio(clamp(n - 1, 0, meses.length - 1));
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="duracionTramo" className="text-xs">
            Dura (meses)
          </Label>
          <Input
            id="duracionTramo"
            inputMode="numeric"
            className="w-20"
            value={String(duracion)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n)) setDuracion(clamp(n, 1, meses.length));
            }}
          />
        </div>
        <p className="pb-2 text-[11px] text-muted-foreground">
          {formatMes(desde)} → {formatMes(hasta)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Cómo se reparte</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {CURVAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurva(c)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
                curva === c ? "border-foreground bg-muted" : "hover:bg-muted/50"
              )}
            >
              <span className="font-medium">{CURVA_INFO[c].nombre}</span>
              <MiniCurva curva={c} />
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {CURVA_INFO[curva].ayuda} <span className="italic">{CURVA_INFO[curva].ejemplo}</span>
        </p>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      <Button type="button" size="sm" onClick={guardar} disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

/** Miniatura de la forma de una curva, para elegirla de un vistazo. */
function MiniCurva({ curva }: { curva: CurvaPresupuesto }) {
  const pesos = pesosCurva(curva, 6);
  const max = Math.max(...pesos);
  return (
    <span className="flex h-4 w-full items-end gap-px">
      {pesos.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[1px] bg-foreground/40"
          style={{ height: `${(p / max) * 100}%` }}
        />
      ))}
    </span>
  );
}
