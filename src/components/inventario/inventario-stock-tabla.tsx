"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RubroFiltroMultiple, SIN_RUBRO } from "@/components/rubros/rubro-filtro-multiple";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StockMaterial = {
  id: string;
  nombre: string;
  unidad: string;
  rubroId: string | null;
  rubroNombre: string | null;
  stock: number;
};

type RubroOpcion = { id: string; nombre: string };

export function InventarioStockTabla({
  stock,
  rubros,
}: {
  stock: StockMaterial[];
  rubros: RubroOpcion[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rubroIds, setRubroIds] = useState<string[]>([]);

  const stockFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return stock.filter((m) => {
      const coincideTexto = !texto || m.nombre.toLowerCase().includes(texto);
      const rubroKey = m.rubroId ?? SIN_RUBRO;
      const coincideRubro = rubroIds.length === 0 || rubroIds.includes(rubroKey);
      return coincideTexto && coincideRubro;
    });
  }, [stock, busqueda, rubroIds]);

  const grupos = useMemo(() => {
    const ordenRubros = new Map(rubros.map((r, index) => [r.id, index]));
    const porRubro = new Map<string, { nombre: string; items: StockMaterial[] }>();

    for (const m of stockFiltrado) {
      const key = m.rubroId ?? SIN_RUBRO;
      if (!porRubro.has(key)) {
        porRubro.set(key, { nombre: m.rubroNombre ?? "Sin rubro", items: [] });
      }
      porRubro.get(key)!.items.push(m);
    }

    for (const grupo of porRubro.values()) {
      grupo.items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    return Array.from(porRubro.entries()).sort(([keyA], [keyB]) => {
      if (keyA === SIN_RUBRO) return 1;
      if (keyB === SIN_RUBRO) return -1;
      return (ordenRubros.get(keyA) ?? 0) - (ordenRubros.get(keyB) ?? 0);
    });
  }, [stockFiltrado, rubros]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar material..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-56"
        />
        <RubroFiltroMultiple
          id="filtroRubroStock"
          rubros={rubros}
          value={rubroIds}
          onChange={setRubroIds}
          incluirSinRubro
        />
      </div>

      <div className="mt-4 flex flex-col gap-6">
        {grupos.length === 0 && (
          <div className="rounded-md border py-6 text-center text-sm text-muted-foreground">
            {stock.length === 0
              ? "Todavía no tenés materiales en stock. Registrá un movimiento de entrada para empezar."
              : "No hay materiales que coincidan con la búsqueda."}
          </div>
        )}

        {grupos.map(([key, grupo]) => (
          <div key={key} className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={2}>{grupo.nombre}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nombre}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <Badge variant={m.stock <= 0 ? "outline" : "secondary"}>
                          {m.stock} {m.unidad}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
