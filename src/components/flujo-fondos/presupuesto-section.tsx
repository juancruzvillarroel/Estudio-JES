"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PresupuestoRubros } from "@/components/flujo-fondos/presupuesto-rubros";
import { PresupuestoFlujo } from "@/components/flujo-fondos/presupuesto-flujo";
import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";
import { armarGrilla, type PresupuestoItemOpcion } from "@/lib/presupuesto";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = { id: string; nombre: string; subrubros: SubrubroOpcion[] };

const PANEL = "mt-3 animate-in fade-in-0 duration-200 motion-reduce:animate-none";

/**
 * Solapa Presupuesto, partida en las dos preguntas que en realidad son
 * distintas: cuánto sale cada rubro y cuándo se gasta.
 *
 * Estaban juntas en una sola pantalla y no funcionaba: cargar veinte montos y
 * acomodar veinte barras son dos momentos del trabajo, con dos formas de mirar,
 * y mezclarlos obligaba a que cada fila hiciera las dos cosas a la vez.
 *
 * El estado de las líneas vive acá, arriba de las dos sub-solapas, para que un
 * monto cargado en Rubros ya esté puesto al pasar a Flujo proyectado sin
 * esperar el refresh del servidor.
 */
export function PresupuestoSection({
  proyectoId,
  rubros,
  items: itemsProp,
  movimientos,
  fechaInicio,
  duracionMeses,
  onIrADatos,
}: {
  proyectoId: string;
  rubros: RubroOpcion[];
  items: PresupuestoItemOpcion[];
  movimientos: MovimientoFondoOpcion[];
  /** "AAAA-MM-DD" o null si todavía no se cargó. */
  fechaInicio: string | null;
  duracionMeses: number | null;
  /** Lleva a la solapa "Datos del proyecto" desde el estado vacío del flujo. */
  onIrADatos?: () => void;
}) {
  const [items, setItems] = useState(itemsProp);
  const [prevItems, setPrevItems] = useState(itemsProp);
  const [sub, setSub] = useState("rubros");

  if (itemsProp !== prevItems) {
    setPrevItems(itemsProp);
    setItems(itemsProp);
  }

  const grilla = armarGrilla({ rubros, items, movimientos, fechaInicio, duracionMeses });

  const aplicarItem = (item: PresupuestoItemOpcion) => {
    setItems((prev) => {
      const existe = prev.some((i) => i.id === item.id);
      return existe ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item];
    });
  };

  const quitarItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return (
    <Tabs value={sub} onValueChange={(v) => setSub(String(v))}>
      {/* Variante "line" y no la pastilla de la barra de arriba: se ve de una
          que estas dos son un nivel más abajo y no otras siete solapas más. */}
      <TabsList variant="line">
        <TabsTrigger value="rubros">Rubros</TabsTrigger>
        <TabsTrigger value="flujo">Flujo proyectado</TabsTrigger>
      </TabsList>

      <TabsContent value="rubros" className={PANEL}>
        <PresupuestoRubros
          proyectoId={proyectoId}
          grilla={grilla}
          totalMeses={duracionMeses ?? 1}
          onGuardado={aplicarItem}
          onEliminado={quitarItem}
        />
      </TabsContent>

      <TabsContent value="flujo" className={PANEL}>
        <PresupuestoFlujo
          proyectoId={proyectoId}
          grilla={grilla}
          fechaInicio={fechaInicio}
          duracionMeses={duracionMeses}
          onGuardado={aplicarItem}
          onIrADatos={onIrADatos}
          onIrARubros={() => setSub("rubros")}
        />
      </TabsContent>
    </Tabs>
  );
}
