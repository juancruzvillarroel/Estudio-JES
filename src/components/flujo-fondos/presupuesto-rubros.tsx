"use client";

import { Fragment, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatUSD,
  tramoSugerido,
  type FilaPresupuesto,
  type GrillaPresupuesto,
  type PresupuestoItemOpcion,
} from "@/lib/presupuesto";
import { eliminarPresupuestoItem, guardarPresupuestoItem } from "@/actions/presupuesto";

/**
 * Carga del presupuesto: cuánto sale cada rubro.
 *
 * Es la mitad "cuánto" de la solapa Presupuesto; el "cuándo" vive en el flujo
 * proyectado. Separarlas es lo que evita que esto se convierta en una planilla:
 * acá se piensa en plata y no en calendario, y son dos momentos distintos del
 * trabajo.
 *
 * Los montos se guardan al salir del campo y no con un botón por fila. Cargar
 * un presupuesto es escribir veinte números seguidos, y veinte clics de más
 * entre número y número es lo que hace que se abandone a mitad de camino.
 */
export function PresupuestoRubros({
  proyectoId,
  grilla,
  /** Duración de la obra, para el tramo por defecto de una línea nueva. */
  totalMeses,
  onGuardado,
  onEliminado,
}: {
  proyectoId: string;
  grilla: GrillaPresupuesto;
  totalMeses: number;
  onGuardado: (item: PresupuestoItemOpcion) => void;
  onEliminado: (itemId: string) => void;
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const desvioTotal = grilla.totalEjecutado - grilla.totalPresupuestado;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Cargá cuánto pensás gastar en cada rubro, en dólares. Si abrís un rubro y presupuestás sus
        subrubros, el total del rubro pasa a ser la suma de ellos. Cuándo se gasta cada uno se
        acomoda en Flujo proyectado.
      </p>

      {grilla.gastosSinTipoCambio > 0 && (
        <p className="text-xs text-muted-foreground">
          {grilla.gastosSinTipoCambio === 1
            ? "1 gasto en pesos no tiene tipo de cambio cargado y no entra en la comparación."
            : `${grilla.gastosSinTipoCambio} gastos en pesos no tienen tipo de cambio cargado y no entran en la comparación.`}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-800 text-white">
              <th className="min-w-[220px] px-3 py-2 text-left text-xs font-semibold">Rubro</th>
              <th className="w-48 px-3 py-2 text-right text-xs font-semibold">Presupuestado</th>
              <th className="w-32 px-3 py-2 text-right text-xs font-semibold">Ejecutado</th>
              <th className="w-32 px-3 py-2 text-right text-xs font-semibold">Desvío</th>
            </tr>
          </thead>
          <tbody>
            {grilla.filas.map((fila, indice) => {
              const expandible = fila.subrubros.length > 0;
              const abierto = expandidos.has(fila.id);
              const posicion = { indice, total: grilla.filas.length };

              return (
                <Fragment key={fila.id}>
                  <tr className="border-b hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => expandible && toggle(fila.id)}
                        disabled={!expandible}
                        className={cn(
                          "flex items-center gap-1.5 text-left font-medium",
                          expandible ? "cursor-pointer" : "cursor-default"
                        )}
                      >
                        {expandible ? (
                          abierto ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        {fila.nombre}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {fila.derivado ? (
                        <span
                          className="text-xs tabular-nums text-muted-foreground"
                          title="Es la suma de los subrubros presupuestados. Para cambiarlo, editá el detalle."
                        >
                          {formatUSD(fila.presupuestado)}
                          <span className="ml-1 opacity-70">· de subrubros</span>
                        </span>
                      ) : (
                        <CampoMonto
                          proyectoId={proyectoId}
                          rubroId={fila.id}
                          subrubroId={null}
                          item={fila.item}
                          totalMeses={totalMeses}
                          nombreRubro={fila.nombre}
                          posicion={posicion}
                          onGuardado={onGuardado}
                          onEliminado={onEliminado}
                        />
                      )}
                    </td>
                    <CeldasComparacion fila={fila} />
                  </tr>

                  {abierto &&
                    fila.subrubros.map((sub) => (
                      <tr key={sub.id} className="border-b bg-muted/10">
                        <td className="py-1.5 pr-3 pl-10 text-muted-foreground">{sub.nombre}</td>
                        <td className="px-3 py-1.5 text-right">
                          <CampoMonto
                            proyectoId={proyectoId}
                            rubroId={fila.id}
                            subrubroId={sub.id}
                            item={sub.item}
                            totalMeses={totalMeses}
                            // El subrubro hereda la etapa de su rubro: la mano
                            // de obra de albañilería pasa cuando pasa la
                            // albañilería.
                            nombreRubro={fila.nombre}
                            posicion={posicion}
                            onGuardado={onGuardado}
                            onEliminado={onEliminado}
                          />
                        </td>
                        <CeldasComparacion fila={sub} />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatUSD(grilla.totalPresupuestado)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatUSD(grilla.totalEjecutado)}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums",
                  desvioTotal > 0 ? "text-error" : desvioTotal < 0 ? "text-success" : ""
                )}
              >
                {grilla.totalPresupuestado > 0
                  ? `${desvioTotal > 0 ? "+" : ""}${formatUSD(desvioTotal)}`
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * Ejecutado y desvío de una fila.
 *
 * El desvío se muestra solo si hay algo presupuestado: contra un presupuesto en
 * cero cualquier gasto da "+todo", que es cierto pero no dice nada y llena la
 * tabla de rojo antes de que el usuario haya terminado de cargar.
 */
function CeldasComparacion({ fila }: { fila: FilaPresupuesto }) {
  const desvio = fila.ejecutado - fila.presupuestado;
  return (
    <>
      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
        {fila.ejecutado > 0 ? formatUSD(fila.ejecutado) : "—"}
      </td>
      <td
        className={cn(
          "px-3 py-1.5 text-right text-xs tabular-nums",
          fila.presupuestado > 0
            ? desvio > 0
              ? "text-error"
              : desvio < 0
                ? "text-success"
                : "text-muted-foreground"
            : "text-muted-foreground"
        )}
      >
        {fila.presupuestado > 0 ? `${desvio > 0 ? "+" : ""}${formatUSD(desvio)}` : "—"}
      </td>
    </>
  );
}

type Estado = "quieto" | "guardando" | "guardado" | "error";

/**
 * Convierte lo tecleado a número. Se aceptan "85.000" y "85000,50": el punto de
 * miles y la coma decimal son como se escribe acá, y pelearle a eso sería
 * pedirle al usuario que teclee en un formato que no usa en ningún otro lado.
 */
function parsearMonto(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

/**
 * Le pone los puntos de miles a lo que se está tecleando, tolerando un decimal
 * a medio escribir: "8500" → "8.500", "8500," → "8.500,", "8500,5" → "8.500,5".
 *
 * Se formatea en cada tecla y no al salir del campo. Un presupuesto de seis
 * cifras sin puntos no se puede leer, y si el separador aparece recién al
 * confirmar uno no tiene forma de darse cuenta de que escribió un cero de más
 * justo cuando todavía puede corregirlo.
 */
function formatearMientrasEscribe(raw: string): string {
  const limpio = raw.replace(/[^\d,]/g, "");
  const [entera = "", ...resto] = limpio.split(",");
  const conPuntos = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (resto.length === 0) return conPuntos;
  return `${conPuntos},${resto.join("").slice(0, 2)}`;
}

/** Cómo se muestra un monto ya guardado. */
function mostrarMonto(valor: number): string {
  return valor.toLocaleString("es-AR", {
    minimumFractionDigits: Number.isInteger(valor) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * El campo donde se escribe el monto de un rubro o subrubro.
 *
 * Vaciarlo borra la línea. Es lo que uno espera —si no hay número, no hay
 * presupuesto— y evita tener que explicar un botón de borrar por fila en una
 * tabla que ya tiene una fila por rubro.
 */
function CampoMonto({
  proyectoId,
  rubroId,
  subrubroId,
  item,
  totalMeses,
  nombreRubro,
  posicion,
  onGuardado,
  onEliminado,
}: {
  proyectoId: string;
  rubroId: string;
  subrubroId: string | null;
  item: PresupuestoItemOpcion | null;
  totalMeses: number;
  /** Nombre del rubro padre: con eso se sabe en qué etapa de la obra cae. */
  nombreRubro: string;
  /** Posición del rubro en la lista, para ubicar a los que no están en la tabla. */
  posicion: { indice: number; total: number };
  onGuardado: (item: PresupuestoItemOpcion) => void;
  onEliminado: (itemId: string) => void;
}) {
  const guardado = item ? mostrarMonto(item.montoUSD) : "";
  const [texto, setTexto] = useState(guardado);
  const [prevGuardado, setPrevGuardado] = useState(guardado);
  const [estado, setEstado] = useState<Estado>("quieto");
  const [, startTransition] = useTransition();

  if (guardado !== prevGuardado) {
    setPrevGuardado(guardado);
    setTexto(guardado);
  }

  const confirmar = () => {
    const limpio = texto.trim();
    // Se compara el número y no el texto: "85.000" y "85000" son el mismo
    // presupuesto, y salir del campo sin haber cambiado nada no tiene por qué
    // disparar un guardado.
    if (limpio === guardado.trim()) return;
    if (item && limpio !== "" && parsearMonto(limpio) === item.montoUSD) return;

    if (limpio === "") {
      if (!item) return;
      setEstado("guardando");
      startTransition(async () => {
        const result = await eliminarPresupuestoItem(proyectoId, item.id);
        if (!result.success) {
          setEstado("error");
          return;
        }
        setEstado("quieto");
        onEliminado(item.id);
      });
      return;
    }

    const valor = parsearMonto(limpio);
    if (!Number.isFinite(valor) || valor <= 0) {
      setEstado("error");
      return;
    }

    setEstado("guardando");
    startTransition(async () => {
      // Una línea nueva cae en el tramo que le toca a ese rubro en una obra de
      // esta duración: la estructura al principio, la pintura sobre el final.
      // Si la línea ya existía no se toca nada del calendario —el usuario pudo
      // haber movido la barra a mano y cambiar el monto no puede pisarlo—.
      const sugerido = tramoSugerido(nombreRubro, totalMeses, posicion);

      const result = await guardarPresupuestoItem(proyectoId, {
        rubroId,
        subrubroId,
        montoUSD: valor,
        mesInicio: item?.mesInicio ?? sugerido.mesInicio,
        duracionMeses: item?.duracionMeses ?? sugerido.duracionMeses,
        curva: item?.curva ?? sugerido.curva,
      });
      if (!result.success) {
        setEstado("error");
        return;
      }
      setEstado("guardado");
      onGuardado(result.item);
    });
  };

  /**
   * Reformatea y devuelve el cursor a donde estaba.
   *
   * Al insertar un punto de miles la cadena crece y el cursor se correría solo;
   * se cuenta cuántos dígitos quedaban a la derecha y se lo reubica dejando esos
   * mismos a la derecha, así escribir en el medio de un número no lo manda al
   * final en cada tecla.
   */
  const alEscribir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const campo = e.currentTarget;
    const crudo = campo.value;
    const corte = campo.selectionStart ?? crudo.length;
    const aDerecha = crudo.slice(corte).replace(/[^\d,]/g, "").length;

    const formateado = formatearMientrasEscribe(crudo);
    setTexto(formateado);
    setEstado("quieto");

    requestAnimationFrame(() => {
      let i = formateado.length;
      let vistos = 0;
      while (i > 0 && vistos < aDerecha) {
        i--;
        if (/[\d,]/.test(formateado[i]!)) vistos++;
      }
      campo.setSelectionRange(i, i);
    });
  };

  return (
    <span className="flex items-center justify-end gap-1.5">
      {estado === "guardando" && <span className="text-[10px] text-muted-foreground">…</span>}
      {estado === "guardado" && <Check className="h-3.5 w-3.5 text-success" />}
      <span className="relative inline-block">
        {/* El "USD" queda dentro del campo y no en el encabezado nada más: al
            cargar veinte montos seguidos uno mira la fila, no la cabecera. */}
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground select-none">
          USD
        </span>
        <Input
          inputMode="decimal"
          placeholder="—"
          value={texto}
          onChange={alEscribir}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTexto(guardado);
              setEstado("quieto");
            }
          }}
          className={cn(
            "h-7 w-36 pl-9 text-right text-xs tabular-nums",
            estado === "error" && "border-error"
          )}
        />
      </span>
    </span>
  );
}
