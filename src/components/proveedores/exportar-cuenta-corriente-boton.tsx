"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { ESTADO_CONFIG } from "@/components/pedidos/estado-badge";
import { formatFecha, formatNumeroPedido } from "@/lib/utils";
import type { Movimiento } from "@/components/proveedores/cuenta-corriente-lista";

export function ExportarCuentaCorrienteBoton({
  movimientos,
  proveedorNombre,
}: {
  movimientos: Movimiento[];
  proveedorNombre: string;
}) {
  const exportarExcel = () => {
    const rows = movimientos.flatMap((mov) =>
      mov.items.map((item) => ({
        Fecha: formatFecha(mov.fecha),
        Proyecto: mov.proyectoNombre,
        Tipo: mov.tipo === "PEDIDO" ? "Pedido" : "Entrega",
        Número:
          mov.tipo === "PEDIDO"
            ? `#${formatNumeroPedido(mov.numero)}`
            : `Pedido #${formatNumeroPedido(mov.numero)}`,
        Remito: mov.tipo === "ENTREGA" ? mov.numeroRemito ?? "" : "",
        Estado: mov.tipo === "PEDIDO" && mov.estado ? ESTADO_CONFIG[mov.estado].label : "",
        Material: item.material,
        Cantidad: item.cantidad,
        Unidad: item.unidad,
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuenta corriente");
    XLSX.writeFile(wb, `cuenta-corriente-${proveedorNombre.trim().replace(/\s+/g, "-")}.xlsx`);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={exportarExcel}
      disabled={movimientos.length === 0}
      aria-label="Descargar Excel"
      title="Descargar Excel"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
