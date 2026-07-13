"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { EstadoPedidoBadge } from "@/components/pedidos/estado-badge";
import { EditarEntregaDialog } from "@/components/pedidos/editar-entrega-dialog";
import { deletePedido } from "@/actions/pedidos";
import { deleteEntrega } from "@/actions/entregas";
import { cn, formatFecha, formatNumeroPedido } from "@/lib/utils";

type Estado = "PENDIENTE" | "PARCIAL" | "COMPLETO" | "CANCELADO";
type Tipo = "PEDIDO" | "ENTREGA";

export type PedidoRow = {
  id: string;
  numero: number;
  proyectoId: string;
  proyectoNombre: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaISO: string;
  estado: Estado;
  notas: string | null;
  archivoUrl: string | null;
};

export type EntregaRow = {
  id: string;
  pedidoId: string;
  pedidoNumero: number;
  proyectoId: string;
  proyectoNombre: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaISO: string;
  estadoPedido: Estado;
  numeroRemito: string | null;
  remitoUrl: string | null;
  notas: string | null;
};

type FilaUnificada = {
  key: string;
  tipo: Tipo;
  id: string;
  pedidoId: string;
  numero: number;
  proyectoId: string;
  proyectoNombre: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaISO: string;
  estado: Estado;
  numeroRemito: string | null;
  remitoUrl: string | null;
  archivoUrl: string | null;
  notas: string | null;
};

const ESTADO_ITEMS: Record<Estado, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  COMPLETO: "Completo",
  CANCELADO: "Cancelado",
};

const TIPO_ITEMS: Record<Tipo, string> = {
  PEDIDO: "Pedido",
  ENTREGA: "Entrega",
};

const COL_PEDIDO = "w-24";
const COL_TIPO = "w-28";
const COL_FECHA = "w-28";
const COL_ULTIMA = "w-40";
const COL_ACCIONES = "w-20";

