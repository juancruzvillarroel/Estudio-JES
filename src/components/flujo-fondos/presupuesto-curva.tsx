"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMes, formatMesLargo, formatUSD, type GrillaPresupuesto } from "@/lib/presupuesto";

/**
 * La curva de plata de la obra: cuánto hace falta cada mes y cuánto llevás
 * puesto hasta ese mes.
 *
 * Está dibujado con SVG a mano y no con una librería de gráficos. Es una línea,
 * un área y unos ejes; traer 500kb de dependencia para eso, y cargar con su
 * forma de pensar el responsive y el tema oscuro, cuesta más de lo que ahorra.
 */

/** Alto del área de dibujo, sin los ejes. */
const ALTO = 190;
/** Lugar para los números del eje vertical. */
const MARGEN_IZQ = 8;
const MARGEN_DER = 8;
const MARGEN_SUP = 12;
/** Lugar para los nombres de los meses. */
const MARGEN_INF = 22;

type Vista = "mes" | "acumulado";

export function PresupuestoCurva({
  grilla,
  /** Si mostrar además la línea de lo realmente gastado. */
  verEjecutado,
}: {
  grilla: GrillaPresupuesto;
  verEjecutado: boolean;
}) {
  const [vista, setVista] = useState<Vista>("mes");
  const [activo, setActivo] = useState<number | null>(null);
  const idGradiente = useId();

  const meses = grilla.meses;
  if (meses.length === 0) return null;

  const proyectado = meses.map((m) =>
    vista === "mes" ? (grilla.porMes.get(m) ?? 0) : (grilla.acumuladoPorMes.get(m) ?? 0)
  );

  // El ejecutado acumulado se arma acá porque la grilla solo guarda el mensual.
  // Con `reduce` y no con un contador mutable afuera del map: el React Compiler
  // rechaza reasignar una variable durante el render, y con razón —el resultado
  // dependería de cuántas veces corrió el map—.
  const ejecutado = meses.reduce<number[]>((acc, m, i) => {
    const delMes = grilla.ejecutadoPorMes.get(m) ?? 0;
    acc.push(vista === "mes" ? delMes : (acc[i - 1] ?? 0) + delMes);
    return acc;
  }, []);

  const series = verEjecutado ? [...proyectado, ...ejecutado] : proyectado;
  // El techo nunca es el valor máximo exacto: la línea quedaría pegada al borde
  // de arriba. Un 10% de aire hace que se lea como un gráfico y no como un
  // recorte.
  const techo = Math.max(...series, 1) * 1.1;

  // Coordenadas en un viewBox propio; el SVG escala solo al ancho disponible.
  const ancho = Math.max(320, meses.length * 60);
  const x = (i: number) =>
    MARGEN_IZQ +
    (meses.length === 1
      ? (ancho - MARGEN_IZQ - MARGEN_DER) / 2
      : (i * (ancho - MARGEN_IZQ - MARGEN_DER)) / (meses.length - 1));
  const y = (valor: number) => MARGEN_SUP + (1 - valor / techo) * (ALTO - MARGEN_SUP);

  const linea = (valores: number[]) =>
    valores.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area = (valores: number[]) =>
    `${linea(valores)} L ${x(valores.length - 1)} ${ALTO} L ${x(0)} ${ALTO} Z`;

  // Cuatro marcas en el eje vertical, incluida la de cero.
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * techo);

  const totalVista =
    vista === "mes"
      ? Math.max(...proyectado, 0)
      : (proyectado[proyectado.length - 1] ?? 0);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {vista === "mes" ? "Mes más pesado" : "Total al final de la obra"}
          </p>
          <p className="text-base font-semibold tabular-nums">{formatUSD(totalVista)}</p>
        </div>

        {/* Las dos preguntas que contesta el mismo dato: cuánto necesito este
            mes, y cuánto llevo puesto. Comparten el eje, así que van en vistas
            separadas y no como dos líneas de escalas incomparables. */}
        <div
          role="group"
          aria-label="Qué curva mirar"
          className="ml-auto flex items-center rounded-md border p-0.5"
        >
          {(
            [
              ["mes", "Por mes", "Cuánta plata hace falta cada mes"],
              ["acumulado", "Acumulado", "Cuánta plata llevás puesta hasta ese mes"],
            ] as const
          ).map(([valor, etiqueta, ayuda]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setVista(valor)}
              aria-pressed={vista === valor}
              title={ayuda}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                vista === valor
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ancho} ${ALTO + MARGEN_INF}`}
          className="h-56 w-full min-w-[320px]"
          role="img"
          aria-label={
            vista === "mes"
              ? "Egreso proyectado por mes a lo largo de la obra"
              : "Egreso proyectado acumulado a lo largo de la obra"
          }
          onPointerLeave={() => setActivo(null)}
        >
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Líneas guía horizontales con su valor. Sin ellas hay que adivinar
              a qué altura está cada punto. */}
          {marcas.map((valor, i) => (
            <g key={i} className="text-muted-foreground">
              <line
                x1={MARGEN_IZQ}
                y1={y(valor)}
                x2={ancho - MARGEN_DER}
                y2={y(valor)}
                stroke="currentColor"
                strokeOpacity={i === 0 ? 0.35 : 0.12}
                strokeWidth={1}
              />
              <text
                x={MARGEN_IZQ + 2}
                y={y(valor) - 3}
                className="fill-current text-[9px] tabular-nums"
                opacity={0.65}
              >
                {Math.round(valor).toLocaleString("es-AR")}
              </text>
            </g>
          ))}

          {/* Proyectado */}
          <path d={area(proyectado)} fill={`url(#${idGradiente})`} className="text-foreground" />
          <path
            d={linea(proyectado)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="text-foreground"
          />

          {verEjecutado && (
            <path
              d={linea(ejecutado)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-warning"
            />
          )}

          {/* Puntos y zonas sensibles. El rectángulo invisible es más ancho que
              el punto para que no haya que acertarle a 4px con el mouse. */}
          {meses.map((mes, i) => (
            <g key={mes}>
              <circle
                cx={x(i)}
                cy={y(proyectado[i]!)}
                r={activo === i ? 4 : 2.5}
                className="fill-background stroke-foreground"
                strokeWidth={2}
              />
              {verEjecutado && (ejecutado[i] ?? 0) > 0 && (
                <circle cx={x(i)} cy={y(ejecutado[i]!)} r={2.5} className="fill-warning" />
              )}
              <rect
                x={x(i) - (ancho - MARGEN_IZQ - MARGEN_DER) / Math.max(1, meses.length) / 2}
                y={0}
                width={(ancho - MARGEN_IZQ - MARGEN_DER) / Math.max(1, meses.length)}
                height={ALTO}
                fill="transparent"
                onPointerEnter={() => setActivo(i)}
              >
                <title>
                  {`${formatMesLargo(mes)}: ${formatUSD(proyectado[i]!)}${
                    verEjecutado ? ` proyectado · ${formatUSD(ejecutado[i] ?? 0)} ejecutado` : ""
                  }`}
                </title>
              </rect>
            </g>
          ))}

          {/* Guía vertical del mes que se está mirando. */}
          {activo !== null && (
            <line
              x1={x(activo)}
              y1={MARGEN_SUP}
              x2={x(activo)}
              y2={ALTO}
              className="text-foreground"
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeDasharray="3 3"
            />
          )}

          {/* Eje de meses. Con obras largas se saltean etiquetas para que no se
              pisen unas con otras. */}
          {meses.map((mes, i) => {
            const cada = meses.length > 18 ? 3 : meses.length > 10 ? 2 : 1;
            if (i % cada !== 0 && i !== meses.length - 1) return null;
            return (
              <text
                key={mes}
                x={x(i)}
                y={ALTO + 14}
                textAnchor="middle"
                className={cn(
                  "fill-current text-[9px]",
                  activo === i ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {formatMes(mes)}
              </text>
            );
          })}
        </svg>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {activo !== null ? (
          <>
            <span className="font-medium text-foreground">{formatMesLargo(meses[activo]!)}</span>
            {" · "}
            {formatUSD(proyectado[activo]!)}
            {vista === "mes" ? " ese mes" : " acumulado"}
            {verEjecutado && ` · ${formatUSD(ejecutado[activo] ?? 0)} ejecutado`}
          </>
        ) : vista === "mes" ? (
          "Cuánta plata hay que tener disponible cada mes. Pasá el mouse por el gráfico para ver el detalle."
        ) : (
          "Cuánta plata lleva puesta la obra hasta cada mes."
        )}
      </p>
    </div>
  );
}
