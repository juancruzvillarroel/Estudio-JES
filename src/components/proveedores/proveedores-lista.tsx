"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RubroFiltroMultiple } from "@/components/rubros/rubro-filtro-multiple";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProveedorDialog } from "@/components/proveedores/proveedor-dialog";

type Rubro = { id: string; nombre: string };
type Proveedor = {
  id: string;
  nombre: string;
  codigo: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  cuit: string | null;
  notas: string | null;
  rubros: Rubro[];
};

export function ProveedoresLista({
  proveedores,
  rubros,
  nuevoProveedor,
}: {
  proveedores: Proveedor[];
  rubros: Rubro[];
  nuevoProveedor?: React.ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rubroIds, setRubroIds] = useState<string[]>([]);

  const proveedoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return proveedores.filter((p) => {
      const coincideTexto =
        !texto ||
        p.nombre.toLowerCase().includes(texto) ||
        p.codigo.toLowerCase().includes(texto);
      const coincideRubro =
        rubroIds.length === 0 || p.rubros.some((r) => rubroIds.includes(r.id));
      return coincideTexto && coincideRubro;
    });
  }, [proveedores, busqueda, rubroIds]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Input
              placeholder="Buscar proveedor o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-56"
            />
          </div>
          <RubroFiltroMultiple
            id="filtroRubroProveedores"
            rubros={rubros}
            value={rubroIds}
            onChange={setRubroIds}
          />
        </div>
        {nuevoProveedor}
      </div>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedoresFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No hay proveedores que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {proveedoresFiltrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/proveedores/${p.id}`} className="hover:underline">
                    {p.nombre}
                  </Link>
                </TableCell>
                <TableCell>{p.contacto ?? "—"}</TableCell>
                <TableCell>{p.telefono ?? "—"}</TableCell>
                <TableCell>{p.email ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/proveedores/${p.id}`} />}
                      nativeButton={false}
                    >
                      Ver
                    </Button>
                    <ProveedorDialog
                      proveedor={p}
                      rubros={rubros}
                      trigger={
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar proveedor">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
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
