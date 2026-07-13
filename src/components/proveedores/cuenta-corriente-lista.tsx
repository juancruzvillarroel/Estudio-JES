"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoPedidoBadge } from "@/components/pedidos/estado-badge";
import { cn, formatNumeroPedido } from "@/lib/utils";
import type { EstadoPedido } from "@/generated/prisma/client";

export type MovimientoItem = {
  id: string;
  material: string;
  cantidad: number;
  unidad: string;
};

export type Movimiento = {
  id: string;
  tipo: "PEDIDO" | "ENTREGA";
  fecha: string;
  proyectoId: string;
  proyectoNombre: string;
  numero: number;
  numeroRemito?: string | null;
  estado?: EstadoPedido;
  items: MovimientoItem[];
};

export function CuentaCorrienteLista({ movimientos }: { movimientos: Movimiento[] }) {
  if (movimientos.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No hay pedidos ni entregas que coincidan con el filtro.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 rounded-t-md bg-neutral-800 px-2 py-2 font-sans text-sm font-bold tracking-tight text-white">
        <span className="size-4 shrink-0" aria-hidden />
        <div className="grid flex-1 grid-cols-[110px_1fr_100px_160px_120px] gap-2">
          <span>Fecha</span>
          <span>Proyecto</span>
          <span className="text-right">Tipo</span>
          <span className="text-right">Número</span>
          <span className="text-right">Estado</span>
        </div>
      </div>
      <Accordion multiple className="px-2">
        {movimientos.map((mov) => (
          <AccordionItem
            key={mov.id}
            value={mov.id}
            className={cn(mov.tipo === "ENTREGA" && "bg-muted/40")}
          >
            <AccordionTrigger>
              <div
                className={cn(
                  "grid flex-1 grid-cols-[110px_1fr_100px_160px_120px] items-center gap-2 text-sm",
                  mov.tipo === "ENTREGA" && "font-bold"
                )}
              >
                <span>{new Date(mov.fecha).toLocaleDateString("es-AR")}</span>
                <Link
                  href={`/proyectos/${mov.proyectoId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate hover:underline"
                >
                  {mov.proyectoNombre}
                </Link>
                <div className="flex justify-end">
                  <Badge variant={mov.tipo === "PEDIDO" ? "outline" : "secondary"}>
                    {mov.tipo === "PEDIDO" ? "Pedido" : "Entrega"}
                  </Badge>
                </div>
                <span className="text-right">
                  {mov.tipo === "PEDIDO" ? (
                    <>#{formatNumeroPedido(mov.numero)}</>
                  ) : (
                    <>
                      Pedido #{formatNumeroPedido(mov.numero)}
                      {mov.numeroRemito && ` · Remito ${mov.numeroRemito}`}
                    </>
                  )}
                </span>
                <div className="flex justify-end">
                  {mov.tipo === "PEDIDO" && mov.estado ? <EstadoPedidoBadge estado={mov.estado} /> : "—"}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionPanel>
              <div className="ml-6 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-white text-foreground">Material</TableHead>
                      <TableHead className="bg-white text-foreground">
                        {mov.tipo === "PEDIDO" ? "Pedido" : "Entregado"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mov.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.material}</TableCell>
                        <TableCell>
                          {item.cantidad} {item.unidad}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
