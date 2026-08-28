"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ResumenFlujoFondos } from "@/components/flujo-fondos/resumen-flujo-fondos";
import { RubrosResumen } from "@/components/flujo-fondos/rubros-resumen";
import { GastosCronograma } from "@/components/flujo-fondos/gastos-cronograma";
import { MovimientoFondoTabla } from "@/components/flujo-fondos/movimiento-fondo-tabla";
import { ProyectoInversoresPanel } from "@/components/flujo-fondos/proyecto-inversores-panel";
import { MediosPagoPanel } from "@/components/flujo-fondos/medios-pago-panel";
import { UnidadesProyectoPanel } from "@/components/flujo-fondos/unidades-proyecto-panel";
import { M2VendiblesPanel } from "@/components/flujo-fondos/m2-vendibles-panel";
import { PorcentajeHonorariosPanel } from "@/components/flujo-fondos/porcentaje-honorarios-panel";
import { VentasSection } from "@/components/ventas/ventas-section";
import type {
  MovimientoFondoOpcion,
  ProyectoInversorOpcion,
  MedioPagoOpcion,
  UnidadProyectoOpcion,
} from "@/lib/flujo-fondos";
import { sugerirHonorarios } from "@/lib/honorarios";
import type { VentaOpcion } from "@/lib/ventas";

/**
 * Entrada del panel al cambiar de solapa: aparece subiendo apenas unos píxeles.
 *
 * Base UI desmonta el panel que no está activo, así que el contenido nuevo se
 * monta y la animación arranca sola, sin nada que disparar a mano. Es corta a
 * propósito: acompaña a la pastilla que se desliza y no hace esperar.
 */
const PANEL = "mt-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
  /** Ver src/lib/honorarios.ts: qué rubros entran en la base y cuál es el de honorarios. */
  pagaHonorarios: boolean;
  esHonorarios: boolean;
  subrubros: SubrubroOpcion[];
};
type ProveedorOpcion = { id: string; nombre: string; rubroIds: string[] };

