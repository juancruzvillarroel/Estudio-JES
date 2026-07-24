"use client";

import { useState, useTransition } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { crearTipoTramite } from "@/actions/municipal";
import { TramiteItemRow } from "./tramite-item-row";

type Vista = "grid" | "lista";

type Categoria = "ADMINISTRACION" | "DEMOLICION" | "OBRA";

type Tipo = {
  id: string;
  categoria: Categoria;
  etapa: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
};

type Tramite = {
  tipoId: string;
  estado: "PENDIENTE" | "PRESENTADO";
  notas: string | null;
  archivoNombre: string | null;
  archivoUrl: string | null;
};

const CATEGORIA_LABELS: Record<Categoria, string> = {
  ADMINISTRACION: "Administración",
  DEMOLICION: "Demolición",
  OBRA: "Obra",
};

const CATEGORIA_ORDEN: Categoria[] = ["ADMINISTRACION", "DEMOLICION", "OBRA"];

function AgregarDocumentoTile({
  proyectoId,
  categoria,
  etapa,
  vista,
}: {
  proyectoId: string;
  categoria: Categoria;
  etapa: string;
  vista: Vista;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pending, startTransition] = useTransition();

  const cerrar = () => {
    setAbierto(false);
    setNombre("");
    setDescripcion("");
  };

  const handleGuardar = () => {
    if (!nombre.trim()) return;
    startTransition(async () => {
      await crearTipoTramite(proyectoId, categoria, etapa, nombre, descripcion || undefined);
      cerrar();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted",
          vista === "grid" ? "min-h-[9rem] flex-col p-3" : "p-3"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar documento
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border p-3", vista === "lista" && "max-w-sm")}>
      <Input
        placeholder="Nombre del documento"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus
      />
      <Textarea
        placeholder="Descripción (opcional)"
        rows={2}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending || !nombre.trim()} onClick={handleGuardar}>
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export function MunicipalBoard({
  proyectoId,
  tipos,
  tramites,
}: {
  proyectoId: string;
  tipos: Tipo[];
  tramites: Tramite[];
}) {
  const [vista, setVista] = useState<Vista>("grid");
  const tramitesPorTipo = new Map(tramites.map((t) => [t.tipoId, t]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant={vista === "grid" ? "secondary" : "ghost"}
          onClick={() => setVista("grid")}
          aria-label="Ver en cuadrícula"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={vista === "lista" ? "secondary" : "ghost"}
          onClick={() => setVista("lista")}
          aria-label="Ver en lista"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      <Accordion multiple className="flex flex-col gap-3">
        {CATEGORIA_ORDEN.map((categoria) => {
          const tiposCategoria = tipos.filter((t) => t.categoria === categoria);
          const etapas = Array.from(new Set(tiposCategoria.map((t) => t.etapa)));

          return (
            <div key={categoria} className="rounded-md border">
              <AccordionItem value={categoria} className="border-0">
                <AccordionTrigger className="px-3 py-3 text-sm font-semibold">
                  {CATEGORIA_LABELS[categoria]}
                </AccordionTrigger>
                <AccordionPanel className="px-3">
                  {tiposCategoria.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Todavía no hay trámites cargados en esta categoría.
                    </p>
                  ) : (
                    <Accordion multiple className="flex flex-col gap-3">
                      {etapas.map((etapa) => {
                        const tiposEtapa = tiposCategoria.filter((t) => t.etapa === etapa);
                        const totalEtapa = tiposEtapa.length;
                        const presentadosEtapa = tiposEtapa.filter(
                          (tipo) => tramitesPorTipo.get(tipo.id)?.estado === "PRESENTADO"
                        ).length;

                        const tramitesEtapa = (
                          <div
                            className={cn(
                              vista === "grid" ? "grid grid-cols-3 gap-3" : "flex flex-col gap-2"
                            )}
                          >
                            {tiposEtapa.map((tipo) => {
                              const tramite = tramitesPorTipo.get(tipo.id);
                              return (
                                <TramiteItemRow
                                  key={tipo.id}
                                  proyectoId={proyectoId}
                                  tipoId={tipo.id}
                                  nombre={tipo.nombre}
                                  descripcion={tipo.descripcion}
                                  estado={tramite?.estado ?? "PENDIENTE"}
                                  notas={tramite?.notas ?? null}
                                  archivoNombre={tramite?.archivoNombre ?? null}
                                  archivoUrl={tramite?.archivoUrl ?? null}
                                  vista={vista}
                                />
                              );
                            })}
                            <AgregarDocumentoTile
                              proyectoId={proyectoId}
                              categoria={categoria}
                              etapa={etapa}
                              vista={vista}
                            />
                          </div>
                        );

                        if (!etapa) {
                          return <div key="sin-etapa">{tramitesEtapa}</div>;
                        }

                        return (
                          <div key={etapa} className="rounded-md border bg-muted/20">
                            <AccordionItem value={etapa} className="border-0">
                              <AccordionTrigger className="px-3 py-2 text-xs font-medium">
                                <div className="flex w-full flex-col gap-1.5">
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <span>{etapa}</span>
                                    <span className="text-muted-foreground">
                                      {presentadosEtapa}/{totalEtapa}
                                    </span>
                                  </div>
                                  {totalEtapa > 0 && (
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                      <div
                                        className="h-full rounded-full bg-success transition-[width] duration-300"
                                        style={{ width: `${(presentadosEtapa / totalEtapa) * 100}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionPanel className="px-3">{tramitesEtapa}</AccordionPanel>
                            </AccordionItem>
                          </div>
                        );
                      })}
                    </Accordion>
                  )}
                </AccordionPanel>
              </AccordionItem>
            </div>
          );
        })}
      </Accordion>
    </div>
  );
}
