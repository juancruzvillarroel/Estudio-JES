"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = { id: string; nombre: string; subrubros: SubrubroOpcion[] };

/** Sentinelas para agrupar gastos que (por datos viejos) no tienen rubro/subrubro asignado. */
const SIN_RUBRO = "sin-rubro";
const SIN_SUBRUBRO = "sin-subrubro";

function formatUSD(monto: number) {
  return `USD ${monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPorcentaje(valor: number) {
  return `${valor.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatFechaISOCorta(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio.slice(2)}`;
}

function formatRangoFechas(desde: string, hasta: string) {
  if (!desde && !hasta) return "Todas las fechas";
  if (desde && hasta) return `${formatFechaISOCorta(desde)} – ${formatFechaISOCorta(hasta)}`;
  if (desde) return `Desde ${formatFechaISOCorta(desde)}`;
  return `Hasta ${formatFechaISOCorta(hasta)}`;
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

function ProgresoBarra({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${Math.min(porcentaje, 100)}%` }}
      />
    </div>
  );
}

type MovimientoConUSD = MovimientoFondoOpcion & { usd: number | null };

type GrupoSubrubro = {
  id: string;
  nombre: string;
  total: number;
  movimientos: MovimientoConUSD[];
};

type GrupoRubro = {
  id: string;
  nombre: string;
  total: number;
  subrubros: Map<string, GrupoSubrubro>;
};

export function RubrosResumen({
  rubros,
  movimientos,
}: {
  rubros: RubroOpcion[];
  movimientos: MovimientoFondoOpcion[];
}) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const gastos = movimientos.filter((m) => m.tipo === "GASTO");

  const filtrados = gastos.filter((m) => {
    const fechaCorta = m.fecha.slice(0, 10);
    if (fechaDesde && fechaCorta < fechaDesde) return false;
    if (fechaHasta && fechaCorta > fechaHasta) return false;
    return true;
  });

  const conMonto: MovimientoConUSD[] = filtrados.map((m) => ({ ...m, usd: montoUSD(m) }));
  const sinTipoCambio = conMonto.filter((m) => m.usd === null).length;
  const totalGeneral = conMonto.reduce((acc, m) => acc + (m.usd ?? 0), 0);

  const gruposPorId = new Map<string, GrupoRubro>();

  // Sembramos el catálogo completo de rubros/subrubros para que se vea el
  // listado completo, incluso los que todavía no tienen gastos cargados.
  for (const rubro of rubros) {
    gruposPorId.set(rubro.id, {
      id: rubro.id,
      nombre: rubro.nombre,
      total: 0,
      subrubros: new Map(
        rubro.subrubros.map((s) => [s.id, { id: s.id, nombre: s.nombre, total: 0, movimientos: [] }])
      ),
    });
  }

  for (const m of conMonto) {
    const rubroId = m.rubroId ?? SIN_RUBRO;
    let grupo = gruposPorId.get(rubroId);
    if (!grupo) {
      grupo = { id: rubroId, nombre: m.rubroNombre ?? "Sin rubro", total: 0, subrubros: new Map() };
      gruposPorId.set(rubroId, grupo);
    }
    grupo.total += m.usd ?? 0;

    const subrubroId = m.subrubroId ?? SIN_SUBRUBRO;
    let sub = grupo.subrubros.get(subrubroId);
    if (!sub) {
      sub = { id: subrubroId, nombre: m.subrubroNombre ?? "Sin subrubro", total: 0, movimientos: [] };
      grupo.subrubros.set(subrubroId, sub);
    }
    sub.total += m.usd ?? 0;
    sub.movimientos.push(m);
  }

  const grupos = Array.from(gruposPorId.values()).sort((a, b) => b.total - a.total);

  if (gastos.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Todavía no hay gastos cargados para este proyecto.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-2">
          <Label>Fecha</Label>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-auto justify-start gap-1.5 font-normal"
                >
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatRangoFechas(fechaDesde, fechaHasta)}
                </Button>
              }
            />
            <PopoverContent className="w-auto">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rubrosFiltroDesde">Desde</Label>
                  <Input
                    id="rubrosFiltroDesde"
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rubrosFiltroHasta">Hasta</Label>
                  <Input
                    id="rubrosFiltroHasta"
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </div>
                {(fechaDesde || fechaHasta) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFechaDesde("");
                      setFechaHasta("");
                    }}
                  >
                    Limpiar fecha
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="ml-auto shrink-0 rounded-md bg-green-900 px-4 py-1.5 text-sm font-semibold text-white shadow-md ring-1 ring-inset ring-white/15">
          Total gastado: {formatUSD(totalGeneral)}
        </div>
      </div>

      {sinTipoCambio > 0 && (
        <p className="text-xs text-muted-foreground">
          {sinTipoCambio === 1
            ? "1 gasto en pesos no tiene tipo de cambio cargado y no se incluye en los totales."
            : `${sinTipoCambio} gastos en pesos no tienen tipo de cambio cargado y no se incluyen en los totales.`}
        </p>
      )}

      {filtrados.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ningún gasto coincide con el filtro de fecha aplicado.
        </div>
      ) : (
        <Accordion multiple className="flex flex-col gap-2">
          {grupos.map((grupo) => {
            const porcentaje = totalGeneral > 0 ? (grupo.total / totalGeneral) * 100 : 0;
            const subrubros = Array.from(grupo.subrubros.values())
              .filter((s) => s.id !== SIN_SUBRUBRO || s.movimientos.length > 0)
              .sort((a, b) => b.total - a.total);

            return (
              <div key={grupo.id} className="rounded-md border">
                <AccordionItem value={grupo.id} className="border-0">
                  <AccordionTrigger
                    className="px-3 py-3 text-sm font-semibold disabled:cursor-default disabled:opacity-60"
                    disabled={subrubros.length === 0}
                  >
                    <div className="flex w-full flex-col gap-1.5">
                      <div className="flex w-full items-center justify-between gap-3">
                        <span>{grupo.nombre}</span>
                        <div className="flex shrink-0 items-center gap-2 text-right">
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatPorcentaje(porcentaje)}
                          </span>
                          <span>{formatUSD(grupo.total)}</span>
                        </div>
                      </div>
                      <ProgresoBarra porcentaje={porcentaje} />
                    </div>
                  </AccordionTrigger>
                  {subrubros.length > 0 && (
                    <AccordionPanel className="px-3">
                      <div className="flex flex-col gap-2">
                        {subrubros.map((sub) => {
                          const porcentajeSub = totalGeneral > 0 ? (sub.total / totalGeneral) * 100 : 0;

                          return (
                            <div
                              key={sub.id}
                              className="flex w-full items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs font-medium"
                            >
                              <span>{sub.nombre}</span>
                              <div className="flex shrink-0 items-center gap-2 text-right">
                                <span className="font-normal text-muted-foreground">
                                  {formatPorcentaje(porcentajeSub)}
                                </span>
                                <span>{formatUSD(sub.total)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionPanel>
                  )}
                </AccordionItem>
              </div>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
