"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "@/components/ui/delete-button";
import { crearCategoriaDocumento, crearTipoDocumento, eliminarCategoriaDocumento } from "@/actions/documentos";
import { DocumentoItemCard } from "./documento-item-card";

type Categoria = {
  id: string;
  nombre: string;
  orden: number;
  porPiso: boolean;
};

type Tipo = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  subSeccion: string | null;
};

type Documento = {
  tipoId: string;
  estado: "PENDIENTE" | "PRESENTADO";
  notas: string | null;
  archivoNombre: string | null;
  archivoUrl: string | null;
};

function AgregarDocumentoTile({
  proyectoId,
  categoriaId,
  subSeccion,
}: {
  proyectoId: string;
  categoriaId: string;
  subSeccion?: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [conSubitems, setConSubitems] = useState(false);
  const [grupoNombre, setGrupoNombre] = useState("");
  const [pending, startTransition] = useTransition();

  // Solo se puede crear un grupo nuevo (con subitems) desde el tile de
  // primer nivel de la categoría; dentro de un grupo ya creado, "subSeccion"
  // viene definido y ahí sólo se agregan subitems sueltos (sin anidar más).
  const permiteGrupo = subSeccion === undefined;

  const cerrar = () => {
    setAbierto(false);
    setNombre("");
    setDescripcion("");
    setConSubitems(false);
    setGrupoNombre("");
  };

  const handleGuardar = () => {
    if (!nombre.trim()) return;
    if (conSubitems && !grupoNombre.trim()) return;
    startTransition(async () => {
      await crearTipoDocumento(
        proyectoId,
        categoriaId,
        nombre,
        descripcion || undefined,
        conSubitems ? grupoNombre : subSeccion ?? null
      );
      cerrar();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar documento
      </button>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-2 rounded-md border p-3">
      {permiteGrupo && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={conSubitems} onCheckedChange={(checked) => setConSubitems(checked === true)} />
          Tiene subitems (agrupa varios documentos adentro)
        </label>
      )}
      {conSubitems && (
        <Input
          placeholder="Nombre del grupo"
          value={grupoNombre}
          onChange={(e) => setGrupoNombre(e.target.value)}
          autoFocus
        />
      )}
      <Input
        placeholder={conSubitems ? "Nombre del primer subitem" : "Nombre del documento"}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus={!conSubitems}
      />
      <Textarea
        placeholder="Descripción (opcional)"
        rows={2}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !nombre.trim() || (conSubitems && !grupoNombre.trim())}
          onClick={handleGuardar}
        >
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function AgregarCategoriaTile({ proyectoId }: { proyectoId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [porPiso, setPorPiso] = useState(false);
  const [pending, startTransition] = useTransition();

  const cerrar = () => {
    setAbierto(false);
    setNombre("");
    setPorPiso(false);
  };

  const handleGuardar = () => {
    if (!nombre.trim()) return;
    startTransition(async () => {
      await crearCategoriaDocumento(proyectoId, nombre, porPiso);
      cerrar();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Nueva categoría
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Nombre de la categoría"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
          className="w-auto flex-1"
        />
        <Button type="button" size="sm" disabled={pending || !nombre.trim()} onClick={handleGuardar}>
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cerrar}>
          Cancelar
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={porPiso} onCheckedChange={(checked) => setPorPiso(checked === true)} />
        Varía por piso (se genera un documento por cada piso del proyecto)
      </label>
    </div>
  );
}

function ProgresoBar({ total, presentados }: { total: number; presentados: number }) {
  if (total === 0) return null;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-success transition-[width] duration-300"
        style={{ width: `${(presentados / total) * 100}%` }}
      />
    </div>
  );
}

export function DocumentacionBoard({
  proyectoId,
  categorias,
  tipos,
  documentos,
}: {
  proyectoId: string;
  categorias: Categoria[];
  tipos: Tipo[];
  documentos: Documento[];
}) {
  const documentosPorTipo = new Map(documentos.map((d) => [d.tipoId, d]));

  return (
    <div className="flex flex-col gap-3">
      {categorias.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no hay categorías de documentos. Creá la primera abajo.
        </p>
      ) : (
        <Accordion multiple className="flex flex-col gap-3">
          {categorias.map((categoria) => {
            const tiposCategoria = tipos.filter((t) => t.categoriaId === categoria.id);
            const total = tiposCategoria.length;
            const presentados = tiposCategoria.filter(
              (tipo) => documentosPorTipo.get(tipo.id)?.estado === "PRESENTADO"
            ).length;
            const subSecciones = Array.from(
              new Set(tiposCategoria.filter((t) => t.subSeccion).map((t) => t.subSeccion!))
            );
            const tiposSinSubSeccion = tiposCategoria.filter((t) => !t.subSeccion);

            return (
              <div key={categoria.id} className="rounded-md border">
                <div className="flex items-center gap-2 pr-3">
                  <AccordionItem value={categoria.id} className="flex-1 border-0">
                    <AccordionTrigger className="w-full px-3 py-3 text-sm font-semibold">
                      <div className="flex w-full flex-col gap-1.5">
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            {categoria.nombre}
                            {categoria.porPiso && (
                              <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                                Por piso
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {presentados}/{total}
                          </span>
                        </div>
                        <ProgresoBar total={total} presentados={presentados} />
                      </div>
                    </AccordionTrigger>
                    <AccordionPanel className="px-3">
                      <div className="flex flex-col gap-2">
                        {subSecciones.length > 0 && (
                          <Accordion multiple className="flex flex-col gap-2">
                            {subSecciones.map((sub) => {
                              const tiposSub = tiposCategoria.filter((t) => t.subSeccion === sub);
                              const totalSub = tiposSub.length;
                              const presentadosSub = tiposSub.filter(
                                (tipo) => documentosPorTipo.get(tipo.id)?.estado === "PRESENTADO"
                              ).length;

                              return (
                                <div key={sub} className="rounded-md border bg-muted/20">
                                  <AccordionItem value={sub} className="border-0">
                                    <AccordionTrigger className="px-3 py-2 text-xs font-medium">
                                      <div className="flex w-full flex-col gap-1.5">
                                        <div className="flex w-full items-center justify-between gap-2">
                                          <span>{sub}</span>
                                          <span className="text-muted-foreground">
                                            {presentadosSub}/{totalSub}
                                          </span>
                                        </div>
                                        <ProgresoBar total={totalSub} presentados={presentadosSub} />
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionPanel className="px-3">
                                      <div className="flex flex-col gap-2">
                                        {tiposSub.map((tipo) => {
                                          const documento = documentosPorTipo.get(tipo.id);
                                          return (
                                            <DocumentoItemCard
                                              key={tipo.id}
                                              proyectoId={proyectoId}
                                              tipoId={tipo.id}
                                              nombre={tipo.nombre}
                                              descripcion={tipo.descripcion}
                                              estado={documento?.estado ?? "PENDIENTE"}
                                            />
                                          );
                                        })}
                                        <AgregarDocumentoTile
                                          proyectoId={proyectoId}
                                          categoriaId={categoria.id}
                                          subSeccion={sub}
                                        />
                                      </div>
                                    </AccordionPanel>
                                  </AccordionItem>
                                </div>
                              );
                            })}
                          </Accordion>
                        )}
                        {tiposSinSubSeccion.map((tipo) => {
                          const documento = documentosPorTipo.get(tipo.id);
                          return (
                            <DocumentoItemCard
                              key={tipo.id}
                              proyectoId={proyectoId}
                              tipoId={tipo.id}
                              nombre={tipo.nombre}
                              descripcion={tipo.descripcion}
                              estado={documento?.estado ?? "PENDIENTE"}
                            />
                          );
                        })}
                        <AgregarDocumentoTile proyectoId={proyectoId} categoriaId={categoria.id} />
                      </div>
                      {categoria.porPiso && tiposCategoria.length === 0 && (
                        <p className="pb-2 text-xs text-muted-foreground">
                          Se generan solos al guardar la cantidad de pisos del proyecto (botón
                          &quot;Editar datos&quot;), o podés agregarlos a mano arriba.
                        </p>
                      )}
                    </AccordionPanel>
                  </AccordionItem>
                  <DeleteButton
                    iconOnly
                    action={() => eliminarCategoriaDocumento(proyectoId, categoria.id)}
                    confirmMessage={`¿Eliminar la categoría "${categoria.nombre}" y todos sus documentos del listado?`}
                  />
                </div>
              </div>
            );
          })}
        </Accordion>
      )}

      <AgregarCategoriaTile proyectoId={proyectoId} />
    </div>
  );
}
