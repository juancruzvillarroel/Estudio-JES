import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MovimientoInventarioDialog } from "@/components/inventario/movimiento-dialog";
import { InventarioStockTabla } from "@/components/inventario/inventario-stock-tabla";
import { InventarioMovimientosLista } from "@/components/inventario/inventario-movimientos-lista";

export default async function InventarioPage() {
  const [materiales, rubros, movimientos] = await Promise.all([
    prisma.material.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: { rubro: true },
    }),
    prisma.rubro.findMany({ orderBy: { orden: "asc" } }),
    prisma.inventarioMovimiento.findMany({
      orderBy: { fecha: "desc" },
      include: { material: true },
    }),
  ]);

  const stockPorMaterial = new Map<string, number>();
  for (const mov of movimientos) {
    const delta = mov.tipo === "ENTRADA" ? Number(mov.cantidad) : -Number(mov.cantidad);
    stockPorMaterial.set(mov.materialId, (stockPorMaterial.get(mov.materialId) ?? 0) + delta);
  }

  const stock = materiales
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidad,
      rubroId: m.rubroId,
      rubroNombre: m.rubro?.nombre ?? null,
      stock: stockPorMaterial.get(m.id) ?? 0,
    }))
    .filter((m) => m.stock > 0);

  const materialesOpciones = materiales.map((m) => ({ id: m.id, nombre: m.nombre, unidad: m.unidad }));

  const movimientosRows = movimientos.map((mov) => ({
    id: mov.id,
    materialNombre: mov.material.nombre,
    unidad: mov.material.unidad,
    tipo: mov.tipo,
    cantidad: Number(mov.cantidad),
    fecha: mov.fecha.toISOString(),
    notas: mov.notas,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Stock de materiales almacenados en el estudio.
          </p>
        </div>
        <MovimientoInventarioDialog
          materiales={materialesOpciones}
          rubros={rubros}
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo movimiento
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="movimientos" className="mt-6">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="mt-4">
          <InventarioMovimientosLista movimientos={movimientosRows} />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <InventarioStockTabla stock={stock} rubros={rubros.map((r) => ({ id: r.id, nombre: r.nombre }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
