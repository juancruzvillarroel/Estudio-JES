"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}: {
  proveedores: Proveedor[];
  rubros: Rubro[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rubroId, setRubroId] = useState("todos");

  const proveedoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return proveedores.filter((p) => {
      const coincideTexto = !texto || p.nombre.toLowerCase().includes(texto);
      const coincideRubro = rubroId === "todos" || p.rubros.some((r) => r.id === rubroId);
      return coincideTexto && coincideRubro;
    });
  }, [proveedores, busqueda, rubroId]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Input
              placeholder="Buscar proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Select
              value={rubroId}
              onValueChange={(value) => setRubroId(value as string)}
              items={{ todos: "Todos los rubros", ...Object.fromEntries(rubros.map((r) => [r.id, r.nombre])) }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los rubros</SelectItem>
                {rubros.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Nombre</TableHead>
              <TableHead className="w-[14%]">Contacto</TableHead>
              <TableHead className="w-[18%]">Teléfono</TableHead>
              <TableHead className="w-[34%]">Email</TableHead>
              <TableHead className="w-[16%] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedoresFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No hay proveedores que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {proveedoresFiltrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-normal break-words font-medium">
                  <Link href={`/proveedores/${p.id}`} className="hover:underline">
                    {p.nombre}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-normal break-words">{p.contacto ?? "—"}</TableCell>
                <TableCell className="whitespace-normal break-words">{p.telefono ?? "—"}</TableCell>
                <TableCell className="whitespace-normal break-words">{p.email ?? "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
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
