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
import { cn, formatFecha } from "@/lib/utils";

export type MovimientoInventarioRow = {
  id: string;
  materialNombre: string;
  unidad: string;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  fecha: string;
  notas: string | null;
};

const COL_FECHA = "w-24";
const COL_TIPO = "w-24";
const COL_CANTIDAD = "w-28";
const COL_ACCIONES = "w-20";

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
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className={COL_FECHA}>Fecha</TableHead>
            <TableHead>Material</TableHead>
            <TableHead className={COL_TIPO}>Tipo</TableHead>
            <TableHead className={cn(COL_CANTIDAD, "text-right")}>Cantidad</TableHead>
            <TableHead className={cn(COL_ACCIONES, "text-right")}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movimientos.map((mov) => (
            <TableRow key={mov.id}>
              <TableCell className={COL_FECHA}>
                {formatFecha(mov.fecha)}
              </TableCell>
              <TableCell className="truncate font-medium">{mov.materialNombre}</TableCell>
              <TableCell className={COL_TIPO}>
                <Badge variant={mov.tipo === "ENTRADA" ? "secondary" : "outline"}>
                  {mov.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                </Badge>
              </TableCell>
              <TableCell className={cn(COL_CANTIDAD, "text-right")}>
                {mov.tipo === "SALIDA" ? "-" : "+"}
                {mov.cantidad} {mov.unidad}
              </TableCell>
              <TableCell className={cn(COL_ACCIONES, "text-right")}>
                <DeleteButton
                  iconOnly
                  action={() => deleteMovimientoInventario(mov.id)}
                  confirmMessage="¿Eliminar este movimiento de inventario? Esta acción no se puede deshacer."
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
