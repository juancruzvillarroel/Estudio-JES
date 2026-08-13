"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = { id: string; nombre: string; subrubros: SubrubroOpcion[] };

/** Sentinelas para agrupar gastos que (por datos viejos) no tienen rubro/subrubro asignado. */
const SIN_RUBRO = "sin-rubro";
const SIN_SUBRUBRO = "sin-subrubro";

const MESES_ABREV = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatUSD(monto: number) {
  if (!monto) return "-";
  return monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Convierte un movimiento a su equivalente en dólares. Si está cargado en
 * pesos pero no tiene tipo de cambio asociado, no se puede convertir (null).
 */
function montoUSD(m: MovimientoFondoOpcion): number | null {
  if (m.moneda === "USD") return m.monto;
  if (m.tipoCambio) return m.monto / m.tipoCambio;
  return null;
}

/** Clave de mes en formato "YYYY-MM" a partir de una fecha ISO. */
function claveMes(fechaISO: string) {
  return fechaISO.slice(0, 7);
}

function formatClaveMes(clave: string) {
  const [anio, mes] = clave.split("-").map(Number);
  return `${MESES_ABREV[mes - 1]}-${String(anio).slice(2)}`;
}

function sumarMesClave(clave: string, delta: number) {
  const [anio, mes] = clave.split("-").map(Number);
  const total = anio * 12 + (mes - 1) + delta;
  const anioNuevo = Math.floor(total / 12);
  const mesNuevo = (total % 12) + 1;
  return `${anioNuevo}-${String(mesNuevo).padStart(2, "0")}`;
}

type MovimientoConUSD = MovimientoFondoOpcion & { usd: number };

type FilaGrupo = {
  id: string;
  nombre: string;
  celdas: Map<string, number>;
  total: number;
};

type FilaRubro = FilaGrupo & {
  subrubros: Map<string, FilaGrupo>;
};

export function GastosCronograma({
  rubros,
  movimientos,
}: {
  rubros: RubroOpcion[];
  movimientos: MovimientoFondoOpcion[];
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const gastos = movimientos.filter((m) => m.tipo === "GASTO");

  if (gastos.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Todavía no hay gastos cargados para este proyecto.
      </div>
    );
  }

  const conMonto = gastos.map((m) => ({ ...m, usd: montoUSD(m) }));
  const sinTipoCambio = conMonto.filter((m) => m.usd === null).length;
  const validos = conMonto.filter((m): m is MovimientoConUSD => m.usd !== null);

  // Rango de meses: desde el primer hasta el último gasto con monto válido.
  const clavesOrdenadas = validos.map((m) => claveMes(m.fecha.slice(0, 10))).sort();
  const meses: string[] = [];
  if (clavesOrdenadas.length > 0) {
    const fin = clavesOrdenadas[clavesOrdenadas.length - 1];
    let actual = clavesOrdenadas[0];
    while (actual <= fin) {
      meses.push(actual);
      actual = sumarMesClave(actual, 1);
    }
  }

  const gruposPorId = new Map<string, FilaRubro>();

  // Sembramos el catálogo completo de rubros/subrubros para que se vea el
  // listado completo, incluso los que todavía no tienen gastos cargados.
  for (const rubro of rubros) {
    gruposPorId.set(rubro.id, {
      id: rubro.id,
      nombre: rubro.nombre,
      celdas: new Map(),
      total: 0,
      subrubros: new Map(
        rubro.subrubros.map((s) => [s.id, { id: s.id, nombre: s.nombre, celdas: new Map(), total: 0 }])
      ),
    });
  }

  for (const m of validos) {
    const mes = claveMes(m.fecha.slice(0, 10));

    const rubroId = m.rubroId ?? SIN_RUBRO;
    let grupo = gruposPorId.get(rubroId);
    if (!grupo) {
      grupo = {
        id: rubroId,
        nombre: m.rubroNombre ?? "Sin rubro",
        celdas: new Map(),
        total: 0,
        subrubros: new Map(),
      };
      gruposPorId.set(rubroId, grupo);
    }
    grupo.celdas.set(mes, (grupo.celdas.get(mes) ?? 0) + m.usd);
    grupo.total += m.usd;

    const subrubroId = m.subrubroId ?? SIN_SUBRUBRO;
    let sub = grupo.subrubros.get(subrubroId);
    if (!sub) {
      sub = { id: subrubroId, nombre: m.subrubroNombre ?? "Sin subrubro", celdas: new Map(), total: 0 };
      grupo.subrubros.set(subrubroId, sub);
    }
    sub.celdas.set(mes, (sub.celdas.get(mes) ?? 0) + m.usd);
    sub.total += m.usd;
  }

  // Se mantiene el orden del catálogo (por código/orden), no por lo gastado:
  // los rubros ya vienen ordenados así en `rubros`, y el Map preserva ese
  // orden de inserción. "Sin rubro" (si aparece) queda al final.
  const filas = Array.from(gruposPorId.values()).filter((g) => g.id !== SIN_RUBRO || g.total > 0);

  const totalGeneral = filas.reduce((acc, f) => acc + f.total, 0);
  const totalesPorMes = new Map<string, number>();
  for (const mes of meses) {
    totalesPorMes.set(mes, filas.reduce((acc, f) => acc + (f.celdas.get(mes) ?? 0), 0));
  }

  const acumuladosPorMes = new Map<string, number>();
  let acumulado = 0;
  for (const mes of meses) {
    acumulado += totalesPorMes.get(mes) ?? 0;
    acumuladosPorMes.set(mes, acumulado);
  }

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {sinTipoCambio > 0 && (
        <p className="text-xs text-muted-foreground">
          {sinTipoCambio === 1
            ? "1 gasto en pesos no tiene tipo de cambio cargado y no se incluye en la tabla."
            : `${sinTipoCambio} gastos en pesos no tienen tipo de cambio cargado y no se incluyen en la tabla.`}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-800 text-white">
              <th className="sticky left-0 z-10 min-w-[180px] border-b border-neutral-700 bg-neutral-800 px-3 py-2 text-left font-semibold">
                Rubro
              </th>
              {meses.map((mes) => (
                <th
                  key={mes}
                  className="min-w-[80px] border-b border-neutral-700 px-2 py-2 text-right font-medium"
                >
                  {formatClaveMes(mes)}
                </th>
              ))}
              <th className="min-w-[100px] border-b border-l border-neutral-700 px-2 py-2 text-right font-semibold">
                Total (USD)
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const subrubros = Array.from(fila.subrubros.values()).filter(
                (s) => s.id !== SIN_SUBRUBRO || s.total > 0
              );
              const expandible = subrubros.length > 0;
              const abierto = expandidos.has(fila.id);

              return (
                <Fragment key={fila.id}>
                  <tr className="border-b hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium">
                      <button
                        type="button"
                        onClick={() => expandible && toggle(fila.id)}
                        disabled={!expandible}
                        className={cn(
                          "flex items-center gap-1.5 text-left",
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
                    {meses.map((mes) => (
                      <td key={mes} className="px-2 py-1.5 text-right tabular-nums">
                        {formatUSD(fila.celdas.get(mes) ?? 0)}
                      </td>
                    ))}
                    <td className="border-l px-2 py-1.5 text-right font-semibold tabular-nums">
                      {formatUSD(fila.total)}
                    </td>
                  </tr>
                  {abierto &&
                    subrubros.map((sub) => (
                      <tr key={sub.id} className="border-b bg-muted/10">
                        <td className="sticky left-0 z-10 bg-muted/10 py-1.5 pr-3 pl-9 text-muted-foreground">
                          {sub.nombre}
                        </td>
                        {meses.map((mes) => (
                          <td
                            key={mes}
                            className="px-2 py-1.5 text-right tabular-nums text-muted-foreground"
                          >
                            {formatUSD(sub.celdas.get(mes) ?? 0)}
                          </td>
                        ))}
                        <td className="border-l px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {formatUSD(sub.total)}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-semibold">
              <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2">Total</td>
              {meses.map((mes) => (
                <td key={mes} className="px-2 py-2 text-right tabular-nums">
                  {formatUSD(totalesPorMes.get(mes) ?? 0)}
                </td>
              ))}
              <td className="border-l px-2 py-2 text-right tabular-nums">{formatUSD(totalGeneral)}</td>
            </tr>
            <tr className="bg-muted/20 font-semibold text-muted-foreground">
              <td className="sticky left-0 z-10 bg-muted/20 px-3 py-2">Total acumulado</td>
              {meses.map((mes) => (
                <td key={mes} className="px-2 py-2 text-right tabular-nums">
                  {formatUSD(acumuladosPorMes.get(mes) ?? 0)}
                </td>
              ))}
              <td className="border-l px-2 py-2 text-right tabular-nums">{formatUSD(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
