"use client";

import { Panel } from "@/components/flujo-fondos/panel";
import {
  calcularHonorarios,
  type HonorarioPorMoneda,
  type RubroHonorarios,
} from "@/lib/honorarios";
import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";
import { formatFecha, formatMontoMoneda } from "@/lib/utils";

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}

/**
 * Lo que se cobra en una moneda: el monto arriba, y debajo los gastos que lo
 * forman para poder revisar la cuenta renglón por renglón.
 */
function BloqueMoneda({
  honorario,
  porcentaje,
}: {
  honorario: HonorarioPorMoneda;
  porcentaje: number;
}) {
  const { moneda, desde, base, monto, gastos } = honorario;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            A cobrar en {moneda === "ARS" ? "pesos" : "dólares"}
          </p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatMontoMoneda(monto ?? 0, moneda)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% sobre{" "}
            {formatMontoMoneda(base, moneda)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Gastos del período</p>
          <p className="text-lg font-medium tabular-nums">
            {gastos.length} {gastos.length === 1 ? "gasto" : "gastos"}
          </p>
          {/* El período de cada moneda es distinto, así que la fecha del último
              cobro va acá adentro y no en el encabezado del panel. */}
          <p className="text-[11px] text-muted-foreground">
            {desde ? `desde el ${formatFecha(desde)}` : "toda la obra"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Gastos que forman la base
        </p>
        <ul className="flex flex-col divide-y">
          {gastos.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <span className="w-16 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatFecha(g.fecha)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">
                {g.descripcion || g.rubroNombre || "Sin descripción"}
              </span>
              <span className="w-32 shrink-0 text-right text-xs font-medium tabular-nums">
                {formatMontoMoneda(g.monto, g.moneda)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between gap-2 border-t pt-2.5 text-xs">
          <span className="text-muted-foreground">Base</span>
          <span className="font-semibold tabular-nums">{formatMontoMoneda(base, moneda)}</span>
        </div>
      </div>
    </div>
  );
}

export function HonorariosPanel({
  movimientos,
  rubros,
  porcentaje,
}: {
  /**
   * Todos los movimientos de la obra, sin el filtro de fechas del resumen: el
   * período de los honorarios lo marca el último cobro, no el rango que se
   * esté mirando arriba.
   */
  movimientos: MovimientoFondoOpcion[];
  rubros: RubroHonorarios[];
  porcentaje: number | null;
}) {
  const calculo = calcularHonorarios({ movimientos, rubros, porcentaje });

  if (!calculo.configurado) {
    return (
      <Panel titulo="Honorarios del estudio">
        <Aviso>
          Marcá cuál es el rubro de honorarios desde{" "}
          <span className="font-medium">Proveedores → Rubros</span> para que se calcule solo.
        </Aviso>
      </Panel>
    );
  }

  if (calculo.porcentaje === null) {
    return (
      <Panel titulo="Honorarios del estudio">
        <Aviso>
          Cargá el porcentaje de honorarios de esta obra en la pestaña{" "}
          <span className="font-medium">Datos del proyecto</span> para ver cuánto corresponde
          cobrar.
        </Aviso>
      </Panel>
    );
  }

  const porcentajeCargado = calculo.porcentaje;

  return (
    <Panel
      titulo="Honorarios del estudio"
      descripcion="Cada moneda se liquida por separado, desde su último cobro"
    >
      {calculo.porMoneda.length === 0 ? (
        <Aviso>No hay gastos nuevos desde el último honorario.</Aviso>
      ) : (
        // Cada moneda es un honorario aparte, no dos partes de uno solo: los
        // gastos en pesos se cobran en pesos y los de dólares en dólares, sin
        // convertir. Por eso van separados con una línea y no sumados.
        <div className="flex flex-col gap-5 divide-y p-4 [&>*:not(:first-child)]:pt-5">
          {calculo.porMoneda.map((honorario) => (
            <BloqueMoneda
              key={honorario.moneda}
              honorario={honorario}
              porcentaje={porcentajeCargado}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
