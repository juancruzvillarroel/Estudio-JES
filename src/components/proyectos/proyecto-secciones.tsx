"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  FileText,
  Landmark,
  ListChecks,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Datos ya formateados para la tarjeta de una sección en la portada. */
export type ResumenSeccion = {
  /** Número grande, ej. "12" o "USD 34.500". */
  valor: string;
  /** Renglón chico debajo del número, ej. "trámites presentados". */
  detalle: string;
  /** Barra de avance. Null en las secciones que no tienen un "total". */
  progreso: { hechos: number; total: number } | null;
  /** Datos sueltos que se muestran como pastillas al pie de la tarjeta. */
  chips: { etiqueta: string; valor: string }[];
  /**
   * Colorea el número y la barra. "neutral" para lo informativo, "ok" para lo
   * que está al día, "alerta" (naranja) para lo que pide atención y "error"
   * (rojo) para lo que está en falta, como un saldo negativo.
   */
  tono: "neutral" | "ok" | "alerta" | "error";
};

export type ResumenProyecto = {
  movimientos: ResumenSeccion;
  tareas: ResumenSeccion;
  municipal: ResumenSeccion;
  documentacion: ResumenSeccion;
  /** Null cuando el usuario no tiene permiso de Flujo de fondos. */
  flujoFondos: ResumenSeccion | null;
};

type ClaveSeccion = "movimientos" | "tareas" | "municipal" | "documentacion" | "flujo-fondos";

const TONO_TEXTO = {
  neutral: "text-foreground",
  ok: "text-success",
  alerta: "text-warning",
  error: "text-error",
} as const;

const TONO_BARRA = {
  neutral: "bg-foreground/40",
  ok: "bg-success",
  alerta: "bg-warning",
  error: "bg-error",
} as const;

/**
 * Relieve de la tarjeta, en escala de grises: un degradado que baja desde la
 * esquina superior izquierda y se apaga en el medio.
 *
 * Va contra `--foreground` y no contra un gris fijo para que sirva en los dos
 * temas sin escribirlo dos veces: en claro el texto es oscuro y el degradado
 * ensombrece, en oscuro es claro y el degradado ilumina. En ambos casos levanta
 * la esquina de arriba, que es lo que saca la sensación de caja plana.
 *
 * El único color de la tarjeta sigue siendo el del número, que lo pone el tono:
 * así el verde o el rojo de un dato siguen siendo lo único que salta a la vista.
 */
const RELIEVE = "bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent";

/**
 * Cuántas de las 6 columnas de la grilla ocupa cada tarjeta, elegido para que
 * ninguna fila quede a medio llenar.
 *
 * Las secciones son 5, o 4 cuando el usuario no tiene permiso de Flujo de
 * fondos. Con la grilla de 3 columnas que había antes, 5 tarjetas dejaban la
 * segunda fila con dos y un hueco al costado. Ahora:
 *
 *   5 → 3 arriba (2 columnas cada una) y 2 abajo más anchas (3 columnas)
 *   4 → dos filas de 2, todas iguales
 *
 * En pantallas medianas la grilla es de 2 columnas y el problema aparece solo
 * cuando el total es impar: la última tarjeta se queda sola. Ahí se estira a
 * lo ancho en vez de ocupar media pantalla.
 */
function spanTarjeta(indice: number, total: number) {
  const enDosColumnas = total % 2 === 1 && indice === total - 1 ? "sm:col-span-2" : "";
  const enSeisColumnas =
    total === 5 ? (indice < 3 ? "lg:col-span-2" : "lg:col-span-3") : "lg:col-span-3";
  return cn(enDosColumnas, enSeisColumnas);
}

