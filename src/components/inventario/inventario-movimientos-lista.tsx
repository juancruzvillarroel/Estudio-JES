"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/ui/delete-button";
import { deleteMovimientoInventario } from "@/actions/inventario";
import { formatFecha } from "@/lib/utils";

export type MovimientoInventarioRow = {
  id: string;
  materialNombre: string;
  unidad: string;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  fecha: string;
  notas: string | null;
};

export function InventarioMovimientosLista({
  movimientos,
}: {
  movimientos: MovimientoInventarioRow[];
}) {
  if (movimientos.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Todavía no hay movimientos registrados.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movimientos.map((mov) => (
            <TableRow key={mov.id}>
              <TableCell>{formatFecha(mov.fecha)}</TableCell>
              <TableCell className="font-medium">{mov.materialNombre}</TableCell>
              <TableCell>
                <Badge variant={mov.tipo === "ENTRADA" ? "secondary" : "outline"}>
                  {mov.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {mov.tipo === "SALIDA" ? "-" : "+"}
                {mov.cantidad} {mov.unidad}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <DeleteButton
                    iconOnly
                    action={() => deleteMovimientoInventario(mov.id)}
                    confirmMessage="¿Eliminar este movimiento de inventario? Esta acción no se puede deshacer."
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
