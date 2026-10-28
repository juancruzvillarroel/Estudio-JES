"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import {
  abrirInformeRubro,
  UNIDADES_HIERRO,
  type FilaInforme,
  type SeccionInforme,
  type UnidadHierro,
} from "@/components/computos/informe-rubro";
import {
  claveFilaKey,
  esHierro,
  fechaDeComputo,
  ordenarFilas,
  simboloUnidad,
  tieneMedidoEnFila,
  TIPOS_COMPUTO,
  TIPO_COMPUTO_LABEL,
  type ClaveFila,
  type FechaComputoOpcion,
  type FilaExtraOpcion,
  type ItemOpcion,
  type SeccionOpcion,
  type TipoComputo,
} from "@/lib/computos";
import { SIN_NIVEL, type NivelOpcion } from "@/lib/niveles";
import { cn } from "@/lib/utils";

/**
 * Una opción de la lista de filas del diálogo.
 *
 * Las filas de la obra (los niveles) y las propias de una sección se eligen en
 * la misma lista porque en la grilla son lo mismo: un renglón. Pero la clave
 * dice de cuál se trata, y las propias llevan al lado de qué sección son —dos
 * secciones pueden tener las dos una fila "SALA DE MÁQUINAS" y no son la misma—.
 */
type FilaOpcion = { clave: ClaveFila; nombre: string; deSeccion?: string };

/** Marca y desmarca un id dentro de un conjunto. */
function alternar(conjunto: Set<string>, id: string) {
  const next = new Set(conjunto);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Cómo se lee cada lectura del hierro en la lista de opciones del diálogo. */
const ETIQUETA_UNIDAD_HIERRO: Record<UnidadHierro, string> = {
  ml: "Metros (lo medido)",
  barras: "Cantidad de barras",
  kg: "Kilogramos",
};

/**
 * Un renglón de checkbox con su etiqueta, clickeable entero.
 *
 * La etiqueta es parte del área de click y no sólo texto al lado: en una lista
 * de quince niveles, obligar a acertarle al cuadradito de cuatro milímetros es
 * lo que hace que elegir qué imprimir se sienta trabajoso.
 */
function Opcion({
  marcado,
  onCambio,
  children,
  detalle,
}: {
  marcado: boolean;
  onCambio: () => void;
  children: React.ReactNode;
  detalle?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-muted">
      <Checkbox checked={marcado} onCheckedChange={onCambio} />
      <span className="min-w-0 flex-1 truncate text-sm">{children}</span>
      {detalle && (
        <span className="shrink-0 text-xs text-muted-foreground">{detalle}</span>
      )}
    </label>
  );
}

/** El encabezado de una lista, con el "todas / ninguna" al costado. */
function Grupo({
  titulo,
  cuantas,
  total,
  onTodas,
  children,
}: {
  titulo: string;
  cuantas: number;
  total: number;
  onTodas: (marcar: boolean) => void;
  children: React.ReactNode;
}) {
  const todas = cuantas === total;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {titulo}
        </p>
        <button
          type="button"
          onClick={() => onTodas(!todas)}
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {todas ? "Ninguna" : "Todas"}
        </button>
      </div>
      <div className="flex flex-col rounded-md border p-1">{children}</div>
    </div>
  );
}

/**
 * Elegir qué parte del cómputo de un rubro se baja en PDF.
 *
 * Arranca todo marcado: el pedido normal es "el rubro entero", y hacer que el
 * botón sirva de una sola vez para ese caso es más importante que dejar la
 * elección a medio hacer. Lo que se destilda es la excepción —mandarle al
 * contratista sólo las dos secciones que va a hacer él, o sólo las plantas que
 * faltan—, y para eso están las listas.
 *
 * Las filas vacías no se ofrecen: si en toda esta grilla no hay nada cargado en
 * la azotea, imprimirla es una fila de rayas. Se puede volver a incluir marcando
 * "Incluir niveles sin nada cargado", que es lo que sirve cuando el papel es
 * para ir a medir y no para mandar a cotizar.
 */
