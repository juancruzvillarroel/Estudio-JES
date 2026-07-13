"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcopioDialog } from "@/components/acopios/acopio-dialog";

type MaterialOpcion = { id: string; nombre: string; codigo?: string; unidad: string };
type ProyectoOpcion = { id: string; nombre: string };

export function NuevoAcopioBoton({
  proveedorId,
  proyectos,
  materiales,
}: {
  proveedorId: string;
  proyectos: ProyectoOpcion[];
  materiales: MaterialOpcion[];
}) {
  return (
    <AcopioDialog
      proyectos={proyectos}
      proveedorId={proveedorId}
      materiales={materiales}
      onCreated={() => {}}
      trigger={
        <Button type="button" className="bg-neutral-800 text-white hover:bg-neutral-800/80">
          <Plus className="h-4 w-4" />
          Nuevo acopio
        </Button>
      }
    />
  );
}
