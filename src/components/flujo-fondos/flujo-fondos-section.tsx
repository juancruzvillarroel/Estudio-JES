"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResumenFlujoFondos } from "@/components/flujo-fondos/resumen-flujo-fondos";
import { MovimientoFondoTabla } from "@/components/flujo-fondos/movimiento-fondo-tabla";
import type { MovimientoFondoOpcion, ProyectoInversorOpcion } from "@/lib/flujo-fondos";

type SubrubroOpcion = { id: string; nombre: string };
type RubroOpcion = { id: string; nombre: string; subrubros: SubrubroOpcion[] };
type ProveedorOpcion = { id: string; nombre: string; rubroIds: string[] };

export function FlujoFondosSection({
  proyectoId,
  rubros,
  proveedores,
  asignaciones,
  movimientos,
}: {
  proyectoId: string;
  rubros: RubroOpcion[];
  proveedores: ProveedorOpcion[];
  asignaciones: ProyectoInversorOpcion[];
  movimientos: MovimientoFondoOpcion[];
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
      </TabsList>

      <TabsContent value="resumen" className="mt-4">
        <ResumenFlujoFondos asignaciones={inversores} movimientos={items} />
      </TabsContent>

      <TabsContent value="gastos" className="mt-4">
        <MovimientoFondoTabla
          proyectoId={proyectoId}
          tipo="GASTO"
          rubros={rubros}
          proveedores={proveedores}
          proyectoInversores={proyectoInversores}
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
          movimientos={aportes}
          emptyMessage="Todavía no hay aportes cargados para este proyecto."
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </TabsContent>
    </Tabs>
  );
}