export function InformeRubroDialog({
  proyectoNombre,
  rubroId,
  rubroNombre,
  niveles,
  secciones,
  filasExtra,
  items,
  totales,
  fechas,
}: {
  proyectoNombre: string;
  rubroId: string;
  rubroNombre: string;
  niveles: NivelOpcion[];
  /** Las secciones de ESTE rubro, de los dos lados. */
  secciones: SeccionOpcion[];
  /** Las filas propias de esas secciones. */
  filasExtra: FilaExtraOpcion[];
  /** Los ítems de ESTE rubro. */
  items: ItemOpcion[];
  /** Los totales de toda la obra, para resolver las filas derivadas. */
  totales: Map<string, number>;
  /** Cuándo se tocó por última vez cada lado de este rubro. */
  fechas: FechaComputoOpcion[];
}) {
  const [open, setOpen] = useState(false);

  const [lados, setLados] = useState<Set<TipoComputo>>(new Set(TIPOS_COMPUTO));
  const [seccionesElegidas, setSeccionesElegidas] = useState<Set<string>>(
    new Set(secciones.map((s) => s.id))
  );
  const [conDesperdicio, setConDesperdicio] = useState(true);
  const [conDetalle, setConDetalle] = useState(true);
  const [conVacias, setConVacias] = useState(false);
  const [unidadesHierro, setUnidadesHierro] = useState<Set<UnidadHierro>>(
    new Set(UNIDADES_HIERRO)
  );

  /** Las secciones que se pueden elegir: las del lado o lados marcados. */
  const delLado = secciones
    .filter((s) => lados.has(s.tipo))
    .sort((a, b) => a.orden - b.orden);

  const itemsDe = (seccionId: string) =>
    items.filter((i) => i.seccionId === seccionId).sort((a, b) => a.orden - b.orden);

  /**
   * Las filas que se pueden elegir: los niveles de la obra, las filas propias de
   * las secciones marcadas y "Toda la obra" si algo cae ahí.
   *
   * Se arma sobre las secciones YA elegidas y no sobre todas: destildar una
   * sección tiene que sacar de la lista sus filas propias, que no existen en
   * ninguna otra parte.
   */
  const activas = delLado.filter((s) => seccionesElegidas.has(s.id));

  /**
   * Los ítems que se pueden elegir: las columnas de las secciones marcadas.
   *
   * Se sincronizan igual que las filas y por la misma razón: la lista cambia
   * cuando se marca o desmarca una sección, y una elección hecha sobre otra
   * lista dejaría afuera, sin avisar, las columnas de la sección recién sumada.
   */
  const itemsDisponibles = activas.flatMap((s) => itemsDe(s.id));
  const huellaItems = itemsDisponibles.map((i) => i.id).join("|");
  const [itemsElegidos, setItemsElegidos] = useState<Set<string>>(
    new Set(itemsDisponibles.map((i) => i.id))
  );
  const [prevItems, setPrevItems] = useState(huellaItems);

  if (huellaItems !== prevItems) {
    setPrevItems(huellaItems);
    setItemsElegidos(new Set(itemsDisponibles.map((i) => i.id)));
  }

  /**
   * De acá para abajo, "los ítems" son sólo los elegidos.
   *
   * Importa que sea así y no sólo a la hora de imprimir: si se baja únicamente
   * la columna de las columnas, una planta donde lo único cargado son las vigas
   * queda vacía de verdad, y tiene que desaparecer de la lista de niveles como
   * cualquier otra fila vacía. Filtrar recién al final imprimiría esa planta
   * como una fila de rayas.
   */
  const itemsActivos = itemsDisponibles.filter((i) => itemsElegidos.has(i.id));
  const hayGeneral = itemsActivos.some((i) =>
    i.mediciones.some((m) => m.nivelId === null && m.filaExtraId === null)
  );
  /** Si hay hierro entre lo elegido, el diálogo ofrece elegir sus columnas. */
  const hayHierro = itemsActivos.some((i) => esHierro(i));

  const opcionesFila: FilaOpcion[] = [
    ...niveles.map((n) => ({
      clave: { tipo: "nivel" as const, id: n.id },
      nombre: n.nombre,
    })),
    ...activas.flatMap((s) =>
      filasExtra
        .filter((f) => f.seccionId === s.id)
        .sort((a, b) => a.orden - b.orden)
        .map((f) => ({
          clave: { tipo: "extra" as const, id: f.id },
          nombre: f.nombre,
          deSeccion: s.nombre,
        }))
    ),
    ...(hayGeneral
      ? [{ clave: { tipo: "general" as const }, nombre: SIN_NIVEL }]
      : []),
  ];

  /** ¿Hay algo cargado en esta fila, en alguna de las columnas que van a ir? */
  const filaTieneAlgo = (clave: ClaveFila) =>
    itemsActivos.some((i) => tieneMedidoEnFila(i, clave));

  /**
   * La lista de filas depende de qué secciones estén marcadas, así que cambia
   * mientras el diálogo está abierto. Cuando cambia se vuelve a "todas": una
   * selección de filas hecha sobre otra lista no significa nada, y arrastrarla
   * dejaría afuera las filas de la sección recién sumada sin que se vea.
   *
   * La huella es la lista misma. Comparar el contenido y no la identidad del
   * array es lo que hace que un re-render cualquiera no pise lo que se destildó.
   */
  const clavesDisponibles = opcionesFila.map((o) => claveFilaKey(o.clave));
  const huella = clavesDisponibles.join("|");
  const [filasElegidas, setFilasElegidas] = useState<Set<string>>(
    new Set(clavesDisponibles)
  );
  const [prevHuella, setPrevHuella] = useState(huella);

  if (huella !== prevHuella) {
    setPrevHuella(huella);
    setFilasElegidas(new Set(clavesDisponibles));
  }

  const abrir = (abierto: boolean) => {
    setOpen(abierto);
    if (!abierto) return;
    // Al reabrir se vuelve a "todo", que es el pedido normal. Un diálogo que
    // recuerda lo que se destildó la vez pasada hace imprimir de menos sin que
    // se note.
    const lados0 = new Set(TIPOS_COMPUTO);
    setLados(lados0);
    setSeccionesElegidas(
      new Set(secciones.filter((s) => lados0.has(s.tipo)).map((s) => s.id))
    );
    setConDesperdicio(true);
    setConDetalle(true);
    setConVacias(false);
    setUnidadesHierro(new Set(UNIDADES_HIERRO));
    // Fuerza el resincronizado de los ítems y las filas en el render siguiente,
    // que es cuando ya se sabe qué secciones quedaron marcadas.
    setPrevItems("");
    setPrevHuella("");
  };

  const marcada = (clave: ClaveFila) => filasElegidas.has(claveFilaKey(clave));

  const armarSecciones = (): SeccionInforme[] =>
    activas.map((seccion) => {
      const propias = filasExtra
        .filter((f) => f.seccionId === seccion.id)
        .sort((a, b) => a.orden - b.orden);
      const itemsSeccion = itemsDe(seccion.id).filter((i) => itemsElegidos.has(i.id));
      const hayGeneralAca = itemsSeccion.some((i) =>
        i.mediciones.some((m) => m.nivelId === null && m.filaExtraId === null)
      );

      const todas: FilaInforme[] = [
        ...niveles.map((n) => ({
          clave: { tipo: "nivel" as const, id: n.id },
          nombre: n.nombre,
        })),
        ...propias.map((f) => ({
          clave: { tipo: "extra" as const, id: f.id },
          nombre: f.nombre,
        })),
        ...(hayGeneralAca
          ? [{ clave: { tipo: "general" as const }, nombre: SIN_NIVEL }]
          : []),
      ];

      const filas = ordenarFilas(todas, seccion.ordenFilas).filter(
        (f) =>
          marcada(f.clave) &&
          (conVacias || itemsSeccion.some((i) => tieneMedidoEnFila(i, f.clave)))
      );

      return {
        seccion,
        filas,
        items: itemsSeccion,
        modificadoEl: fechaDeComputo(fechas, rubroId, seccion.tipo),
      };
    });

  const listo = armarSecciones();
  const imprimibles = listo.filter((s) => s.items.length > 0 && s.filas.length > 0);

  const descargar = () => {
    abrirInformeRubro({
      proyectoNombre,
      rubroNombre,
      totales,
      // Las que no tienen ítems o quedaron sin filas no se mandan: imprimirían
      // un título de sección con una tabla vacía debajo. Es lo mismo que cuenta
      // el resumen de abajo, así que lo que dice el diálogo es lo que sale.
      secciones: imprimibles,
      conDesperdicio,
      conDetalle,
      unidadesHierro: {
        ml: unidadesHierro.has("ml"),
        barras: unidadesHierro.has("barras"),
        kg: unidadesHierro.has("kg"),
      },
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <Tooltip content={`Descargar el cómputo de ${rubroNombre}`}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Descargar el cómputo de ${rubroNombre}`}
            />
          }
        >
          <FileDown className="h-4 w-4" />
        </DialogTrigger>
      </Tooltip>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Descargar {rubroNombre}</DialogTitle>
          <DialogDescription>
            Se abre en una pestaña nueva con el diálogo de impresión; desde ahí se
            guarda como PDF. Sale apaisado, que es como entra una grilla.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Grupo
            titulo="Materiales o mano de obra"
            cuantas={lados.size}
            total={TIPOS_COMPUTO.length}
            onTodas={(marcar) => {
              const next = marcar ? new Set(TIPOS_COMPUTO) : new Set<TipoComputo>();
              setLados(next);
              setSeccionesElegidas(
                new Set(secciones.filter((s) => next.has(s.tipo)).map((s) => s.id))
              );
            }}
          >
            {TIPOS_COMPUTO.map((tipo) => {
              const cuantas = secciones.filter((s) => s.tipo === tipo).length;
              return (
                <Opcion
                  key={tipo}
                  marcado={lados.has(tipo)}
                  detalle={
                    cuantas === 0
                      ? "sin secciones"
                      : `${cuantas} ${cuantas === 1 ? "sección" : "secciones"}`
                  }
                  onCambio={() => {
                    const next = alternar(lados as Set<string>, tipo) as Set<TipoComputo>;
                    setLados(next);
                    // Al sumar o sacar un lado entran o salen sus secciones:
                    // dejarlas marcadas escondería secciones que ya no se ven.
                    setSeccionesElegidas(
                      new Set(secciones.filter((s) => next.has(s.tipo)).map((s) => s.id))
                    );
                  }}
                >
                  {TIPO_COMPUTO_LABEL[tipo]}
                </Opcion>
              );
            })}
          </Grupo>

          {delLado.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este rubro no tiene secciones del lado que elegiste.
            </p>
          ) : (
            <Grupo
              titulo="Secciones"
              cuantas={seccionesElegidas.size}
              total={delLado.length}
              onTodas={(marcar) =>
                setSeccionesElegidas(marcar ? new Set(delLado.map((s) => s.id)) : new Set())
              }
            >
              {delLado.map((seccion) => {
                const cuantos = itemsDe(seccion.id).length;
                return (
                  <Opcion
                    key={seccion.id}
                    marcado={seccionesElegidas.has(seccion.id)}
                    detalle={
                      cuantos === 0
                        ? "vacía"
                        : `${cuantos} ${cuantos === 1 ? "ítem" : "ítems"}`
                    }
                    onCambio={() =>
                      setSeccionesElegidas((prev) => alternar(prev, seccion.id))
                    }
                  >
                    {seccion.nombre}
                  </Opcion>
                );
              })}
            </Grupo>
          )}

          {itemsDisponibles.length > 0 && (
            <Grupo
              titulo="Ítems"
              cuantas={itemsElegidos.size}
              total={itemsDisponibles.length}
              onTodas={(marcar) =>
                setItemsElegidos(
                  marcar ? new Set(itemsDisponibles.map((i) => i.id)) : new Set()
                )
              }
            >
              {itemsDisponibles.map((item) => (
                <Opcion
                  key={item.id}
                  marcado={itemsElegidos.has(item.id)}
                  // Con una sola sección a la vista, de qué sección es no aporta
                  // nada y la unidad sí. Con varias, dos secciones pueden tener
                  // las dos un ítem "Hormigón" y hay que poder distinguirlos.
                  detalle={
                    activas.length > 1
                      ? activas.find((s) => s.id === item.seccionId)?.nombre
                      : simboloUnidad(item.unidad)
                  }
                  onCambio={() => setItemsElegidos((prev) => alternar(prev, item.id))}
                >
                  {item.nombre}
                </Opcion>
              ))}
            </Grupo>
          )}

          {hayHierro && (
            <Grupo
              titulo="Unidades del hierro"
              cuantas={unidadesHierro.size}
              total={UNIDADES_HIERRO.length}
              onTodas={(marcar) =>
                setUnidadesHierro(marcar ? new Set(UNIDADES_HIERRO) : new Set())
              }
            >
              {UNIDADES_HIERRO.map((unidad) => (
                <Opcion
                  key={unidad}
                  marcado={unidadesHierro.has(unidad)}
                  onCambio={() =>
                    setUnidadesHierro(
                      (prev) =>
                        alternar(prev as Set<string>, unidad) as Set<UnidadHierro>
                    )
                  }
                >
                  {ETIQUETA_UNIDAD_HIERRO[unidad]}
                </Opcion>
              ))}
            </Grupo>
          )}

          {opcionesFila.length > 0 && (
            <Grupo
              titulo="Niveles"
              cuantas={filasElegidas.size}
              total={opcionesFila.length}
              onTodas={(marcar) =>
                setFilasElegidas(marcar ? new Set(clavesDisponibles) : new Set())
              }
            >
              {opcionesFila.map((opcion) => {
                const clave = claveFilaKey(opcion.clave);
                const vacia = !filaTieneAlgo(opcion.clave);
                return (
                  <Opcion
                    key={clave}
                    marcado={marcada(opcion.clave)}
                    detalle={
                      opcion.deSeccion ?? (vacia ? "sin cargar" : undefined)
                    }
                    onCambio={() => setFilasElegidas((prev) => alternar(prev, clave))}
                  >
                    <span className={cn(vacia && "text-muted-foreground")}>
                      {opcion.nombre}
                    </span>
                  </Opcion>
                );
              })}
            </Grupo>
          )}

          <div className="flex flex-col rounded-md border p-1">
            <Opcion
              marcado={conDesperdicio}
              onCambio={() => setConDesperdicio((v) => !v)}
            >
              Incluir la columna del desperdicio
            </Opcion>
            <Opcion marcado={conDetalle} onCambio={() => setConDetalle((v) => !v)}>
              Desglosar las celdas en filas (C1, C2, C3…)
            </Opcion>
            <Opcion marcado={conVacias} onCambio={() => setConVacias((v) => !v)}>
              Incluir niveles sin nada cargado
            </Opcion>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {imprimibles.length === 0
              ? "No queda nada para imprimir."
              : `${imprimibles.length} ${imprimibles.length === 1 ? "sección" : "secciones"} · ${imprimibles.reduce((a, s) => a + s.items.length, 0)} ítems · ${imprimibles.reduce((a, s) => a + s.filas.length, 0)} filas`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={imprimibles.length === 0}
              onClick={descargar}
            >
              <FileDown className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
