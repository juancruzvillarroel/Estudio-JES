"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { MaterialDialog } from "@/components/materiales/material-dialog";
import { ToggleActivoButton } from "@/components/materiales/toggle-activo-button";

type Rubro = { id: string; nombre: string };
type Material = {
  id: string;
  nombre: string;
  unidad: string;
  activo: boolean;
  rubroId: string | null;
  rubro: Rubro | null;
  pesoPorBarra: number | null;
};

export function MaterialesLista({
  materiales,
  rubros,
}: {
  materiales: Material[];
  rubros: Rubro[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rubroId, setRubroId] = useState("todos");

  const materialesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return materiales.filter((m) => {
      const coincideTexto = !texto || m.nombre.toLowerCase().includes(texto);
      const coincideRubro = rubroId === "todos" || m.rubroId === rubroId;
      return coincideTexto && coincideRubro;
    });
  }, [materiales, busqueda, rubroId]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar material..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-56"
        />
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

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materialesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No hay materiales que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {materialesFiltrados.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nombre}</TableCell>
                <TableCell>{m.unidad}</TableCell>
                <TableCell>{m.rubro?.nombre ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={m.activo ? "secondary" : "outline"}>
                    {m.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <MaterialDialog
                    material={m}
                    rubros={rubros}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Editar
                      </Button>
                    }
                  />
                  <ToggleActivoButton id={m.id} activo={m.activo} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
