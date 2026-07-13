import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProveedorDialog } from "@/components/proveedores/proveedor-dialog";
import { ProveedoresLista } from "@/components/proveedores/proveedores-lista";
import { RubroDialog } from "@/components/rubros/rubro-dialog";
import { MaterialDialog } from "@/components/materiales/material-dialog";
import { MaterialesLista } from "@/components/materiales/materiales-lista";

export default async function ProveedoresPage() {
  const [proveedores, rubros, materiales] = await Promise.all([
    prisma.proveedor.findMany({
      orderBy: { nombre: "asc" },
      include: { rubros: true },
    }),
    prisma.rubro.findMany({
      orderBy: { orden: "asc" },
      include: { _count: { select: { proveedores: true } } },
    }),
    prisma.material.findMany({ orderBy: { nombre: "asc" }, include: { rubro: true } }),
  ]);

  const materialesPlanos = materiales.map((m) => ({
    ...m,
    pesoPorBarra: m.pesoPorBarra ? Number(m.pesoPorBarra) : null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proveedores y materiales</h1>
          <p className="text-sm text-muted-foreground">
            Contactos y cuenta corriente de materiales por proveedor.
          </p>
        </div>
      </div>

      <Tabs defaultValue="proveedores" className="mt-6">
        <TabsList>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="rubros">Rubros</TabsTrigger>
          <TabsTrigger value="materiales">Materiales</TabsTrigger>
        </TabsList>

        <TabsContent value="proveedores" className="mt-4">
          <div className="flex justify-end">
            <ProveedorDialog
              rubros={rubros}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo proveedor
                </Button>
              }
            />
          </div>
          <div className="mt-4">
            <ProveedoresLista proveedores={proveedores} rubros={rubros} />
          </div>
        </TabsContent>

        <TabsContent value="rubros" className="mt-4">
          <div className="flex justify-end">
            <RubroDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo rubro
                </Button>
              }
            />
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
                {rubros.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Todavía no hay rubros cargados.
                    </TableCell>
                  </TableRow>
                )}
                {rubros.map((r) => (
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
        </TabsContent>

        <TabsContent value="materiales" className="mt-4">
          <div className="flex justify-end">
            <MaterialDialog
              rubros={rubros}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo material
                </Button>
              }
            />
          </div>
          <div className="mt-4">
            <MaterialesLista materiales={materialesPlanos} rubros={rubros} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
