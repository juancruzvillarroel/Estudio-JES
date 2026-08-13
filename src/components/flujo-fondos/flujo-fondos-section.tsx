"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResumenFlujoFondos } from "@/components/flujo-fondos/resumen-flujo-fondos";
import { RubrosResumen } from "@/components/flujo-fondos/rubros-resumen";
import { GastosCronograma } from "@/components/flujo-fondos/gastos-cronograma";
import { MovimientoFondoTabla } from "@/components/flujo-fondos/movimiento-fondo-tabla";
import { ProyectoInversoresPanel } from "@/components/flujo-fondos/proyecto-inversores-panel";
import { MediosPagoPanel } from "@/components/flujo-fondos/medios-pago-panel";
import { UnidadesProyectoPanel } from "@/components/flujo-fondos/unidades-proyecto-panel";
import { M2VendiblesPanel } from "@/components/flujo-fondos/m2-vendibles-panel";
import { VentasSection } from "@/components/ventas/ventas-section";
import type {
  MovimientoFondoOpcion,
  ProyectoInversorOpcion,
  MedioPagoOpcion,
  UnidadProyectoOpcion,
} from "@/lib/flujo-fondos";
import type { VentaOpcion } from "@/lib/ventas";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
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

  const handleSaved = (movimiento: MovimientoFondoOpcion) => {
    setItems((prev) => {
      const existe = prev.some((m) => m.id === movimiento.id);
      return existe ? prev.map((m) => (m.id === movimiento.id ? movimiento : m)) : [...prev, movimiento];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  const gastos = items.filter((m) => m.tipo === "GASTO");
  const aportes = items.filter((m) => m.tipo === "APORTE");
  const proyectoInversores = inversores.map((a) => ({ id: a.id, inversorNombre: a.inversorNombre }));

  return (
    <Tabs defaultValue="resumen">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="gastos">Gastos</TabsTrigger>
        <TabsTrigger value="aportes">Aportes</TabsTrigger>
        <TabsTrigger value="rubros">Rubros</TabsTrigger>
        <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
        <TabsTrigger value="ventas">Ventas</TabsTrigger>
        <TabsTrigger value="datos">Datos del proyecto</TabsTrigger>
      </TabsList>

      <TabsContent value="resumen" className="mt-4">
        <ResumenFlujoFondos
          proyectoNombre={proyectoNombre}
          asignaciones={inversores}
          movimientos={items}
          rubros={rubros}
          ventas={ventas}
          unidades={unidades}
          m2Vendibles={m2Actuales}
        />
      </TabsContent>

      <TabsContent value="rubros" className="mt-4">
        <RubrosResumen rubros={rubros} movimientos={items} />
      </TabsContent>

      <TabsContent value="gastos" className="mt-4">
        <MovimientoFondoTabla
          proyectoId={proyectoId}
          tipo="GASTO"
          rubros={rubros}
          proveedores={proveedores}
          proyectoInversores={proyectoInversores}
          mediosPago={mediosPagoActuales}
          movimientos={gastos}
          emptyMessage="Todavía no hay gastos cargados para este proyecto."
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </TabsContent>

      <TabsContent value="aportes" className="mt-4">
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

      <TabsContent value="cronograma" className="mt-4">
        <GastosCronograma rubros={rubros} movimientos={items} />
      </TabsContent>

      <TabsContent value="ventas" className="mt-4 flex flex-col gap-4">
        <VentasSection
          proyectoId={proyectoId}
          ventas={ventas}
          unidades={unidades}
          mediosPago={mediosPagoActuales}
        />
      </TabsContent>

      <TabsContent value="datos" className="mt-4 flex flex-col gap-4">
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
        <UnidadesProyectoPanel proyectoId={proyectoId} unidades={unidades} />
      </TabsContent>
    </Tabs>
  );
}
