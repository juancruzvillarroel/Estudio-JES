import { cn, formatMontoMoneda } from "@/lib/utils";
import type { MovimientoFondoOpcion, ProyectoInversorOpcion } from "@/lib/flujo-fondos";

const MONEDA_LABELS = { ARS: "Pesos (ARS)", USD: "Dólares (USD)" } as const;

function sumarMontos(movimientos: MovimientoFondoOpcion[]) {
  return movimientos.reduce((acc, m) => acc + m.monto, 0);
}

function SummaryCard({ label, value, negativo }: { label: string; value: string; negativo?: boolean }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", negativo && "text-error")}>{value}</p>
    </div>
  );
}

export function ResumenFlujoFondos({
  asignaciones,
  movimientos,
}: {
  asignaciones: ProyectoInversorOpcion[];
  movimientos: MovimientoFondoOpcion[];
}) {
  if (movimientos.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Todavía no hay movimientos cargados para armar el resumen.
      </div>
    );
  }

  const monedas = (Object.keys(MONEDA_LABELS) as Array<keyof typeof MONEDA_LABELS>).filter((moneda) =>
    movimientos.some((m) => m.moneda === moneda)
  );

  return (
    <div className="flex flex-col gap-6">
      {monedas.map((moneda) => {
        const gastos = movimientos.filter((m) => m.tipo === "GASTO" && m.moneda === moneda);
        const aportes = movimientos.filter((m) => m.tipo === "APORTE" && m.moneda === moneda);
        const totalGastado = sumarMontos(gastos);
        const totalAportado = sumarMontos(aportes);
        const saldo = totalAportado - totalGastado;

        return (
          <div key={moneda} className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {MONEDA_LABELS[moneda]}
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Aportado" value={formatMontoMoneda(totalAportado, moneda)} />
              <SummaryCard label="Gastado" value={formatMontoMoneda(totalGastado, moneda)} />
              <SummaryCard
                label="Saldo"
                value={formatMontoMoneda(saldo, moneda)}
                negativo={saldo < 0}
              />
            </div>

            {asignaciones.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Inversor</th>
                      <th className="px-3 py-2 text-right font-medium">%</th>
                      <th className="px-3 py-2 text-right font-medium">Aportó</th>
                      <th className="px-3 py-2 text-right font-medium">Le corresponde</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asignaciones.map((a) => {
                      const aportadoInversor = sumarMontos(
                        aportes.filter((m) => m.proyectoInversorId === a.id)
                      );
                      const leCorresponde = (totalGastado * a.porcentaje) / 100;
                      const saldoInversor = aportadoInversor - leCorresponde;

                      return (
                        <tr key={a.id} className="border-t">
                          <td className="px-3 py-2">{a.inversorNombre}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{a.porcentaje}%</td>
                          <td className="px-3 py-2 text-right">
                            {formatMontoMoneda(aportadoInversor, moneda)}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {formatMontoMoneda(leCorresponde, moneda)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-medium",
                              saldoInversor < 0 && "text-error"
                            )}
                          >
                            {formatMontoMoneda(saldoInversor, moneda)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