function Tarjeta({
  titulo,
  descripcion,
  icono: Icono,
  resumen,
  onClick,
  className,
}: {
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  resumen: ResumenSeccion;
  onClick: () => void;
  /** Cuántas columnas ocupa en la grilla; lo decide `spanTarjeta`. */
  className?: string;
}) {
  const porcentaje =
    resumen.progreso && resumen.progreso.total > 0
      ? (resumen.progreso.hechos / resumen.progreso.total) * 100
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        RELIEVE,
        className
      )}
    >
      {/* El mismo ícono repetido en grande y casi borrado, asomando por la
          esquina. Le da algo de textura a la tarjeta sin agregar un dato más
          para leer. Va `aria-hidden` porque es puro adorno: el ícono de verdad
          ya está arriba, al lado del título. */}
      <Icono
        aria-hidden
        className="pointer-events-none absolute -right-5 -bottom-5 h-28 w-28 text-foreground opacity-[0.06] transition-transform duration-500 group-hover:scale-110"
      />

      {/* De acá para abajo todo va `relative` para quedar por encima del ícono
          de fondo, que está posicionado y si no taparía el contenido. */}
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted transition-transform group-hover:scale-105">
          <Icono className="h-5 w-5 text-foreground/70" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{titulo}</p>
          <p className="truncate text-xs text-muted-foreground">{descripcion}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>

      <div className="relative min-w-0">
        <p className={cn("truncate text-3xl font-semibold tabular-nums", TONO_TEXTO[resumen.tono])}>
          {resumen.valor}
        </p>
        <p className="truncate text-xs text-muted-foreground">{resumen.detalle}</p>
      </div>

      {porcentaje !== null && (
        <div className="relative flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                TONO_BARRA[resumen.tono]
              )}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(porcentaje)}% completado
          </span>
        </div>
      )}

      {resumen.chips.length > 0 && (
        <div className="relative mt-auto flex flex-wrap gap-1.5">
          {resumen.chips.map((c) => (
            <span
              key={c.etiqueta}
              className="inline-flex items-baseline gap-1 rounded-md border bg-background/60 px-2 py-1 text-xs"
            >
              <span className="text-muted-foreground">{c.etiqueta}</span>
              <span className="font-medium tabular-nums">{c.valor}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/**
 * Detalle de un proyecto: arranca en una portada con una tarjeta por sección
 * y, al tocar una, la reemplaza por el contenido de esa sección. No hay barra
 * de pestañas: se vuelve con el botón "Volver".
 *
 * El contenido de cada sección llega como prop en vez de renderizarse acá:
 * son server components y necesitan que los arme la página.
 */
export function ProyectoSecciones({
  resumen,
  movimientos,
  tareas,
  municipal,
  documentacion,
  flujoFondos,
}: {
  resumen: ResumenProyecto;
  movimientos: React.ReactNode;
  tareas: React.ReactNode;
  municipal: React.ReactNode;
  documentacion: React.ReactNode;
  /** Null cuando el usuario no tiene permiso de Flujo de fondos. */
  flujoFondos: React.ReactNode | null;
}) {
  const [seccion, setSeccion] = useState<ClaveSeccion | null>(null);

  const contenidos: Record<ClaveSeccion, { titulo: string; nodo: React.ReactNode }> = {
    movimientos: { titulo: "Movimientos", nodo: movimientos },
    tareas: { titulo: "Tareas", nodo: tareas },
    municipal: { titulo: "Municipal", nodo: municipal },
    documentacion: { titulo: "Documentación", nodo: documentacion },
    "flujo-fondos": { titulo: "Flujo de fondos", nodo: flujoFondos },
  };

  if (seccion) {
    const actual = contenidos[seccion];
    return (
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setSeccion(null)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">{actual.titulo}</h2>
        </div>
        {actual.nodo}
      </div>
    );
  }

  // Se arma como lista y no como cinco tarjetas escritas a mano porque el ancho
  // de cada una depende de cuántas haya en total (ver `spanTarjeta`), y eso solo
  // se sabe después de descartar la de Flujo de fondos cuando no hay permiso.
  // El orden es el de la portada: arriba lo que se consulta seguido
  // (documentación, tareas, trámites) y abajo, juntas y más anchas, las dos que
  // hablan de plata y materiales.
  const tarjetas: {
    clave: ClaveSeccion;
    titulo: string;
    descripcion: string;
    icono: LucideIcon;
    resumen: ResumenSeccion;
  }[] = [
    {
      clave: "documentacion",
      titulo: "Documentación",
      descripcion: "Planos y documentos del proyecto",
      icono: FileText,
      resumen: resumen.documentacion,
    },
    {
      clave: "tareas",
      titulo: "Tareas",
      descripcion: "Pendientes de la obra",
      icono: ListChecks,
      resumen: resumen.tareas,
    },
    {
      clave: "municipal",
      titulo: "Municipal",
      descripcion: "Trámites y presentaciones",
      icono: Landmark,
      resumen: resumen.municipal,
    },
    {
      clave: "movimientos",
      titulo: "Movimientos",
      descripcion: "Pedidos y entregas de materiales",
      icono: ClipboardList,
      resumen: resumen.movimientos,
    },
    ...(resumen.flujoFondos
      ? [
          {
            clave: "flujo-fondos" as const,
            titulo: "Flujo de fondos",
            descripcion: "Aportes, gastos y ventas",
            icono: Wallet,
            resumen: resumen.flujoFondos,
          },
        ]
      : []),
  ];

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {tarjetas.map((t, i) => (
        <Tarjeta
          key={t.clave}
          titulo={t.titulo}
          descripcion={t.descripcion}
          icono={t.icono}
          resumen={t.resumen}
          onClick={() => setSeccion(t.clave)}
          className={spanTarjeta(i, tarjetas.length)}
        />
      ))}
    </div>
  );
}
