"use client";

import { useEffect } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FacturaDialog,
  type PedidoFacturaOpcion,
  type ProveedorFacturaOpcion,
  type RubroFacturaOpcion,
} from "@/components/flujo-fondos/factura-dialog";
import { estaPendiente, type FacturaOpcion } from "@/lib/facturas";
import { formatFecha, formatMontoMoneda } from "@/lib/utils";

/**
 * La factura del pedido, en la pantalla del pedido.
 *
 * La mayoría de los pedidos no tiene factura y nunca la va a tener —el corralón
 * se junta y se paga sin comprobante—, así que el panel no reclama nada cuando
 * está vacío: ofrece cargarla y listo.
 *
 * Se muestra solo a quien tenga permiso de Flujo de fondos, porque cargar una
 * factura genera deuda y su pago es un gasto de la obra.
 */
export function PedidoFacturaPanel({
  proyectoId,
  pedido,
  factura,
  rubros,
  proveedores,
  abrirFactura,
}: {
  proyectoId: string;
  pedido: PedidoFacturaOpcion;
  factura: FacturaOpcion | null;
  rubros: RubroFacturaOpcion[];
  proveedores: ProveedorFacturaOpcion[];
  /**
   * Llega en `true` cuando el pedido se acaba de crear con "cargarle la factura
   * ahora" tildado (ver `?factura=1` en movimiento-form.tsx). Abre el diálogo
   * solo, para que la factura se cargue de corrido con el pedido.
   */
  abrirFactura?: boolean;
}) {
  // El `?factura=1` ya cumplió su función al montar: se saca de la barra de
  // direcciones para que recargar la página —o volver con el botón de atrás—
  // no vuelva a abrir el formulario. Se usa la API del navegador y no
  // `router.replace` para no rehacer el render del servidor por un parámetro
  // que ya no cambia nada de lo que se ve.
  useEffect(() => {
    if (!abrirFactura) return;
    window.history.replaceState(null, "", `/pedidos/${pedido.id}`);
  }, [abrirFactura, pedido.id]);

  const dialogo = (trigger: React.ReactNode, abrirAlMontar?: boolean) => (
    <FacturaDialog
      proyectoId={proyectoId}
      rubros={rubros}
      proveedores={proveedores}
      pedidos={[pedido]}
      item={factura ?? undefined}
      pedidoInicial={pedido}
      abrirAlMontar={abrirAlMontar}
      trigger={trigger}
    />
  );

  if (!factura) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
        <p className="text-sm text-muted-foreground">
          Este pedido no tiene factura cargada.
        </p>
        {dialogo(
          <Button variant="outline" size="sm">
            <Plus />
            Cargar factura
          </Button>,
          abrirFactura
        )}
      </div>
    );
  }

  const pendiente = estaPendiente(factura);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Factura {factura.numero}</span>
          {pendiente ? (
            <Badge variant="secondary">
              Debe {formatMontoMoneda(factura.saldo, factura.moneda)}
            </Badge>
          ) : (
            <Badge variant="outline">Pagada</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatMontoMoneda(factura.monto, factura.moneda)} · {formatFecha(factura.fecha)}
          {factura.fechaVencimiento && ` · vence ${formatFecha(factura.fechaVencimiento)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {factura.archivoUrl && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={factura.archivoUrl} target="_blank" rel="noopener noreferrer">
                <FileText />
                Ver factura
              </a>
            }
          />
        )}
        {dialogo(
          <Button variant="outline" size="sm">
            Editar factura
          </Button>
        )}
      </div>
    </div>
  );
}
