"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abrirInformeResumen, type BloqueInforme } from "@/components/flujo-fondos/informe-resumen";
import { Panel } from "@/components/flujo-fondos/panel";
import { HonorariosPanel } from "@/components/flujo-fondos/honorarios-panel";
import { cn, formatMontoMoneda, formatFecha } from "@/lib/utils";
import type {
  MovimientoFondoOpcion,
  ProyectoInversorOpcion,
  UnidadProyectoOpcion,
} from "@/lib/flujo-fondos";
import type { VentaOpcion } from "@/lib/ventas";

type RubroOpcion = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
  /** Ver src/lib/honorarios.ts: qué rubros entran en la base y cuál es el de honorarios. */
  pagaHonorarios: boolean;
  esHonorarios: boolean;
};

/**
 * Código del rubro cuyo gasto se considera "incidencia del terreno" en el
 * costo por m². El resto de los rubros forman el costo de construcción.
 */
const CODIGO_RUBRO_TERRENO = "00";

function sinAcentos(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

/**
 * El rubro de terreno se identifica por su código (00). Si el catálogo no
 * tiene códigos cargados, caemos al nombre para no romper el cálculo.
 */
function esRubroTerreno(rubro: RubroOpcion) {
  if (rubro.codigoPrefijo) return rubro.codigoPrefijo === CODIGO_RUBRO_TERRENO;
  return sinAcentos(rubro.nombre).startsWith("ADQUISICION");
}

/**
 * Convierte un movimiento a dólares. Si está en pesos y no tiene tipo de
 * cambio cargado, no se puede convertir (null) y queda fuera de los totales
 * consolidados.
 */
function montoUSD(m: MovimientoFondoOpcion): number | null {
  if (m.moneda === "USD") return m.monto;
  if (m.tipoCambio) return m.monto / m.tipoCambio;
  return null;
}

function sumarMontos(movimientos: MovimientoFondoOpcion[]) {
  return movimientos.reduce((acc, m) => acc + m.monto, 0);
}

function sumarUSD(movimientos: MovimientoFondoOpcion[]) {
  return movimientos.reduce((acc, m) => acc + (montoUSD(m) ?? 0), 0);
}

function formatUSDm2(valor: number) {
  return `USD ${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}/m²`;
}

function formatM2(valor: number) {
  return `${valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })} m²`;
}

function formatPorcentaje(valor: number) {
  return `${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Las fechas llegan como ISO completo ("2026-08-07T00:00:00.000Z") y el filtro
 * trabaja con el día calendario ("2026-08-07"), que es lo que devuelve un
 * <input type="date">. Comparar los strings recortados alcanza porque el
 * formato ISO ordena igual que la fecha.
 */
function diaCalendario(fechaISO: string) {
  return fechaISO.slice(0, 10);
}

function dentroDelRango(fechaISO: string, desde: string, hasta: string) {
  const dia = diaCalendario(fechaISO);
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

function Barra({ porcentaje, className }: { porcentaje: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500", className)}
        style={{ width: `${Math.min(Math.max(porcentaje, 0), 100)}%` }}
      />
    </div>
  );
}

type FilaInversor = {
  id: string;
  nombre: string;
  porcentaje: number;
  aportado: number;
  corresponde: number;
  saldo: number;
};

type BloqueResumen = {
  clave: string;
  titulo: string;
  etiqueta?: string;
  aportado: number;
  gastado: number;
  filas: FilaInversor[];
  format: (valor: number) => string;
};

function BloqueMoneda({
  titulo,
  etiqueta,
  aportado,
  gastado,
  filas,
  format,
  destacado,
}: {
  titulo: string;
  etiqueta?: string;
  aportado: number;
  gastado: number;
  filas: FilaInversor[];
  format: (valor: number) => string;
  destacado?: boolean;
}) {
  const saldo = aportado - gastado;
  const ejecutado = aportado > 0 ? (gastado / aportado) * 100 : gastado > 0 ? 100 : 0;

  return (
    <div className={cn("flex flex-col gap-4 p-4", destacado && "bg-muted/20")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {titulo}
        </span>
        {etiqueta && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            {etiqueta}
          </span>
        )}
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground">Saldo</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            saldo < 0 ? "text-error" : "text-success"
          )}
        >
          {format(saldo)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">Gastado</span>
          <span className="font-medium tabular-nums">{format(gastado)}</span>
        </div>
        <Barra porcentaje={ejecutado} />
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">Aportado</span>
          <span className="font-medium tabular-nums">{format(aportado)}</span>
        </div>
      </div>

      {filas.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Por inversor
          </p>
          <ul className="flex flex-col divide-y">
            {filas.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{f.nombre}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {f.porcentaje}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Aportó</span>
                  <span className="shrink-0 text-base font-semibold tabular-nums">
                    {format(f.aportado)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground">
                    Le corresponde {format(f.corresponde)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      f.saldo < 0 ? "text-error" : "text-success"
                    )}
                  >
                    {format(f.saldo)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LeyendaCosto({
  color,
  label,
  porM2,
  total,
  porcentaje,
}: {
  color: string;
  label: string;
  porM2: string;
  total: string;
  porcentaje: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", color)} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{porM2}</p>
        <p className="text-[11px] text-muted-foreground">
          {total} · {porcentaje} del costo total
        </p>
      </div>
    </div>
  );
}

function LeyendaFacturacion({
  color,
  label,
  monto,
  porcentaje,
  detalle,
}: {
  color: string;
  label: string;
  monto: string;
  porcentaje: string;
  detalle: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", color)} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{monto}</p>
        <p className="text-[11px] text-muted-foreground">
          {porcentaje} del gasto · {detalle}
        </p>
      </div>
    </div>
  );
}

/** Traduce un bloque de la pantalla al formato ya formateado que usa el informe. */
function aBloqueInforme(b: BloqueResumen): BloqueInforme {
  const saldo = b.aportado - b.gastado;
  return {
    titulo: b.titulo,
    aportadoTexto: b.format(b.aportado),
    gastadoTexto: b.format(b.gastado),
    saldoTexto: b.format(saldo),
    saldoNegativo: saldo < 0,
    ejecutado: b.aportado > 0 ? (b.gastado / b.aportado) * 100 : b.gastado > 0 ? 100 : 0,
    filas: b.filas.map((f) => ({
      nombre: f.nombre,
      porcentaje: f.porcentaje,
      aportadoTexto: b.format(f.aportado),
      correspondeTexto: b.format(f.corresponde),
      saldoTexto: b.format(f.saldo),
      saldoNegativo: f.saldo < 0,
    })),
  };
}

export function ResumenFlujoFondos({
  proyectoNombre,
  asignaciones,
  movimientos,
  rubros,
  ventas,
  unidades,
  m2Vendibles,
  porcentajeHonorarios,
}: {
  proyectoNombre: string;
  asignaciones: ProyectoInversorOpcion[];
  movimientos: MovimientoFondoOpcion[];
  rubros: RubroOpcion[];
  ventas: VentaOpcion[];
  unidades: UnidadProyectoOpcion[];
  m2Vendibles: number | null;
  porcentajeHonorarios: number | null;
}) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const hayFiltro = desde !== "" || hasta !== "";

  // El rango aplica a todo el resumen: movimientos y ventas.
  const movimientosEnRango = movimientos.filter((m) => dentroDelRango(m.fecha, desde, hasta));
  const ventasEnRango = ventas.filter((v) => dentroDelRango(v.fecha, desde, hasta));

  const gastos = movimientosEnRango.filter((m) => m.tipo === "GASTO");
  const aportes = movimientosEnRango.filter((m) => m.tipo === "APORTE");

  // --- Bloques por moneda (los dos de siempre) + consolidado en dólares ---
  const monedasPresentes = (["ARS", "USD"] as const).filter((moneda) =>
    movimientosEnRango.some((m) => m.moneda === moneda)
  );

  const bloquesPorMoneda: BloqueResumen[] = monedasPresentes.map((moneda) => {
    const gastosMoneda = gastos.filter((m) => m.moneda === moneda);
    const aportesMoneda = aportes.filter((m) => m.moneda === moneda);
    const totalGastado = sumarMontos(gastosMoneda);
    const totalAportado = sumarMontos(aportesMoneda);

    return {
      clave: moneda,
      titulo: moneda === "ARS" ? "Pesos (ARS)" : "Dólares (USD)",
      aportado: totalAportado,
      gastado: totalGastado,
      format: (valor: number) => formatMontoMoneda(valor, moneda),
      filas: asignaciones.map((a) => {
        const aportadoInversor = sumarMontos(
          aportesMoneda.filter((m) => m.proyectoInversorId === a.id)
        );
        const corresponde = (totalGastado * a.porcentaje) / 100;
        return {
          id: a.id,
          nombre: a.inversorNombre,
          porcentaje: a.porcentaje,
          aportado: aportadoInversor,
          corresponde,
          saldo: aportadoInversor - corresponde,
        };
      }),
    };
  });

  const sinTipoCambio = movimientosEnRango.filter((m) => montoUSD(m) === null).length;
  const gastadoUSD = sumarUSD(gastos);
  const aportadoUSD = sumarUSD(aportes);

  const filasConsolidado: FilaInversor[] = asignaciones.map((a) => {
    const aportadoInversor = sumarUSD(aportes.filter((m) => m.proyectoInversorId === a.id));
    const corresponde = (gastadoUSD * a.porcentaje) / 100;
    return {
      id: a.id,
      nombre: a.inversorNombre,
      porcentaje: a.porcentaje,
      aportado: aportadoInversor,
      corresponde,
      saldo: aportadoInversor - corresponde,
    };
  });

  const bloqueConsolidado: BloqueResumen = {
    clave: "consolidado",
    titulo: "Todo en dólares",
    etiqueta: "Consolidado",
    aportado: aportadoUSD,
    gastado: gastadoUSD,
    filas: filasConsolidado,
    format: (valor: number) => formatMontoMoneda(valor, "USD"),
  };

  // --- Facturación ---
  // Un gasto cuenta como facturado cuando su medio de pago está marcado como
  // "incluye IVA". Los montos se comparan en dólares, así que los gastos en
  // pesos sin tipo de cambio quedan fuera de este corte igual que del resto
  // del consolidado.
  const gastosFacturados = gastos.filter((m) => m.facturado);
  const facturadoUSD = sumarUSD(gastosFacturados);
  const noFacturadoUSD = gastadoUSD - facturadoUSD;
  const pesoFacturado = gastadoUSD > 0 ? (facturadoUSD / gastadoUSD) * 100 : 0;
  const pesoNoFacturado = gastadoUSD > 0 ? (noFacturadoUSD / gastadoUSD) * 100 : 0;

  const gastoPorMedioPago = (() => {
    const mapa = new Map<string, { nombre: string; facturado: boolean; total: number }>();
    for (const g of gastos) {
      const clave = g.medioPagoId ?? "__sin_medio__";
      const acumulado = mapa.get(clave) ?? {
        nombre: g.medioPagoNombre ?? "Sin medio de pago",
        facturado: g.facturado,
        total: 0,
      };
      acumulado.total += montoUSD(g) ?? 0;
      mapa.set(clave, acumulado);
    }
    return Array.from(mapa.values())
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total);
  })();

  // --- Costo por m² ---
  const idsRubroTerreno = new Set(rubros.filter(esRubroTerreno).map((r) => r.id));
  const gastadoTerrenoUSD = sumarUSD(
    gastos.filter((m) => m.rubroId && idsRubroTerreno.has(m.rubroId))
  );
  const gastadoConstruccionUSD = gastadoUSD - gastadoTerrenoUSD;
  const pesoTerreno = gastadoUSD > 0 ? (gastadoTerrenoUSD / gastadoUSD) * 100 : 0;
  const pesoConstruccion = gastadoUSD > 0 ? (gastadoConstruccionUSD / gastadoUSD) * 100 : 0;

  // --- Gasto por rubro (solo para el informe) ---
  // Se listan únicamente los rubros con gasto en el período; los que quedaron
  // en cero no aparecen. Los gastos sin rubro se agrupan aparte para que la
  // suma de la tabla cierre contra el total del período.
  const gastoPorRubro = rubros
    .map((r) => ({
      etiqueta: r.codigoPrefijo ? `${r.codigoPrefijo} · ${r.nombre}` : r.nombre,
      total: sumarUSD(gastos.filter((m) => m.rubroId === r.id)),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const gastoSinRubro = sumarUSD(gastos.filter((m) => !m.rubroId));
  if (gastoSinRubro > 0) {
    gastoPorRubro.push({ etiqueta: "Sin rubro asignado", total: gastoSinRubro });
  }

  // --- Ventas ---
  const ventasUSD = ventasEnRango.filter((v) => v.moneda === "USD");
  const ventasARS = ventasEnRango.filter((v) => v.moneda === "ARS");
  const totalVendidoUSD = ventasUSD.reduce((acc, v) => acc + v.precioTotal, 0);
  const m2PorUnidad = new Map(unidades.map((u) => [u.id, u.m2 ?? 0]));
  const m2Vendidos = ventasUSD.reduce((acc, v) => acc + (m2PorUnidad.get(v.unidadId) ?? 0), 0);
  const resultadoBruto = totalVendidoUSD - gastadoUSD;

  const leyendaRango = hayFiltro
    ? `Período: ${desde ? formatFecha(desde) : "inicio"} a ${hasta ? formatFecha(hasta) : "hoy"}`
    : "Período: todo el proyecto";

  const handleDescargarInforme = () => {
    abrirInformeResumen({
      proyectoNombre,
      leyendaRango,
      generadoEl: formatFecha(new Date()),
      consolidado: aBloqueInforme(bloqueConsolidado),
      porMoneda: bloquesPorMoneda.map(aBloqueInforme),
      sinTipoCambio,
      rubros: gastoPorRubro.map((r) => ({
        etiqueta: r.etiqueta,
        montoTexto: formatMontoMoneda(r.total, "USD"),
        porcentaje: gastadoUSD > 0 ? (r.total / gastadoUSD) * 100 : 0,
      })),
      facturacion:
        gastadoUSD > 0
          ? {
              facturadoTexto: formatMontoMoneda(facturadoUSD, "USD"),
              noFacturadoTexto: formatMontoMoneda(noFacturadoUSD, "USD"),
              facturadoPorcentaje: pesoFacturado,
              noFacturadoPorcentaje: pesoNoFacturado,
              cantidadFacturados: gastosFacturados.length,
              cantidadNoFacturados: gastos.length - gastosFacturados.length,
              medios: gastoPorMedioPago.map((m) => ({
                nombre: m.nombre,
                montoTexto: formatMontoMoneda(m.total, "USD"),
                porcentaje: (m.total / gastadoUSD) * 100,
                facturado: m.facturado,
              })),
            }
          : null,
      gastoTotalTexto: formatMontoMoneda(gastadoUSD, "USD"),
      costoM2:
        m2Vendibles != null && m2Vendibles > 0
          ? {
              superficieTexto: formatM2(m2Vendibles),
              totalTexto: formatUSDm2(gastadoUSD / m2Vendibles),
              terrenoPorM2Texto: formatUSDm2(gastadoTerrenoUSD / m2Vendibles),
              terrenoTotalTexto: formatMontoMoneda(gastadoTerrenoUSD, "USD"),
              terrenoPorcentaje: pesoTerreno,
              construccionPorM2Texto: formatUSDm2(gastadoConstruccionUSD / m2Vendibles),
              construccionTotalTexto: formatMontoMoneda(gastadoConstruccionUSD, "USD"),
              construccionPorcentaje: pesoConstruccion,
            }
          : null,
      ventas:
        ventasEnRango.length > 0
          ? {
              vendidoTexto: formatMontoMoneda(totalVendidoUSD, "USD"),
              cantidadUSD: ventasUSD.length,
              cantidadARS: ventasARS.length,
              m2VendidosTexto:
                m2Vendibles != null && m2Vendibles > 0
                  ? `${formatM2(m2Vendidos)} de ${formatM2(m2Vendibles)}`
                  : formatM2(m2Vendidos),
              avanceM2:
                m2Vendibles != null && m2Vendibles > 0
                  ? (m2Vendidos / m2Vendibles) * 100
                  : null,
              promedioTexto: m2Vendidos > 0 ? formatUSDm2(totalVendidoUSD / m2Vendidos) : "-",
              resultadoTexto: formatMontoMoneda(resultadoBruto, "USD"),
              resultadoNegativo: resultadoBruto < 0,
            }
          : null,
    });
  };

  const filtro = (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resumen-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="resumen-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resumen-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="resumen-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="w-40"
          />
        </div>
        {hayFiltro && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpiar el filtro de fechas"
            title="Limpiar el filtro de fechas"
            onClick={() => {
              setDesde("");
              setHasta("");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={handleDescargarInforme}>
        <Download className="h-4 w-4" />
        Descargar informe
      </Button>
    </div>
  );

  // El único bloque que no obedece al filtro de fechas: su período lo marca el
  // último honorario cobrado, no el rango que se esté mirando. Por eso recibe
  // `movimientos` y no `movimientosEnRango`, y aclara sus propias fechas en el
  // encabezado.
  const panelHonorarios = (
    <HonorariosPanel
      movimientos={movimientos}
      rubros={rubros}
      porcentaje={porcentajeHonorarios}
    />
  );

  if (movimientos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Todavía no hay movimientos cargados para armar el resumen.
      </div>
    );
  }

  if (movimientosEnRango.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {filtro}
        {panelHonorarios}
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay movimientos en el período elegido.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {filtro}

      <Panel
        titulo="Aportes, gastos y saldo"
        descripcion={
          sinTipoCambio > 0
            ? sinTipoCambio === 1
              ? "1 movimiento en pesos sin tipo de cambio queda fuera del consolidado"
              : `${sinTipoCambio} movimientos en pesos sin tipo de cambio quedan fuera del consolidado`
            : undefined
        }
      >
        <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {bloquesPorMoneda.map((b) => (
            <BloqueMoneda
              key={b.clave}
              titulo={b.titulo}
              aportado={b.aportado}
              gastado={b.gastado}
              filas={b.filas}
              format={b.format}
            />
          ))}
          <BloqueMoneda
            titulo={bloqueConsolidado.titulo}
            etiqueta={bloqueConsolidado.etiqueta}
            aportado={bloqueConsolidado.aportado}
            gastado={bloqueConsolidado.gastado}
            filas={bloqueConsolidado.filas}
            format={bloqueConsolidado.format}
            destacado
          />
        </div>
      </Panel>

      {/* Segunda fila: los dos bloques que miran el gasto desde otro ángulo.
          Van a la par en pantallas anchas y se apilan en las angostas. */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {panelHonorarios}

        <Panel
          titulo="Facturación de gastos"
          descripcion="Un gasto cuenta como facturado según el medio de pago con el que se abonó"
        >
          {gastadoUSD <= 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay gastos en dólares (o convertibles a dólares) en el período elegido.
            </p>
          ) : (
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Facturado</p>
                  <p className="text-3xl font-semibold tabular-nums text-success">
                    {formatPorcentaje(pesoFacturado)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Gasto total del período</p>
                  <p className="text-lg font-medium tabular-nums">
                    {formatMontoMoneda(gastadoUSD, "USD")}
                  </p>
                </div>
              </div>

              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-success" style={{ width: `${pesoFacturado}%` }} />
                <div className="bg-neutral-400" style={{ width: `${pesoNoFacturado}%` }} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <LeyendaFacturacion
                  color="bg-success"
                  label="Con factura (IVA)"
                  monto={formatMontoMoneda(facturadoUSD, "USD")}
                  porcentaje={formatPorcentaje(pesoFacturado)}
                  detalle={`${gastosFacturados.length} ${gastosFacturados.length === 1 ? "gasto" : "gastos"}`}
                />
                <LeyendaFacturacion
                  color="bg-neutral-400"
                  label="Sin factura"
                  monto={formatMontoMoneda(noFacturadoUSD, "USD")}
                  porcentaje={formatPorcentaje(pesoNoFacturado)}
                  detalle={`${gastos.length - gastosFacturados.length} ${
                    gastos.length - gastosFacturados.length === 1 ? "gasto" : "gastos"
                  }`}
                />
              </div>

              {gastoPorMedioPago.length > 0 && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Por medio de pago
                  </p>
                  <ul className="flex flex-col divide-y">
                    {gastoPorMedioPago.map((m) => (
                      <li
                        key={m.nombre}
                        className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            m.facturado ? "bg-success" : "bg-neutral-400"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs">{m.nombre}</span>
                        <span className="shrink-0 text-xs font-medium tabular-nums">
                          {formatMontoMoneda(m.total, "USD")}
                        </span>
                        <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatPorcentaje((m.total / gastadoUSD) * 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        titulo="Costo por m² vendible"
        descripcion="La incidencia toma el rubro de adquisición de terreno; la construcción, todo el resto"
      >
        {m2Vendibles == null || m2Vendibles <= 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Cargá los m² vendibles totales en la pestaña{" "}
            <span className="font-medium">Datos del proyecto</span> para ver la incidencia del
            terreno y el costo de construcción por m².
          </p>
        ) : (
          <div className="flex flex-col gap-5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Costo total</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatUSDm2(gastadoUSD / m2Vendibles)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Superficie vendible</p>
                <p className="text-lg font-medium tabular-nums">{formatM2(m2Vendibles)}</p>
              </div>
            </div>

            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-warning" style={{ width: `${pesoTerreno}%` }} />
              <div className="bg-primary" style={{ width: `${pesoConstruccion}%` }} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <LeyendaCosto
                color="bg-warning"
                label="Incidencia del terreno"
                porM2={formatUSDm2(gastadoTerrenoUSD / m2Vendibles)}
                total={formatMontoMoneda(gastadoTerrenoUSD, "USD")}
                porcentaje={formatPorcentaje(pesoTerreno)}
              />
              <LeyendaCosto
                color="bg-primary"
                label="Costo de construcción"
                porM2={formatUSDm2(gastadoConstruccionUSD / m2Vendibles)}
                total={formatMontoMoneda(gastadoConstruccionUSD, "USD")}
                porcentaje={formatPorcentaje(pesoConstruccion)}
              />
            </div>
          </div>
        )}
      </Panel>

      {ventasEnRango.length > 0 && (
        <Panel
          titulo="Ventas y resultado"
          descripcion={
            ventasARS.length > 0
              ? ventasARS.length === 1
                ? "1 venta en pesos no se incluye en estos totales"
                : `${ventasARS.length} ventas en pesos no se incluyen en estos totales`
              : undefined
          }
        >
          <div className="flex flex-col gap-5 p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Vendido</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatMontoMoneda(totalVendidoUSD, "USD")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {ventasUSD.length} {ventasUSD.length === 1 ? "venta" : "ventas"} en dólares
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Resultado bruto</p>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    resultadoBruto < 0 ? "text-error" : "text-success"
                  )}
                >
                  {formatMontoMoneda(resultadoBruto, "USD")}
                </p>
                <p className="text-[11px] text-muted-foreground">Vendido − gastado</p>
              </div>
            </div>

            {m2Vendibles != null && m2Vendibles > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">m² vendidos</span>
                  <span className="font-medium tabular-nums">
                    {formatM2(m2Vendidos)} de {formatM2(m2Vendibles)} ·{" "}
                    {formatPorcentaje((m2Vendidos / m2Vendibles) * 100)}
                  </span>
                </div>
                <Barra porcentaje={(m2Vendidos / m2Vendibles) * 100} className="bg-success" />
              </div>
            )}

            <div className="flex items-baseline justify-between gap-2 border-t pt-3 text-xs">
              <span className="text-muted-foreground">Precio promedio de venta</span>
              <span className="font-semibold tabular-nums">
                {m2Vendidos > 0 ? formatUSDm2(totalVendidoUSD / m2Vendidos) : "-"}
              </span>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
