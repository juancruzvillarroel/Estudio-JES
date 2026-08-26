"use client";

import { useState } from "react";
import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MovimientoFondoDialog } from "@/components/flujo-fondos/movimiento-fondo-dialog";
import { RubroFiltroMultiple } from "@/components/rubros/rubro-filtro-multiple";
import { cn } from "@/lib/utils";
import { MONEDA_LABELS, type MedioPagoOpcion, type MovimientoFondoOpcion } from "@/lib/flujo-fondos";
import { compararEnElDia, type SugerenciaHonorarios } from "@/lib/honorarios";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = {
  id: string;
  nombre: string;
  /** Ver src/lib/honorarios.ts: marca el rubro donde se cobran los honorarios. */
  esHonorarios: boolean;
  subrubros: SubrubroOpcion[];
};
type ProveedorOpcion = { id: string; nombre: string; rubroIds: string[] };
type ProyectoInversorOpcion = { id: string; inversorNombre: string };

function formatMonto(monto: number) {
  return monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFechaCorta(fecha: string) {
  const date = new Date(fecha);
  return date.toLocaleDateString("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });
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

function MontoMovimiento({
  monto,
  moneda,
  tipoCambio,
  medioPagoNombre,
}: {
  monto: number;
  moneda: "ARS" | "USD";
  tipoCambio: number | null;
  medioPagoNombre: string | null;
}) {
  const equivalente =
    tipoCambio != null ? (moneda === "ARS" ? monto / tipoCambio : monto * tipoCambio) : null;

  return (
    <div className="shrink-0 self-center text-right">
      <p className={cn("text-base font-semibold", moneda === "USD" ? "text-success" : "text-foreground")}>
        {moneda === "USD" ? `USD ${formatMonto(monto)}` : `$${formatMonto(monto)}`}
      </p>
      <p className="text-xs">
        {tipoCambio ? (
          <>
            <span className="text-muted-foreground">TC ${tipoCambio}</span>
            {equivalente !== null && (
              <span className={cn("ml-1.5", moneda === "ARS" ? "text-success" : "text-foreground")}>
                {moneda === "ARS" ? `USD ${formatMonto(equivalente)}` : `$${formatMonto(equivalente)}`}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Sin tipo de cambio</span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{medioPagoNombre ?? "—"}</p>
    </div>
  );
}

export function MovimientoFondoTabla({
  proyectoId,
  tipo,
  rubros,
  proveedores,
  proyectoInversores,
  mediosPago,
  sugerenciaHonorarios,
  movimientos,
  emptyMessage,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  tipo: "GASTO" | "APORTE";
  rubros: RubroOpcion[];
  proveedores: ProveedorOpcion[];
  proyectoInversores: ProyectoInversorOpcion[];
  mediosPago: MedioPagoOpcion[];
  /** Se pasa tal cual al diálogo; ver src/lib/honorarios.ts. */
  sugerenciaHonorarios?: SugerenciaHonorarios[] | null;
  movimientos: MovimientoFondoOpcion[];
  emptyMessage: string;
  onSaved: (movimiento: MovimientoFondoOpcion) => void;
  onDeleted: (id: string) => void;
}) {
  const rubroHonorariosId = rubros.find((r) => r.esHonorarios)?.id;

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [rubroIds, setRubroIds] = useState<string[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [moneda, setMoneda] = useState("");
  const [medioPagoId, setMedioPagoId] = useState("");

  const hayFiltrosActivos = Boolean(
    fechaDesde || fechaHasta || rubroIds.length > 0 || proveedorId || moneda || medioPagoId
  );

  const limpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    setRubroIds([]);
    setProveedorId("");
    setMoneda("");
    setMedioPagoId("");
  };

  const filtrados = movimientos.filter((m) => {
    const fechaCorta = m.fecha.slice(0, 10);
    if (fechaDesde && fechaCorta < fechaDesde) return false;
    if (fechaHasta && fechaCorta > fechaHasta) return false;
    if (rubroIds.length > 0 && (!m.rubroId || !rubroIds.includes(m.rubroId))) return false;
    if (proveedorId && m.proveedorId !== proveedorId) return false;
    if (moneda && m.moneda !== moneda) return false;
    if (medioPagoId && m.medioPagoId !== medioPagoId) return false;
    return true;
  });
  // Los días van del más nuevo al más viejo, pero adentro de cada día se usa el
  // mismo orden que la calculadora de honorarios: el honorario arriba de todo y
  // el resto agrupado por rubro. Así la lista muestra tal cual dónde cae el
  // corte entre un período y el siguiente.
  const enElDia = compararEnElDia(rubroHonorariosId);
  const ordenados = [...filtrados].sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
    return enElDia(a, b);
  });

  const totalARS = filtrados
    .filter((m) => m.moneda === "ARS")
    .reduce((acc, m) => acc + m.monto, 0);
  const totalUSD = filtrados
    .filter((m) => m.moneda === "USD")
    .reduce((acc, m) => acc + m.monto, 0);

  return (
    <div>
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
                  <Label htmlFor={`filtroDesde-${tipo}`}>Desde</Label>
                  <Input
                    id={`filtroDesde-${tipo}`}
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`filtroHasta-${tipo}`}>Hasta</Label>
                  <Input
                    id={`filtroHasta-${tipo}`}
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
        {tipo === "GASTO" && (
          <RubroFiltroMultiple
            id={`filtroRubro-${tipo}`}
            rubros={rubros}
            value={rubroIds}
            onChange={setRubroIds}
          />
        )}
        {tipo === "GASTO" && (
          <div className="flex shrink-0 flex-col gap-2">
            <Label htmlFor={`filtroProveedor-${tipo}`}>Proveedor</Label>
            <Select
              value={proveedorId}
              onValueChange={(v) => setProveedorId(v ?? "")}
              items={Object.fromEntries(proveedores.map((p) => [p.id, p.nombre]))}
            >
              <SelectTrigger id={`filtroProveedor-${tipo}`} size="sm" className="h-7 w-40 py-0">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex shrink-0 flex-col gap-2">
          <Label htmlFor={`filtroMoneda-${tipo}`}>Moneda</Label>
          <Select value={moneda} onValueChange={(v) => setMoneda(v ?? "")} items={MONEDA_LABELS}>
            <SelectTrigger id={`filtroMoneda-${tipo}`} size="sm" className="h-7 w-32 py-0">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {Object.entries(MONEDA_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tipo === "GASTO" && mediosPago.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2">
            <Label htmlFor={`filtroMedioPago-${tipo}`}>Medio de pago</Label>
            <Select
              value={medioPagoId}
              onValueChange={(v) => setMedioPagoId(v ?? "")}
              items={Object.fromEntries(mediosPago.map((mp) => [mp.id, mp.nombre]))}
            >
              <SelectTrigger id={`filtroMedioPago-${tipo}`} size="sm" className="h-7 w-36 py-0">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {mediosPago.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>
                    {mp.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {hayFiltrosActivos && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="Limpiar filtros"
            onClick={limpiarFiltros}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <MovimientoFondoDialog
          proyectoId={proyectoId}
          rubros={rubros}
          proveedores={proveedores}
          proyectoInversores={proyectoInversores}
          mediosPago={mediosPago}
          sugerenciaHonorarios={sugerenciaHonorarios}
          defaultTipo={tipo}
          onSaved={onSaved}
          trigger={
            <Button type="button" size="sm" className="ml-auto shrink-0">
              <Plus className="h-3.5 w-3.5" />
              {tipo === "GASTO" ? "Nuevo gasto" : "Nuevo aporte"}
            </Button>
          }
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-9 flex-1 rounded-md bg-neutral-800" />
        <div className="flex items-center gap-2">
          <div className="bg-neutral-800 px-4 py-1.5 text-sm font-semibold text-white shadow-md ring-1 ring-inset ring-white/15">
            ${formatMonto(totalARS)}
          </div>
          <div className="bg-green-900 px-4 py-1.5 text-sm font-semibold text-white shadow-md ring-1 ring-inset ring-white/15">
            USD {formatMonto(totalUSD)}
          </div>
        </div>
      </div>

      {ordenados.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {movimientos.length === 0 ? emptyMessage : "Ningún movimiento coincide con los filtros aplicados."}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {ordenados.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-start gap-3 rounded-md border p-3",
                // Los honorarios se pintan distinto porque no son un gasto más:
                // son el corte entre un período y el siguiente, así que conviene
                // ubicarlos de un vistazo al recorrer la lista.
                m.rubroId && m.rubroId === rubroHonorariosId ? "bg-muted" : "bg-background"
              )}
            >
              <div className="w-14 shrink-0 pr-2 text-xs text-muted-foreground">{formatFechaCorta(m.fecha)}</div>
              <div className="min-w-0 flex-1">
                {m.tipo === "GASTO" ? (
                  <>
                    <div className="truncate">
                      <span className="text-sm font-semibold text-foreground">
                        {m.rubroNombre ?? "Sin rubro"}
                      </span>
                      {m.subrubroNombre && (
                        <span className="text-sm text-muted-foreground"> · {m.subrubroNombre}</span>
                      )}{" "}
                      <span className="text-sm text-muted-foreground">
                        · {m.proveedorNombre ?? "Sin proveedor"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{m.descripcion}</p>
                  </>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium">{m.descripcion}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.inversorNombre ?? "Sin inversor"}
                    </p>
                  </>
                )}
              </div>
              <MontoMovimiento
                monto={m.monto}
                moneda={m.moneda}
                tipoCambio={m.tipoCambio}
                medioPagoNombre={m.medioPagoNombre}
              />
              <MovimientoFondoDialog
                proyectoId={proyectoId}
                rubros={rubros}
                proveedores={proveedores}
                proyectoInversores={proyectoInversores}
                mediosPago={mediosPago}
                item={m}
                onSaved={onSaved}
                onDeleted={onDeleted}
                trigger={
                  <Button type="button" variant="ghost" size="icon-sm" className="self-center" aria-label="Editar movimiento">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
