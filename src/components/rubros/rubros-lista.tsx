"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RubroDialog } from "@/components/rubros/rubro-dialog";

type Rubro = {
  id: string;
  nombre: string;
  codigoPrefijo?: string | null;
  _count: { proveedores: number };
};

export function RubrosLista({
  rubros,
  nuevoRubro,
}: {
  rubros: Rubro[];
  nuevoRubro?: React.ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");

  const rubrosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return rubros.filter((r) => {
      if (!texto) return true;
      return (
        r.nombre.toLowerCase().includes(texto) ||
        (r.codigoPrefijo ?? "").toLowerCase().includes(texto)
      );
    });
  }, [rubros, busqueda]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input
          placeholder="Buscar rubro o prefijo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-56"
        />
        {nuevoRubro}
      </div>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prefijo</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Proveedores</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rubrosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No hay rubros que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {rubrosFiltrados.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.codigoPrefijo ?? "—"}
                </TableCell>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell>{r._count.proveedores}</TableCell>
                <TableCell className="text-right">
                  <RubroDialog
                    rubro={r}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
