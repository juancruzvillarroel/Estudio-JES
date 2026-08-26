"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  crearCategoriaDocumento,
  crearTipoDocumento,
  eliminarCategoriaDocumento,
  eliminarTipoDocumento,
} from "@/actions/documentos";
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
  parentId: string | null;
};

type Documento = {
  tipoId: string;
  estado: "PENDIENTE" | "PRESENTADO";
  notas: string | null;
  archivoNombre: string | null;
  archivoUrl: string | null;
};

/**
 * Cuántos documentos hay y cuántos están presentados, contando solo las
 * hojas del árbol.
 *
 * Un item que agrupa subitems no es un documento en sí: no se presenta, se
 * completa cuando se completan los de adentro. Si se contara también el
 * grupo, la barra nunca llegaría al final aunque estuviera todo entregado.
 */
function progreso(
  nodos: Tipo[],
  hijosDe: (id: string) => Tipo[],
  presentado: (id: string) => boolean
): { total: number; presentados: number } {
  let total = 0;
  let presentados = 0;
  for (const nodo of nodos) {
    const hijos = hijosDe(nodo.id);
    if (hijos.length > 0) {
      const dentro = progreso(hijos, hijosDe, presentado);
      total += dentro.total;
      presentados += dentro.presentados;
    } else {
      total += 1;
      if (presentado(nodo.id)) presentados += 1;
    }
  }
  return { total, presentados };
}

