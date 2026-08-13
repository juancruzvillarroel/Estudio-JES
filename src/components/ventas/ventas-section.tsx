"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { VentaDialog } from "@/components/ventas/venta-dialog";
import { marcarCuotaCobro } from "@/actions/ventas";
import { formatFecha } from "@/lib/utils";
import type { MedioPagoOpcion, UnidadProyectoOpcion } from "@/lib/flujo-fondos";
import type { VentaOpcion } from "@/lib/ventas";

const MODALIDAD_LABELS: Record<VentaOpcion["modalidad"], string> = {
  CONTADO: "Contado",
  FINANCIADO: "Con anticipo y cuotas",
};

function formatMontoMoneda(monto: number, moneda: "ARS" | "USD") {
  return `${moneda} ${monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VentasSection({
  proyectoId,
  ventas,
  unidades,
  mediosPago,
}: {
  proyectoId: string;
  ventas: VentaOpcion[];
  unidades: UnidadProyectoOpcion[];
  mediosPago: MedioPagoOpcion[];
}) {
  const [items, setItems] = useState(ventas);
  const [prevVentas, setPrevVentas] = useState(ventas);
  if (ventas !== prevVentas) {
    setPrevVentas(ventas);
    setItems(ventas);
  }

  const [pending, startTransition] = useTransition();

  const handleSaved = (venta: VentaOpcion) => {
    setItems((prev) => {
      const existe = prev.some((v) => v.id === venta.id);
      return existe ? prev.map((v) => (v.id === venta.id ? venta : v)) : [...prev, venta];
    });
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((v) => v.id !== id));
  };

  const handleToggleCobro = (cuotaId: string, cobrada: boolean) => {
    startTransition(async () => {
      const result = await marcarCuotaCobro(cuotaId, {
        cobrada,
        fechaCobro: cobrada ? new Date().toISOString().slice(0, 10) : undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      handleSaved(result.venta);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Ventas del proyecto</h3>
          <p className="text-xs text-muted-foreground">
            Cargá cada venta de unidad con su plan de pagos y marcá el anticipo y las cuotas a
            medida que se van cobrando.
          </p>
        </div>
        <VentaDialog
          proyectoId={proyectoId}
          unidades={unidades}
          mediosPago={mediosPago}
          onSaved={handleSaved}
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Nueva venta
            </Button>
          }
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay ventas cargadas para este proyecto.
        </div>
      ) : (
        <Accordion multiple className="flex flex-col gap-2">
          {items.map((venta) => {
            const totalCobrado = venta.cuotas
              .filter((c) => c.cobrada)
              .reduce((acc, c) => acc + c.monto, 0);
            const totalPendiente = venta.precioTotal - totalCobrado;

            return (
              <div key={venta.id} className="rounded-md border">
                <AccordionItem value={venta.id} className="border-0">
                  <AccordionTrigger className="px-3 py-3">
                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                      <div className="flex w-full items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{venta.unidadNombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {venta.compradorNombre} · {formatFecha(venta.fecha)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline">{MODALIDAD_LABELS[venta.modalidad]}</Badge>
                          <span className="text-sm font-medium">
                            {formatMontoMoneda(venta.precioTotal, venta.moneda)}
                          </span>
                        </div>
                      </div>
                      {totalPendiente > 0.005 && (
                        <span className="text-xs text-warning">
                          Pendiente de cobro: {formatMontoMoneda(totalPendiente, venta.moneda)}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionPanel className="px-3">
                    <div className="flex flex-col gap-3 border-t pt-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {venta.medioPagoNombre && <span>Medio de pago: {venta.medioPagoNombre}</span>}
                        {venta.notas && <span>Notas: {venta.notas}</span>}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {venta.cuotas.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs"
                          >
                            <span className="w-20 shrink-0 font-medium">
                              {c.esAnticipo ? "Anticipo" : `Cuota ${c.numero}`}
                            </span>
                            <span className="w-24 shrink-0 text-muted-foreground">
                              {formatFecha(c.fecha)}
                            </span>
                            <span className="flex-1 font-medium">
                              {formatMontoMoneda(c.monto, venta.moneda)}
                            </span>
                            {c.cobrada ? (
                              <span className="shrink-0 text-muted-foreground">
                                {c.fechaCobro && `Cobrada el ${formatFecha(c.fechaCobro)}`}
                              </span>
                            ) : null}
                            <Badge variant={c.cobrada ? "success" : "warning"}>
                              {c.cobrada ? "Cobrada" : "Pendiente"}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => handleToggleCobro(c.id, !c.cobrada)}
                            >
                              {c.cobrada ? "Marcar pendiente" : "Marcar cobrada"}
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-end">
                        <VentaDialog
                          proyectoId={proyectoId}
                          unidades={unidades}
                          mediosPago={mediosPago}
                          item={venta}
                          onSaved={handleSaved}
                          onDeleted={handleDeleted}
                          trigger={
                            <Button type="button" variant="outline" size="sm">
                              <Pencil className="h-3.5 w-3.5" />
                              Editar venta
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              </div>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