export function FlujoFondosSection({
  proyectoId,
  proyectoNombre,
  rubros,
  proveedores,
  asignaciones,
  movimientos,
  mediosPago,
  unidades,
  ventas,
  m2Vendibles,
  porcentajeHonorarios,
}: {
  proyectoId: string;
  /** Encabeza el informe imprimible que se descarga desde el resumen. */
  proyectoNombre: string;
  rubros: RubroOpcion[];
  proveedores: ProveedorOpcion[];
  asignaciones: ProyectoInversorOpcion[];
  movimientos: MovimientoFondoOpcion[];
  mediosPago: MedioPagoOpcion[];
  unidades: UnidadProyectoOpcion[];
  ventas: VentaOpcion[];
  m2Vendibles: number | null;
  porcentajeHonorarios: number | null;
}) {
  const [items, setItems] = useState(movimientos);
  const [prevMovimientos, setPrevMovimientos] = useState(movimientos);
  if (movimientos !== prevMovimientos) {
    setPrevMovimientos(movimientos);
    setItems(movimientos);
  }

  const [inversores, setInversores] = useState(asignaciones);
  const [prevAsignaciones, setPrevAsignaciones] = useState(asignaciones);
  if (asignaciones !== prevAsignaciones) {
    setPrevAsignaciones(asignaciones);
    setInversores(asignaciones);
  }

  const [mediosPagoActuales, setMediosPagoActuales] = useState(mediosPago);
  const [prevMediosPago, setPrevMediosPago] = useState(mediosPago);
  if (mediosPago !== prevMediosPago) {
    setPrevMediosPago(mediosPago);
    setMediosPagoActuales(mediosPago);
  }

  // Se guarda en estado para que al cargar los m² desde "Datos del proyecto"
  // el resumen recalcule los costos por m² sin esperar el refresh del server.
  const [m2Actuales, setM2Actuales] = useState(m2Vendibles);
  const [prevM2, setPrevM2] = useState(m2Vendibles);
  if (m2Vendibles !== prevM2) {
    setPrevM2(m2Vendibles);
    setM2Actuales(m2Vendibles);
  }

  // Mismo motivo que los m²: al cargar el porcentaje desde "Datos del proyecto"
  // la calculadora de honorarios del resumen se actualiza en el acto.
  const [porcentajeActual, setPorcentajeActual] = useState(porcentajeHonorarios);
  const [prevPorcentaje, setPrevPorcentaje] = useState(porcentajeHonorarios);
  if (porcentajeHonorarios !== prevPorcentaje) {
    setPrevPorcentaje(porcentajeHonorarios);
    setPorcentajeActual(porcentajeHonorarios);
  }

  const handleSaved = (movimiento: MovimientoFondoOpcion) => {
    setItems((prev) => {
      const existe = prev.some((m) => m.id === movimiento.id);
      return existe ? prev.map((m) => (m.id === movimiento.id ? movimiento : m)) : [...prev, movimiento];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  // Se calcula acá, donde están todos los movimientos de la obra: el diálogo
  // solo ve los de la pestaña en la que se abrió.
  const sugerenciaHonorarios = sugerirHonorarios({
    movimientos: items,
    rubros,
    porcentaje: porcentajeActual,
  });

  const gastos = items.filter((m) => m.tipo === "GASTO");
  const aportes = items.filter((m) => m.tipo === "APORTE");
  const proyectoInversores = inversores.map((a) => ({ id: a.id, inversorNombre: a.inversorNombre }));

  return (
    <Tabs defaultValue="resumen">
      {/* La barra ocupa todo el ancho de la página y las siete solapas se
          reparten ese ancho en partes iguales (`flex-1` ya venía en cada una,
          lo que faltaba era el `w-full` acá).

          En móvil no entran en un renglón: quedaban cortadas contra el borde y
          había que arrastrar la barra para llegar a las últimas, sin ninguna
          señal de que estuvieran ahí. Ahí envuelve en varios renglones y cada
          solapa vuelve a medir lo que dice, así se ven todas de una.

          `h-auto!` con el `!`: el alto fijo lo pone `group-data-horizontal/tabs:h-8`
          en ui/tabs.tsx, que es un selector de descendiente y le gana en
          especificidad a una utilidad suelta. Y las solapas necesitan un alto
          propio porque traen `h-[calc(100%-1px)]`, que con la barra de alto
          automático no resuelve a nada. Se las apunta por `data-slot` y no con
          `*:` porque el indicador también es hijo directo de la barra y no
          tiene que recibir ni el alto ni el `flex-none`. */}
      <TabsList
        variant="indicator"
        className="w-full max-sm:h-auto! max-sm:flex-wrap max-sm:gap-1 max-sm:[&_[data-slot=tabs-trigger]]:h-7 max-sm:[&_[data-slot=tabs-trigger]]:flex-none"
      >
        <TabsIndicator />
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="gastos">Gastos</TabsTrigger>
        <TabsTrigger value="aportes">Aportes</TabsTrigger>
        <TabsTrigger value="rubros">Rubros</TabsTrigger>
        <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
        <TabsTrigger value="ventas">Ventas</TabsTrigger>
        <TabsTrigger value="datos">Datos del proyecto</TabsTrigger>
      </TabsList>

      <TabsContent value="resumen" className={PANEL}>
        <ResumenFlujoFondos
          proyectoNombre={proyectoNombre}
          asignaciones={inversores}
          movimientos={items}
          rubros={rubros}
          ventas={ventas}
          unidades={unidades}
          m2Vendibles={m2Actuales}
          porcentajeHonorarios={porcentajeActual}
        />
      </TabsContent>

      <TabsContent value="rubros" className={PANEL}>
        <RubrosResumen rubros={rubros} movimientos={items} />
      </TabsContent>

      <TabsContent value="gastos" className={PANEL}>
        <MovimientoFondoTabla
          proyectoId={proyectoId}
          tipo="GASTO"
          rubros={rubros}
          proveedores={proveedores}
          proyectoInversores={proyectoInversores}
          mediosPago={mediosPagoActuales}
          sugerenciaHonorarios={sugerenciaHonorarios}
          movimientos={gastos}
          emptyMessage="Todavía no hay gastos cargados para este proyecto."
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </TabsContent>

      <TabsContent value="aportes" className={PANEL}>
        <MovimientoFondoTabla
          proyectoId={proyectoId}
          tipo="APORTE"
          rubros={rubros}
          proveedores={proveedores}
          proyectoInversores={proyectoInversores}
          mediosPago={mediosPagoActuales}
          movimientos={aportes}
          emptyMessage="Todavía no hay aportes cargados para este proyecto."
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </TabsContent>

      <TabsContent value="cronograma" className={PANEL}>
        <GastosCronograma rubros={rubros} movimientos={items} />
      </TabsContent>

      <TabsContent value="ventas" className={cn(PANEL, "flex flex-col gap-4")}>
        <VentasSection
          proyectoId={proyectoId}
          ventas={ventas}
          unidades={unidades}
          mediosPago={mediosPagoActuales}
        />
      </TabsContent>

      <TabsContent value="datos" className={cn(PANEL, "flex flex-col gap-4")}>
        <ProyectoInversoresPanel proyectoId={proyectoId} asignaciones={inversores} />
        <MediosPagoPanel
          proyectoId={proyectoId}
          medios={mediosPagoActuales}
          onChange={setMediosPagoActuales}
        />
        <M2VendiblesPanel
          proyectoId={proyectoId}
          m2Vendibles={m2Actuales}
          onChange={setM2Actuales}
        />
        <PorcentajeHonorariosPanel
          proyectoId={proyectoId}
          porcentajeHonorarios={porcentajeActual}
          onChange={setPorcentajeActual}
        />
        <UnidadesProyectoPanel proyectoId={proyectoId} unidades={unidades} />
      </TabsContent>
    </Tabs>
  );
}