function AgregarDocumentoTile({
  proyectoId,
  categoriaId,
  subSeccion,
  parentId,
}: {
  proyectoId: string;
  categoriaId: string;
  subSeccion?: string | null;
  parentId?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [conSubitems, setConSubitems] = useState(false);
  const [grupoNombre, setGrupoNombre] = useState("");
  const [pending, startTransition] = useTransition();

  // Se puede armar un grupo desde el primer nivel de la categoría (donde el
  // grupo es una subsección) y desde adentro de una subsección (donde el
  // grupo es un documento que agrupa a otros). Adentro de un grupo ya no:
  // ahí sólo se agregan subitems sueltos, que es donde corta el anidado.
  const permiteGrupo = parentId === undefined;
  // En el primer nivel el grupo se guarda como subsección; más adentro, como
  // un tipo padre del que cuelgan los subitems.
  const grupoEsSubSeccion = subSeccion === undefined;

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
      if (conSubitems && grupoEsSubSeccion) {
        await crearTipoDocumento(
          proyectoId,
          categoriaId,
          nombre,
          descripcion || undefined,
          grupoNombre
        );
      } else if (conSubitems) {
        // Dos pasos: primero el padre, y recién con su id se puede colgar el
        // primer subitem.
        const padre = await crearTipoDocumento(
          proyectoId,
          categoriaId,
          grupoNombre,
          undefined,
          subSeccion ?? null
        );
        if (padre) {
          await crearTipoDocumento(
            proyectoId,
            categoriaId,
            nombre,
            descripcion || undefined,
            subSeccion ?? null,
            padre.id
          );
        }
      } else {
        await crearTipoDocumento(
          proyectoId,
          categoriaId,
          nombre,
          descripcion || undefined,
          subSeccion ?? null,
          parentId ?? null
        );
      }
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
        {parentId ? "Agregar subitem" : "Agregar documento"}
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
        placeholder={
          conSubitems
            ? "Nombre del primer subitem"
            : parentId
              ? "Nombre del subitem"
              : "Nombre del documento"
        }
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

/**
 * Un documento del listado. Si tiene subitems colgando se dibuja como un
 * acordeón con los subitems adentro; si no, como la tarjeta de siempre con
 * su tilde de presentado.
 */
function NodoDocumento({
  proyectoId,
  categoriaId,
  tipo,
  hijosDe,
  documentosPorTipo,
}: {
  proyectoId: string;
  categoriaId: string;
  tipo: Tipo;
  hijosDe: (id: string) => Tipo[];
  documentosPorTipo: Map<string, Documento>;
}) {
  const hijos = hijosDe(tipo.id);

  if (hijos.length === 0) {
    return (
      <DocumentoItemCard
        proyectoId={proyectoId}
        tipoId={tipo.id}
        nombre={tipo.nombre}
        descripcion={tipo.descripcion}
        estado={documentosPorTipo.get(tipo.id)?.estado ?? "PENDIENTE"}
      />
    );
  }

  const { total, presentados } = progreso(
    hijos,
    hijosDe,
    (id) => documentosPorTipo.get(id)?.estado === "PRESENTADO"
  );

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center gap-2 pr-2">
        <AccordionItem value={tipo.id} className="flex-1 border-0">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium">
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex w-full items-center justify-between gap-2">
                <span>{tipo.nombre}</span>
                <span className="text-muted-foreground">
                  {presentados}/{total}
                </span>
              </div>
              <ProgresoBar total={total} presentados={presentados} />
            </div>
          </AccordionTrigger>
          <AccordionPanel className="px-3">
            <div className="flex flex-col gap-2 pb-1">
              {hijos.map((hijo) => (
                <NodoDocumento
                  key={hijo.id}
                  proyectoId={proyectoId}
                  categoriaId={categoriaId}
                  tipo={hijo}
                  hijosDe={hijosDe}
                  documentosPorTipo={documentosPorTipo}
                />
              ))}
              <AgregarDocumentoTile
                proyectoId={proyectoId}
                categoriaId={categoriaId}
                subSeccion={tipo.subSeccion}
                parentId={tipo.id}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>
        <DeleteButton
          iconOnly
          action={() => eliminarTipoDocumento(proyectoId, tipo.id)}
          confirmMessage={`¿Eliminar "${tipo.nombre}" y sus ${hijos.length} subitem${hijos.length === 1 ? "" : "s"} del listado?`}
        />
      </div>
    </div>
  );
}

/** Los documentos de un nivel, cada uno hoja o grupo, dentro de un acordeón. */
function ListaNodos({
  proyectoId,
  categoriaId,
  nodos,
  hijosDe,
  documentosPorTipo,
}: {
  proyectoId: string;
  categoriaId: string;
  nodos: Tipo[];
  hijosDe: (id: string) => Tipo[];
  documentosPorTipo: Map<string, Documento>;
}) {
  return (
    <Accordion multiple className="flex flex-col gap-2">
      {nodos.map((tipo) => (
        <NodoDocumento
          key={tipo.id}
          proyectoId={proyectoId}
          categoriaId={categoriaId}
          tipo={tipo}
          hijosDe={hijosDe}
          documentosPorTipo={documentosPorTipo}
        />
      ))}
    </Accordion>
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
  const presentado = (id: string) => documentosPorTipo.get(id)?.estado === "PRESENTADO";

  // Los subitems vienen mezclados con el resto en la misma lista plana, así
  // que se agrupan una vez por padre y después cada nivel se sirve de acá.
  const hijosPorPadre = new Map<string, Tipo[]>();
  for (const tipo of tipos) {
    if (!tipo.parentId) continue;
    const actuales = hijosPorPadre.get(tipo.parentId);
    if (actuales) actuales.push(tipo);
    else hijosPorPadre.set(tipo.parentId, [tipo]);
  }
  const hijosDe = (id: string) => hijosPorPadre.get(id) ?? [];

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
            // El conteo va sobre las raíces: progreso() baja solo a los hijos
            // y cuenta cada documento una vez.
            const raices = tiposCategoria.filter((t) => !t.parentId);
            const { total, presentados } = progreso(raices, hijosDe, presentado);
            const subSecciones = Array.from(
              new Set(raices.filter((t) => t.subSeccion).map((t) => t.subSeccion!))
            );
            const tiposSinSubSeccion = raices.filter((t) => !t.subSeccion);

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
                              const nodosSub = raices.filter((t) => t.subSeccion === sub);
                              const subProgreso = progreso(nodosSub, hijosDe, presentado);

                              return (
                                <div key={sub} className="rounded-md border bg-muted/20">
                                  <AccordionItem value={sub} className="border-0">
                                    <AccordionTrigger className="px-3 py-2 text-xs font-medium">
                                      <div className="flex w-full flex-col gap-1.5">
                                        <div className="flex w-full items-center justify-between gap-2">
                                          <span>{sub}</span>
                                          <span className="text-muted-foreground">
                                            {subProgreso.presentados}/{subProgreso.total}
                                          </span>
                                        </div>
                                        <ProgresoBar
                                          total={subProgreso.total}
                                          presentados={subProgreso.presentados}
                                        />
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionPanel className="px-3">
                                      <div className="flex flex-col gap-2">
                                        <ListaNodos
                                          proyectoId={proyectoId}
                                          categoriaId={categoria.id}
                                          nodos={nodosSub}
                                          hijosDe={hijosDe}
                                          documentosPorTipo={documentosPorTipo}
                                        />
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
                        <ListaNodos
                          proyectoId={proyectoId}
                          categoriaId={categoria.id}
                          nodos={tiposSinSubSeccion}
                          hijosDe={hijosDe}
                          documentosPorTipo={documentosPorTipo}
                        />
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
