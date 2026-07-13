import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProveedorDialog } from "@/components/proveedores/proveedor-dialog";
import { ProveedoresLista } from "@/components/proveedores/proveedores-lista";
import { RubroDialog } from "@/components/rubros/rubro-dialog";
import { RubrosLista } from "@/components/rubros/rubros-lista";
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
          <ProveedoresLista
            proveedores={proveedores}
            rubros={rubros}
            nuevoProveedor={
              <ProveedorDialog
                rubros={rubros}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    Nuevo proveedor
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="rubros" className="mt-4">
          <RubrosLista
            rubros={rubros}
            nuevoRubro={
              <RubroDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    Nuevo rubro
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="materiales" className="mt-4">
          <MaterialesLista
            materiales={materialesPlanos}
            rubros={rubros}
            nuevoMaterial={
              <MaterialDialog
                rubros={rubros}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    Nuevo material
                  </Button>
                }
              />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