export function PedidosEntregasList({
  pedidos,
  entregas,
}: {
  pedidos: PedidoRow[];
  entregas: EntregaRow[];
}) {
  const [proyectoId, setProyectoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");

  const proyectoItems = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pedidos) map.set(p.proyectoId, p.proyectoNombre);
    for (const e of entregas) map.set(e.proyectoId, e.proyectoNombre);
    return Object.fromEntries([...map.entries()].sort((a, b) => a[1].localeCompare(b[1])));
  }, [pedidos, entregas]);

  const proveedorItems = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pedidos) map.set(p.proveedorId, p.proveedorNombre);
    for (const e of entregas) map.set(e.proveedorId, e.proveedorNombre);
    return Object.fromEntries([...map.entries()].sort((a, b) => a[1].localeCompare(b[1])));
  }, [pedidos, entregas]);

  const filas = useMemo(() => {
    const pedidoFilas: FilaUnificada[] = pedidos.map((p) => ({
      key: `pedido-${p.id}`,
      tipo: "PEDIDO",
      id: p.id,
      pedidoId: p.id,
      numero: p.numero,
      proyectoId: p.proyectoId,
      proyectoNombre: p.proyectoNombre,
      proveedorId: p.proveedorId,
      proveedorNombre: p.proveedorNombre,
      fechaISO: p.fechaISO,
      estado: p.estado,
      numeroRemito: null,
      remitoUrl: null,
      archivoUrl: p.archivoUrl,
      notas: p.notas,
    }));
    const entregaFilas: FilaUnificada[] = entregas.map((e) => ({
      key: `entrega-${e.id}`,
      tipo: "ENTREGA",
      id: e.id,
      pedidoId: e.pedidoId,
      numero: e.pedidoNumero,
      proyectoId: e.proyectoId,
      proyectoNombre: e.proyectoNombre,
      proveedorId: e.proveedorId,
      proveedorNombre: e.proveedorNombre,
      fechaISO: e.fechaISO,
      estado: e.estadoPedido,
      numeroRemito: e.numeroRemito,
      remitoUrl: e.remitoUrl,
      archivoUrl: null,
      notas: e.notas,
    }));
    return [...pedidoFilas, ...entregaFilas].sort((a, b) => b.fechaISO.localeCompare(a.fechaISO));
  }, [pedidos, entregas]);

  const filasFiltradas = filas.filter(
    (f) =>
      (!proyectoId || f.proyectoId === proyectoId) &&
      (!proveedorId || f.proveedorId === proveedorId) &&
      (!estado || f.estado === estado) &&
      (!tipo || f.tipo === tipo)
  );

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtroObra">Obra</Label>
          <Select
            value={proyectoId}
            onValueChange={(v) => setProyectoId(v ?? "")}
            items={proyectoItems}
          >
            <SelectTrigger id="filtroObra" className="w-full">
              <SelectValue placeholder="Todas las obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las obras</SelectItem>
              {Object.entries(proyectoItems).map(([id, nombre]) => (
                <SelectItem key={id} value={id}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtroProveedor">Proveedor</Label>
          <Select
            value={proveedorId}
            onValueChange={(v) => setProveedorId(v ?? "")}
            items={proveedorItems}
          >
            <SelectTrigger id="filtroProveedor" className="w-full">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los proveedores</SelectItem>
              {Object.entries(proveedorItems).map(([id, nombre]) => (
                <SelectItem key={id} value={id}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtroEstado">Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v ?? "")} items={ESTADO_ITEMS}>
            <SelectTrigger id="filtroEstado" className="w-full">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los estados</SelectItem>
              {Object.entries(ESTADO_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtroTipo">Pedido o entrega</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v ?? "")} items={TIPO_ITEMS}>
            <SelectTrigger id="filtroTipo" className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {Object.entries(TIPO_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className={COL_PEDIDO}>Pedido</TableHead>
              <TableHead className={COL_TIPO}>Tipo</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className={COL_FECHA}>Fecha</TableHead>
              <TableHead className={COL_ULTIMA}>Estado / Remito</TableHead>
              <TableHead className={cn(COL_ACCIONES, "text-right")}>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No hay pedidos ni entregas que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {filasFiltradas.map((f) => (
              <TableRow key={f.key} className={cn(f.tipo === "ENTREGA" && "bg-muted/40 font-semibold")}>
                <TableCell className={COL_PEDIDO}>
                  <Link href={`/pedidos/${f.pedidoId}`} className="font-medium hover:underline">
                    #{formatNumeroPedido(f.numero)}
                  </Link>
                </TableCell>
                <TableCell className={COL_TIPO}>
                  <Badge variant={f.tipo === "PEDIDO" ? "outline" : "secondary"}>
                    {f.tipo === "PEDIDO" ? "Pedido" : "Entrega"}
                  </Badge>
                </TableCell>
                <TableCell className="truncate">{f.proyectoNombre}</TableCell>
                <TableCell className="truncate">{f.proveedorNombre}</TableCell>
                <TableCell className={COL_FECHA}>
                  {formatFecha(f.fechaISO)}
                </TableCell>
                <TableCell className={cn(COL_ULTIMA, "truncate")}>
                  {f.tipo === "PEDIDO" ? (
                    <>
                      <EstadoPedidoBadge estado={f.estado} />
                      {f.archivoUrl && (
                        <>
                          {" · "}
                          <a
                            href={f.archivoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Ver
                          </a>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {f.numeroRemito ?? "—"}
                      {f.remitoUrl && (
                        <>
                          {" · "}
                          <a
                            href={f.remitoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Ver
                          </a>
                        </>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className={cn(COL_ACCIONES, "text-right")}>
                  <div className="flex justify-end gap-1">
                    {f.tipo === "PEDIDO" ? (
                      <>
                        <Button
                          render={<Link href={`/pedidos/${f.id}/editar`} />}
                          nativeButton={false}
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar pedido"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          iconOnly
                          action={() => deletePedido(f.id)}
                          confirmMessage={`¿Eliminar el pedido #${formatNumeroPedido(f.numero)}? Esta acción no se puede deshacer.`}
                        />
                      </>
                    ) : (
                      <>
                        <EditarEntregaDialog
                          entregaId={f.id}
                          fechaISO={f.fechaISO}
                          numeroRemito={f.numeroRemito}
                          notas={f.notas}
                          trigger={
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar entrega">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DeleteButton
                          iconOnly
                          action={() => deleteEntrega(f.id)}
                          confirmMessage="¿Eliminar esta entrega? Se revertirá la cantidad entregada del pedido y, si sumó stock al inventario, también se revertirá. Esta acción no se puede deshacer."
                        />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
