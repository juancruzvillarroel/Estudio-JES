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
   * que está al día, "alerta" para lo que pide atención.
   */
  tono: "neutral" | "ok" | "alerta";
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
} as const;

const TONO_BARRA = {
  neutral: "bg-foreground/40",
  ok: "bg-success",
  alerta: "bg-warning",
} as const;

function Tarjeta({
  titulo,
  descripcion,
  icono: Icono,
  resumen,
  onClick,
}: {
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  resumen: ResumenSeccion;
  onClick: () => void;
}) {
  const porcentaje =
    resumen.progreso && resumen.progreso.total > 0
      ? (resumen.progreso.hechos / resumen.progreso.total) * 100
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-4 rounded-xl border bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icono className="h-5 w-5 text-foreground/70" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{titulo}</p>
          <p className="truncate text-xs text-muted-foreground">{descripcion}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>

      <div className="min-w-0">
        <p className={cn("truncate text-3xl font-semibold tabular-nums", TONO_TEXTO[resumen.tono])}>
          {resumen.valor}
        </p>
        <p className="truncate text-xs text-muted-foreground">{resumen.detalle}</p>
      </div>

      {porcentaje !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", TONO_BARRA[resumen.tono])}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(porcentaje)}% completado
          </span>
        </div>
      )}

      {resumen.chips.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5">
          {resumen.chips.map((c) => (
            <span
              key={c.etiqueta}
              className="inline-flex items-baseline gap-1 rounded-md bg-muted px-2 py-1 text-xs"
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

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Tarjeta
        titulo="Movimientos"
        descripcion="Pedidos y entregas de materiales"
        icono={ClipboardList}
        resumen={resumen.movimientos}
        onClick={() => setSeccion("movimientos")}
      />
      <Tarjeta
        titulo="Tareas"
        descripcion="Pendientes de la obra"
        icono={ListChecks}
        resumen={resumen.tareas}
        onClick={() => setSeccion("tareas")}
      />
      <Tarjeta
        titulo="Municipal"
        descripcion="Trámites y presentaciones"
        icono={Landmark}
        resumen={resumen.municipal}
        onClick={() => setSeccion("municipal")}
      />
      <Tarjeta
        titulo="Documentación"
        descripcion="Planos y documentos del proyecto"
        icono={FileText}
        resumen={resumen.documentacion}
        onClick={() => setSeccion("documentacion")}
      />
      {resumen.flujoFondos && (
        <Tarjeta
          titulo="Flujo de fondos"
          descripcion="Aportes, gastos y ventas"
          icono={Wallet}
          resumen={resumen.flujoFondos}
          onClick={() => setSeccion("flujo-fondos")}
        />
      )}
    </div>
  );
}
