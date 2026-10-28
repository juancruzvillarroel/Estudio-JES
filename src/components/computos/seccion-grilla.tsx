"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ItemSeccionDialog } from "@/components/computos/item-seccion-dialog";
import {
  agregarDetalle,
  borrarDetalle,
  crearFilaExtra,
  eliminarFilaExtra,
  eliminarSeccion,
  guardarCajon,
  guardarCelda,
  guardarDetalle,
  renombrarFilaExtra,
  renombrarSeccion,
  reordenarFilasSeccion,
} from "@/actions/computos";
import { eliminarNivel, renombrarNivel } from "@/actions/niveles-proyecto";
import {
  barrasDeMetros,
  bultosDe,
  cajonesEnFila,
  claveFilaKey,
  conDesperdicio,
  conversionDe,
  esDerivadaEnFila,
  esHierro,
  esSeccionPuertas,
  etiquetaBultos,
  formatCantidad,
  kgDeMetros,
  materialDe,
  medicionesDeFila,
  medidaATexto,
  medidoEnFila,
  metrosDeBarras,
  metrosDeKg,
  mostrarTotalPorFila,
  ordenarFilas,
  parcialMedicion,
  parseMedida,
  simboloUnidad,
  tieneBultos,
  tieneMedidoEnFila,
  totalCajones,
  totalPorFila,
  UNIDAD_INFO,
  type ClaveFila,
  type FilaExtraOpcion,
  type ItemOpcion,
  type MedicionOpcion,
  type SeccionOpcion,
} from "@/lib/computos";
import { SIN_NIVEL, type NivelOpcion } from "@/lib/niveles";
import { cn } from "@/lib/utils";

/** Una fila de la grilla, ya lista para dibujar. */
type Fila = { clave: ClaveFila; nombre: string };

/** Qué celda tiene el detalle abierto. Una sola a la vez en toda la grilla. */
type CeldaAbierta = { itemId: string; filaKey: string };

/**
 * Una celda: lo que se midió de un ítem en una fila.
 *
 * Se guarda al salir del campo y sólo si cambió, sin botón de guardar. Cargar
 * un cómputo es completar una planilla de treinta celdas seguidas: un click de
 * confirmación por celda lo vuelve una ceremonia.
 *
 * El número se muestra crudo y sin separador de miles porque es un campo que se
 * edita: "1.240" tipeado a mano es ambiguo (¿mil doscientos cuarenta o uno coma
 * dos?) y el que lee la cifra formateada la tiene al lado, en la columna del
 * desperdicio.
 *
 * Vacío borra la medida. No guarda un 0, que es otra cosa: un cero medido y una
 * planta sin computar se leen distinto ("0" contra "—") y significan distinto.
 */
function Celda({
  proyectoId,
  item,
  fila,
  filaNombre,
  valor,
  onSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  /** Lo medido, o null si esta celda todavía no tiene ninguna fila. */
  valor: number | null;
  onSaved: (item: ItemOpcion) => void;
}) {
  const inicial = valor === null ? "" : medidaATexto(valor);
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [prev, setPrev] = useState(valor);
  const [pending, startTransition] = useTransition();

  if (valor !== prev) {
    setPrev(valor);
    setTexto(inicial);
    setGuardado(inicial);
  }

  const guardar = () => {
    const limpio = texto.trim();
    if (limpio === guardado) return;

    const numero = limpio === "" ? null : parseMedida(limpio);
    if (limpio !== "" && numero === null) {
      toast.error("Escribí un número mayor a 0.");
      setTexto(guardado);
      return;
    }

    setGuardado(limpio);
    startTransition(async () => {
      const result = await guardarCelda(proyectoId, item.id, fila, numero);
      if (!result.success) {
        toast.error(result.error);
        setTexto(guardado);
        setGuardado(guardado);
        return;
      }
      onSaved(result.item);
    });
  };

  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setTexto(guardado);
          e.currentTarget.blur();
        }
      }}
      inputMode="decimal"
      placeholder="—"
      aria-label={`${item.nombre} en ${filaNombre}`}
      disabled={pending}
      className={cn(
        "w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums",
        "transition-colors duration-150",
        "hover:border-input focus:border-ring focus:bg-background focus:outline-none",
        "placeholder:text-muted-foreground"
      )}
    />
  );
}

/**
 * Una celda de cajón (C10 o C15), sólo en los ítems de la grilla de PUERTAS.
 *
 * Va aparte de la cantidad de puertas de la celda, aunque vive en la misma
 * fila de la base: se puede cargar un cajón antes de saber cuántas puertas
 * son, o cargar las puertas sin cajones contados todavía. Mismo
 * comportamiento que `Celda` —se guarda al salir del campo, vacío borra— pero
 * llama a `guardarCajon` en vez de `guardarCelda`.
 */
function CeldaCajon({
  proyectoId,
  item,
  fila,
  filaNombre,
  campo,
  etiqueta,
  valor,
  onSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  campo: "cajonC10" | "cajonC15";
  etiqueta: string;
  /** El cajón cargado, o null si esta celda todavía no tiene ninguno. */
  valor: number | null;
  onSaved: (item: ItemOpcion) => void;
}) {
  const inicial = valor === null ? "" : medidaATexto(valor);
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [prev, setPrev] = useState(valor);
  const [pending, startTransition] = useTransition();

  if (valor !== prev) {
    setPrev(valor);
    setTexto(inicial);
    setGuardado(inicial);
  }

  const guardar = () => {
    const limpio = texto.trim();
    if (limpio === guardado) return;

    const numero = limpio === "" ? null : parseMedida(limpio);
    if (limpio !== "" && numero === null) {
      toast.error("Escribí un número mayor a 0.");
      setTexto(guardado);
      return;
    }

    setGuardado(limpio);
    startTransition(async () => {
      const result = await guardarCajon(proyectoId, item.id, fila, campo, numero);
      if (!result.success) {
        toast.error(result.error);
        setTexto(guardado);
        setGuardado(guardado);
        return;
      }
      onSaved(result.item);
    });
  };

  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setTexto(guardado);
          e.currentTarget.blur();
        }
      }}
      inputMode="decimal"
      placeholder="—"
      title={`${item.nombre} en ${filaNombre}: cajones ${etiqueta}`}
      aria-label={`${item.nombre} en ${filaNombre}, cajones ${etiqueta}`}
      disabled={pending}
      className={cn(
        "w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums",
        "transition-colors duration-150",
        "hover:border-input focus:border-ring focus:bg-background focus:outline-none",
        "placeholder:text-muted-foreground"
      )}
    />
  );
}

/**
 * La celda de hierro: tres campos en paralelo para el mismo metraje, uno en
 * metros lineales (lo que se mide en obra), otro en barras y otro en kilos
 * (las dos formas en que se pide). Se puede completar cualquiera de los tres;
 * los otros dos se completan solos con la conversión del ítem. Lo que se
 * guarda siempre son los metros —es la única unidad que entiende
 * `guardarCelda`— así que cuando se tipea en barras o en kg se convierte
 * antes de mandarla.
 *
 * No hay focus-toggle como en `Celda`: los tres valores están siempre
 * visibles a la vez, que es justo lo que pidió reemplazar esta celda.
 */
function CeldaHierro({
  proyectoId,
  item,
  fila,
  filaNombre,
  valor,
  onSaved,
  abierto,
  onAbrir,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  /** Lo medido en metros, o null si esta celda todavía no tiene ninguna fila. */
  valor: number | null;
  onSaved: (item: ItemOpcion) => void;
  /** Si el detalle de esta celda está abierto, para la flechita de la columna de kg. */
  abierto: boolean;
  onAbrir: () => void;
}) {
  const metrosATexto = (m: number | null) => (m === null ? "" : medidaATexto(m));
  const barrasATexto = (m: number | null) =>
    m === null ? "" : formatCantidad(barrasDeMetros(item, m));
  const kgATexto = (m: number | null) => (m === null ? "" : formatCantidad(kgDeMetros(item, m)));

  const [textoMl, setTextoMl] = useState(metrosATexto(valor));
  const [textoBarras, setTextoBarras] = useState(barrasATexto(valor));
  const [textoKg, setTextoKg] = useState(kgATexto(valor));
  const [guardadoMl, setGuardadoMl] = useState(textoMl);
  const [guardadoBarras, setGuardadoBarras] = useState(textoBarras);
  const [guardadoKg, setGuardadoKg] = useState(textoKg);
  const [prev, setPrev] = useState(valor);
  const [pending, startTransition] = useTransition();

  if (valor !== prev) {
    setPrev(valor);
    setTextoMl(metrosATexto(valor));
    setTextoBarras(barrasATexto(valor));
    setTextoKg(kgATexto(valor));
    setGuardadoMl(metrosATexto(valor));
    setGuardadoBarras(barrasATexto(valor));
    setGuardadoKg(kgATexto(valor));
  }

  const guardar = (metros: number | null) => {
    startTransition(async () => {
      const result = await guardarCelda(proyectoId, item.id, fila, metros);
      if (!result.success) {
        toast.error(result.error);
        setTextoMl(guardadoMl);
        setTextoBarras(guardadoBarras);
        setTextoKg(guardadoKg);
        return;
      }
      onSaved(result.item);
    });
  };

  const porMl = () => {
    const limpio = textoMl.trim();
    if (limpio === guardadoMl) return;
    const numero = limpio === "" ? null : parseMedida(limpio);
    if (limpio !== "" && numero === null) {
      toast.error("Escribí un número mayor a 0.");
      setTextoMl(guardadoMl);
      return;
    }
    const nuevoTextoBarras = barrasATexto(numero);
    const nuevoTextoKg = kgATexto(numero);
    setGuardadoMl(limpio);
    setGuardadoBarras(nuevoTextoBarras);
    setTextoBarras(nuevoTextoBarras);
    setGuardadoKg(nuevoTextoKg);
    setTextoKg(nuevoTextoKg);
    guardar(numero);
  };

  const porBarras = () => {
    const limpio = textoBarras.trim();
    if (limpio === guardadoBarras) return;
    const barras = limpio === "" ? null : parseMedida(limpio);
    if (limpio !== "" && barras === null) {
      toast.error("Escribí un número mayor a 0.");
      setTextoBarras(guardadoBarras);
      return;
    }
    const metros = barras === null ? null : metrosDeBarras(item, barras);
    const nuevoTextoMl = metrosATexto(metros);
    const nuevoTextoKg = kgATexto(metros);
    setGuardadoBarras(limpio);
    setGuardadoMl(nuevoTextoMl);
    setTextoMl(nuevoTextoMl);
    setGuardadoKg(nuevoTextoKg);
    setTextoKg(nuevoTextoKg);
    guardar(metros);
  };

  const porKg = () => {
    const limpio = textoKg.trim();
    if (limpio === guardadoKg) return;
    const kg = limpio === "" ? null : parseMedida(limpio);
    if (limpio !== "" && kg === null) {
      toast.error("Escribí un número mayor a 0.");
      setTextoKg(guardadoKg);
      return;
    }
    const metros = kg === null ? null : metrosDeKg(item, kg);
    const nuevoTextoMl = metrosATexto(metros);
    const nuevoTextoBarras = barrasATexto(metros);
    setGuardadoKg(limpio);
    setGuardadoMl(nuevoTextoMl);
    setTextoMl(nuevoTextoMl);
    setGuardadoBarras(nuevoTextoBarras);
    setTextoBarras(nuevoTextoBarras);
    guardar(metros);
  };

  const inputClass = cn(
    "w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums",
    "transition-colors duration-150",
    "hover:border-input focus:border-ring focus:bg-background focus:outline-none",
    "placeholder:text-muted-foreground"
  );

  return (
    <Fragment>
      <td className="group/celda border-l px-1 py-0.5">
        <input
          value={textoMl}
          onChange={(e) => setTextoMl(e.target.value)}
          onBlur={porMl}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTextoMl(guardadoMl);
              e.currentTarget.blur();
            }
          }}
          inputMode="decimal"
          placeholder="—"
          title={`${item.nombre} en ${filaNombre}, en metros lineales`}
          aria-label={`${item.nombre} en ${filaNombre}, en metros lineales`}
          disabled={pending}
          className={inputClass}
        />
      </td>
      <td className="group/celda bg-foreground/[0.04] px-1 py-0.5">
        <input
          value={textoBarras}
          onChange={(e) => setTextoBarras(e.target.value)}
          onBlur={porBarras}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTextoBarras(guardadoBarras);
              e.currentTarget.blur();
            }
          }}
          inputMode="decimal"
          placeholder="—"
          title={`${item.nombre} en ${filaNombre}: cantidad de barras de 12 m, de ${formatCantidad(item.porBulto ?? 0)} kg cada una`}
          aria-label={`${item.nombre} en ${filaNombre}, en barras`}
          disabled={pending}
          className={inputClass}
        />
      </td>
      <td className="group/celda bg-foreground/[0.04] px-1 py-0.5">
        <span className="flex items-center gap-0.5">
          <input
            value={textoKg}
            onChange={(e) => setTextoKg(e.target.value)}
            onBlur={porKg}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setTextoKg(guardadoKg);
                e.currentTarget.blur();
              }
            }}
            inputMode="decimal"
            placeholder="—"
            title={`${item.nombre} en ${filaNombre}: peso total en kilos`}
            aria-label={`${item.nombre} en ${filaNombre}, en kilos`}
            disabled={pending}
            className={cn(inputClass, "min-w-0 flex-1")}
          />
          {/* La flechita para abrir el detalle (mismo lugar que en cualquier
              otro ítem) vive en esta columna y no en las de ml o barras: es
              la que queda al borde derecho de la celda del ítem. */}
          <Tooltip content={`Detalle de ${item.nombre} en ${filaNombre}`}>
            <button
              type="button"
              aria-expanded={abierto}
              aria-label={`Detalle de ${item.nombre} en ${filaNombre}`}
              onClick={onAbrir}
              className={cn(
                "shrink-0 rounded-sm p-0.5 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground focus:opacity-100",
                abierto ? "opacity-100" : "opacity-0 group-hover/celda:opacity-100"
              )}
            >
              <ChevronDown
                className={cn("h-3 w-3 transition-transform duration-200", abierto && "rotate-180")}
              />
            </button>
          </Tooltip>
        </span>
      </td>
    </Fragment>
  );
}

/**
 * El nombre de una fila extra, editable en el lugar.
 *
 * Va con lápiz y tacho, como la sección, porque es lo mismo: algo que escribió
 * el usuario a mano y que se corrige donde se lee.
 */
function FilaExtraNombre({
  proyectoId,
  fila,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  fila: FilaExtraOpcion;
  onSaved: (fila: FilaExtraOpcion) => void;
  onDeleted: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(fila.nombre);
  const [prev, setPrev] = useState(fila);
  const [, startTransition] = useTransition();

  if (fila !== prev) {
    setPrev(fila);
    setNombre(fila.nombre);
  }

  const guardar = () => {
    setEditando(false);
    const limpio = nombre.trim();
    if (limpio === fila.nombre) return;
    // Vaciar el campo es un tipeo a medias, no un pedido de borrar: se vuelve
    // al nombre anterior en vez de mandar un nombre vacío al servidor.
    if (limpio === "") {
      setNombre(fila.nombre);
      return;
    }

    startTransition(async () => {
      const result = await renombrarFilaExtra(proyectoId, fila.id, limpio);
      if (!result.success) {
        toast.error(result.error);
        setNombre(fila.nombre);
        return;
      }
      onSaved(result.fila);
    });
  };

  const borrar = () =>
    startTransition(async () => {
      const result = await eliminarFilaExtra(proyectoId, fila.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onDeleted(fila.id);
    });

  if (editando) {
    return (
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setNombre(fila.nombre);
            setEditando(false);
          }
        }}
        aria-label="Nombre del nivel"
        autoFocus
        className="w-full min-w-0 rounded-sm border border-input bg-background px-1 py-0.5 text-sm focus:border-ring focus:outline-none"
      />
    );
  }

  return (
    <span className="group flex min-w-0 flex-1 items-start gap-1">
      {/* Sin truncate: el nombre del nivel se lee entero y si no entra, baja
          de renglón. Es la etiqueta de la fila; cortada no sirve. */}
      <span className="min-w-0 flex-1 leading-tight break-words">{fila.nombre}</span>
      <Tooltip content={`Renombrar ${fila.nombre}`}>
        <button
          type="button"
          aria-label={`Renombrar ${fila.nombre}`}
          onClick={() => setEditando(true)}
          className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </Tooltip>
      <Tooltip content={`Eliminar ${fila.nombre}`}>
        <button
          type="button"
          aria-label={`Eliminar ${fila.nombre}`}
          onClick={borrar}
          className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </Tooltip>
    </span>
  );
}

/**
 * El nombre de un nivel de la obra, editable desde la misma grilla.
 *
 * El alta sigue siendo en "Editar datos" del proyecto —ahí se decide el orden
 * de abajo hacia arriba—, pero corregir un nombre mal escrito ("PLANTA BAJA"
 * que debía decir "PLANTA BAJA 2") o borrar uno que se cargó de más no debería
 * obligar a salir de la grilla que se está mirando. Por eso el gatillo es un
 * doble clic sobre el nombre, no un lápiz siempre visible: para un nivel —a
 * diferencia de una fila extra, que es de quien la escribe— tocarlo sin
 * querer sería más fácil, y un doble clic no pasa por accidente.
 *
 * El tacho sí queda visible al pasar el mouse, igual que en una fila extra:
 * borrar un nivel con cómputo cargado está bloqueado del lado del servidor
 * (ver eliminarNivel), así que no hace falta esconderlo detrás de otro gesto.
 */
function NivelNombre({
  proyectoId,
  nivel,
  onSaved,
  onDeleted,
}: {
  proyectoId: string;
  nivel: { id: string; nombre: string };
  onSaved: (nivel: NivelOpcion) => void;
  onDeleted: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(nivel.nombre);
  const [prev, setPrev] = useState(nivel);
  const [, startTransition] = useTransition();

  if (nivel.id !== prev.id || nivel.nombre !== prev.nombre) {
    setPrev(nivel);
    setNombre(nivel.nombre);
  }

  const guardar = () => {
    setEditando(false);
    const limpio = nombre.trim();
    if (limpio === nivel.nombre) return;
    // Vaciar el campo es un tipeo a medias, no un pedido de borrar: se vuelve
    // al nombre anterior en vez de mandar un nombre vacío al servidor.
    if (limpio === "") {
      setNombre(nivel.nombre);
      return;
    }

    startTransition(async () => {
      const result = await renombrarNivel(proyectoId, nivel.id, limpio);
      if (!result.success) {
        toast.error(result.error);
        setNombre(nivel.nombre);
        return;
      }
      onSaved(result.nivel);
    });
  };

  const borrar = () =>
    startTransition(async () => {
      const result = await eliminarNivel(proyectoId, nivel.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onDeleted(nivel.id);
    });

  if (editando) {
    return (
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setNombre(nivel.nombre);
            setEditando(false);
          }
        }}
        aria-label="Nombre del nivel"
        autoFocus
        className="w-full min-w-0 rounded-sm border border-input bg-background px-1 py-0.5 text-sm focus:border-ring focus:outline-none"
      />
    );
  }

  return (
    <span className="group flex min-w-0 flex-1 items-start gap-1">
      {/* Sin truncate: el nombre del nivel se lee entero y si no entra, baja
          de renglón. Es la etiqueta de la fila; cortada no sirve. */}
      <span
        onDoubleClick={() => setEditando(true)}
        title="Doble clic para renombrar"
        className="min-w-0 flex-1 cursor-text leading-tight break-words"
      >
        {nivel.nombre}
      </span>
      <Tooltip content={`Eliminar ${nivel.nombre}`}>
        <button
          type="button"
          aria-label={`Eliminar ${nivel.nombre}`}
          onClick={borrar}
          className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </Tooltip>
    </span>
  );
}

/**
 * El campo para sumar una fila puntual a esta grilla.
 *
 * En pantalla dice "Nivel" aunque el modelo se llame ComputoFilaExtra: para
 * quien computa, una fila de la grilla ES un nivel, y llamarla de otra manera
 * obliga a aprenderse una distinción que sólo existe en la base. La diferencia
 * real —que este vive en una sola sección y los de "Editar datos" están en
 * todas— se ve sola, porque el que se agrega acá no aparece en las otras
 * grillas.
 *
 * Arranca escondido detrás de un botón porque es la excepción: lo normal es que
 * las filas sean los niveles de la obra y aparezcan solas. Dejar un campo de
 * texto abierto al pie de cada sección invitaría a cargar acá algo que en
 * realidad es un nivel de toda la obra, y eso después no está en ninguna otra
 * grilla.
 */
function FilaExtraNueva({
  proyectoId,
  seccionId,
  onSaved,
}: {
  proyectoId: string;
  seccionId: string;
  onSaved: (fila: FilaExtraOpcion) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();

  const guardar = () => {
    const limpio = nombre.trim();
    if (!limpio) return;

    startTransition(async () => {
      const result = await crearFilaExtra(proyectoId, seccionId, limpio);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.fila);
      setNombre("");
      setAbierto(false);
    });
  };

  if (!abierto) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setAbierto(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Nivel
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            guardar();
          }
          if (e.key === "Escape") {
            setNombre("");
            setAbierto(false);
          }
        }}
        placeholder="Sala de máquinas"
        aria-label="Nombre del nivel nuevo"
        autoFocus
        className="w-40 rounded-sm border border-input bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none"
      />
      <Button type="button" size="sm" disabled={pending} onClick={guardar}>
        Agregar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setNombre("");
          setAbierto(false);
        }}
      >
        Cancelar
      </Button>
    </span>
  );
}

/**
 * Una sección del cómputo, como grilla: los niveles abajo, los ítems al costado.
 *
 * La obra se mide planta por planta —se sube, se cuenta lo que hay en ese piso y
 * se baja—, así que las filas son los niveles y se leen en el orden en que se
 * construye. Cada ítem es una columna, y son dos: lo medido y lo medido con el
 * desperdicio, que es lo que hay que comprar. Al proveedor se le pide la
 * segunda; al contratista se le muestra la primera.
 *
 * La unidad va en el encabezado y no en una columna propia: es del ítem entero,
 * no de cada celda, y repetirla quince veces hacia abajo sólo gasta ancho.
 *
 * Abajo de todo el total de cada columna. No hay total de la fila ni total
 * general a propósito: sumar m² de revoque con unidades de ladrillo da un
 * número que no significa nada.
 *
 * La grilla entra siempre en el ancho de la página y nunca scrollea a lo ancho:
 * las columnas se reparten el lugar que hay. Un cómputo se revisa mirando todo
 * junto —qué falta, qué quedó en cero—, y con barra horizontal esa lectura se
 * pierde: los primeros ítems se van de la pantalla justo cuando se está
 * comparando contra ellos. El precio es que muchos ítems en una misma sección
 * quedan angostos; cuando pasa, la respuesta es partir la sección en dos, que
 * es además como está organizada la obra.
 */

/**
 * Cuántas columnas de la tabla ocupa un ítem.
 *
 * El hierro es un caso aparte y va siempre en tres: metros lineales, barras y
 * kilos, una al lado de la otra, las tres editables y sincronizadas entre sí
 * (ver CeldaHierro). No necesita además la de la merma ni los bultos por
 * separado porque esas tres columnas ya son justo esa conversión.
 *
 * Para el resto: una siempre —lo medido—, más la de la merma si tiene
 * desperdicio, más la de los bultos (palets, bolsas) si se compra agrupado,
 * más la del material si se compra en otra unidad. Se calcula en un solo
 * lugar porque el encabezado, cada fila, el pie y el colspan del detalle
 * tienen que estar todos de acuerdo: si uno cuenta distinto, la tabla sale con
 * las celdas corridas y los números quedan abajo de la columna equivocada.
 */
function subcolumnas(item: ItemOpcion, puertas: boolean) {
  if (esHierro(item)) return 3;
  return (
    1 +
    (item.desperdicio !== null ? 1 : 0) +
    (tieneBultos(item) ? 1 : 0) +
    (conversionDe(item) !== null ? 1 : 0) +
    // Sólo en la grilla de PUERTAS: dos columnas más por ítem, los cajones
    // chico (C10) y grande (C15). Ver esSeccionPuertas.
    (puertas ? 2 : 0)
  );
}

export function SeccionGrilla({
  proyectoId,
  seccion,
  niveles,
  filasExtra,
  items,
  totales,
  onItemSaved,
  onItemDeleted,
  onSeccionSaved,
  onSeccionDeleted,
  onFilaExtraSaved,
  onFilaExtraDeleted,
  onNivelSaved,
  onNivelDeleted,
}: {
  proyectoId: string;
  seccion: SeccionOpcion;
  niveles: NivelOpcion[];
  /** Las filas propias de esta sección, en orden. */
  filasExtra: FilaExtraOpcion[];
  /** Los ítems de esta sección, en orden. */
  items: ItemOpcion[];
  /** Los totales de toda la obra, para resolver las filas derivadas. */
  totales: Map<string, number>;
  onItemSaved: (item: ItemOpcion) => void;
  onItemDeleted: (id: string) => void;
  onSeccionSaved: (seccion: SeccionOpcion) => void;
  onSeccionDeleted: (id: string) => void;
  onFilaExtraSaved: (fila: FilaExtraOpcion) => void;
  onFilaExtraDeleted: (id: string) => void;
  /** El nivel es de la obra, no de esta sección: el cambio se avisa para arriba
   *  y de ahí se reparte a todas las grillas que lo muestran. */
  onNivelSaved: (nivel: NivelOpcion) => void;
  onNivelDeleted: (id: string) => void;
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(seccion.nombre);
  // El orden de las filas se mantiene acá además de en el servidor para que el
  // bloque quede donde lo soltaron apenas se suelta, sin esperar la ida y
  // vuelta. Si el guardado falla se vuelve al anterior.
  const [orden, setOrden] = useState(seccion.ordenFilas);
  const [abierta, setAbierta] = useState<CeldaAbierta | null>(null);
  const [prev, setPrev] = useState(seccion);
  const [, startTransition] = useTransition();

  const sensores = useSensors(
    // Sin este mínimo un click en el lápiz o en el tacho de una fila extra se
    // interpretaría como el principio de un arrastre y no llegaría al botón.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  if (seccion !== prev) {
    setPrev(seccion);
    setNombre(seccion.nombre);
    setOrden(seccion.ordenFilas);
  }

  const guardarNombre = () => {
    setRenombrando(false);
    const limpio = nombre.trim();
    if (limpio === seccion.nombre) return;
    // Vaciar el campo no es "borrame": es un tipeo a medias. Se vuelve al
    // nombre anterior en vez de mandar un nombre vacío al servidor.
    if (limpio === "") {
      setNombre(seccion.nombre);
      return;
    }

    startTransition(async () => {
      const result = await renombrarSeccion(proyectoId, seccion.id, limpio);
      if (!result.success) {
        toast.error(result.error);
        setNombre(seccion.nombre);
        return;
      }
      onSeccionSaved(result.seccion);
    });
  };

  const borrar = () =>
    startTransition(async () => {
      const result = await eliminarSeccion(proyectoId, seccion.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSeccionDeleted(seccion.id);
    });

  /**
   * Las filas de la grilla, en el orden en que se leen.
   *
   * De fábrica salen primero los niveles de la obra, que valen para todas las
   * secciones y vienen de "Editar datos" del proyecto, y después las filas
   * propias de esta sección. Pero ese orden se puede cambiar arrastrando, y el
   * que se guardó manda: una sala de máquinas puede ir entre el 4° piso y la
   * azotea, que es donde está en la obra.
   *
   * El orden es de ESTA grilla y de ninguna otra. Es el precio de poder
   * intercalar: como los niveles y las filas extra viven en tablas distintas,
   * no hay un número único que las mezcle, y hacerlo global obligaría a que
   * todas las secciones de la obra tuvieran la misma sala de máquinas.
   *
   * Al final "Toda la obra", y sólo si tiene algo: es lo que no es de ninguna
   * planta —la excavación, el cerco— y las filas que salen de una cuenta sobre
   * otro ítem. En una sección normal no hay nada de eso, y una fila vacía
   * permanente al pie de cada grilla sería ruido que nunca se apaga.
   */
  const hayGeneral = items.some((i) =>
    i.mediciones.some((m) => m.nivelId === null && m.filaExtraId === null)
  );
  const filas: Fila[] = ordenarFilas(
    [
      ...niveles.map((n) => ({
        clave: { tipo: "nivel" as const, id: n.id },
        nombre: n.nombre,
      })),
      ...filasExtra.map((f) => ({
        clave: { tipo: "extra" as const, id: f.id },
        nombre: f.nombre,
      })),
      ...(hayGeneral ? [{ clave: { tipo: "general" as const }, nombre: SIN_NIVEL }] : []),
    ],
    orden
  );
  const extraPorId = new Map(filasExtra.map((f) => [f.id, f]));

  /** Las que se pueden arrastrar: todas menos "Toda la obra", que va fija al pie. */
  const arrastrables = filas
    .filter((f) => f.clave.tipo !== "general")
    .map((f) => claveFilaKey(f.clave));

  // Hormigón es la única sección, por ahora, que además del total por ítem
  // (al pie) necesita el total por piso (a la derecha): ver el comentario de
  // `mostrarTotalPorFila`.
  const totalPorPiso = mostrarTotalPorFila(seccion, items);
  const unidadTotalPorPiso = totalPorPiso ? items[0].unidad : null;

  // Sólo en la grilla de PUERTAS (no en HERRAJES, aunque comparten rubro):
  // cada ítem suma dos columnas más, C10 y C15, los cajones.
  const puertas = esSeccionPuertas(seccion);

  /**
   * Cuántas columnas tiene la tabla. La necesita el detalle, que se despliega
   * como una fila entera abajo de la que se abrió.
   */
  const columnas =
    1 +
    items.reduce((acc, i) => acc + subcolumnas(i, puertas), 0) +
    (totalPorPiso ? 1 : 0);

  const soltar = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const desde = arrastrables.indexOf(String(active.id));
    const hasta = arrastrables.indexOf(String(over.id));
    if (desde === -1 || hasta === -1) return;

    const nuevo = arrayMove(arrastrables, desde, hasta);
    const anterior = orden;
    setOrden(nuevo);

    startTransition(async () => {
      const result = await reordenarFilasSeccion(proyectoId, seccion.id, nuevo);
      if (!result.success) {
        toast.error(result.error);
        setOrden(anterior);
        return;
      }
      onSeccionSaved(result.seccion);
    });
  };

  const agregar = (
    <ItemSeccionDialog
      proyectoId={proyectoId}
      seccionId={seccion.id}
      seccionNombre={seccion.nombre}
      onSaved={onItemSaved}
      trigger={
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Ítem
        </Button>
      }
    />
  );

  return (
    // overflow-hidden para que la banda gris del total no le coma las esquinas
    // redondeadas a la tarjeta: sin eso el pie de la grilla termina en ángulo
    // recto y la sección parece cortada.
    <div className="overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        {renombrando ? (
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setNombre(seccion.nombre);
                setRenombrando(false);
              }
            }}
            aria-label="Nombre de la sección"
            autoFocus
            className="min-w-0 flex-1 rounded-sm border border-input bg-background px-2 py-0.5 text-xs font-semibold tracking-wider uppercase focus:border-ring focus:outline-none"
          />
        ) : (
          <>
            {/* Escalón 2 de 3. Más chica que el rubro y en gris, pero sigue en
                caja alta y con el espaciado abierto: así se lee como rótulo de
                bloque y no compite con el título de arriba ni con los nombres de
                los ítems, que van en caja normal. */}
            <h4 className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {seccion.nombre}
            </h4>
            <Tooltip content={`Renombrar ${seccion.nombre}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Renombrar ${seccion.nombre}`}
                onClick={() => setRenombrando(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </>
        )}

        <FilaExtraNueva
          proyectoId={proyectoId}
          seccionId={seccion.id}
          onSaved={onFilaExtraSaved}
        />
        {agregar}

        <Tooltip content={`Eliminar ${seccion.nombre}`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar ${seccion.nombre}`}
            onClick={borrar}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Esta sección no tiene ítems todavía.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada ítem es una columna, con una celda por nivel. Al crearlo se le
            indica en qué se mide y cuánto desperdicio lleva.
          </p>
        </div>
      ) : filas.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          Esta obra no tiene niveles cargados, así que la grilla no tiene filas.
        </p>
      ) : (
        // `table-fixed` es lo que hace que entre siempre: reparte el ancho
        // disponible entre las columnas en vez de que cada una pida lo que su
        // contenido necesita y la tabla se vaya para la derecha. Los ítems
        // nuevos achican a los que ya estaban, no empujan el borde.
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {/* La de los niveles es la única con ancho propio: es la que se
                  lee para saber de qué fila es cada número, y si se achicara
                  junto con las demás "PLANTA BAJA" terminaría partido en tres
                  renglones. Las de los ítems se reparten lo que queda. */}
              {/* Escalón 3 de 3, el de los rótulos de columna. "Nivel" y los
                  nombres de los ítems son lo mismo —el rótulo de un eje de la
                  tabla— así que van iguales: chicos, de peso medio y en caja
                  normal. La caja normal es lo que más los separa de la sección,
                  que va en mayúsculas. */}
              <th className="w-44 px-3 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                Nivel
              </th>
              {items.map((item) => (
                <th
                  key={item.id}
                  colSpan={subcolumnas(item, puertas)}
                  className="border-l px-2 pt-2 pb-1 text-center align-bottom"
                >
                  <span className="flex items-center justify-center gap-1">
                    <span className="min-w-0 truncate text-xs font-medium text-foreground">
                      {item.nombre}
                    </span>
                    <ItemSeccionDialog
                      proyectoId={proyectoId}
                      seccionId={seccion.id}
                      seccionNombre={seccion.nombre}
                      item={item}
                      onSaved={onItemSaved}
                      onDeleted={onItemDeleted}
                      trigger={
                        <button
                          type="button"
                          aria-label={`Editar ${item.nombre}`}
                          title={`Editar ${item.nombre}`}
                          className="shrink-0 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      }
                    />
                  </span>
                  {/* La unidad baja un punto más: ahora que el nombre del ítem
                      es text-xs, dejarla en text-xs la hacía pesar lo mismo que
                      el nombre y el encabezado se leía como dos renglones de
                      igual rango.

                      Para el hierro ya no hace falta un caso especial acá: con
                      las dos columnas (ml y barras) visibles, cada una lleva su
                      propia etiqueta en el subencabezado (ver Subencabezados) y
                      esta de arriba puede decir lo mismo que en cualquier otro
                      ítem. */}
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {simboloUnidad(item.unidad)}
                  </span>
                  {/* El modelo elegido, si ya se sabe. No entra en ninguna
                      cuenta: es sólo para tenerlo anotado al lado del ítem. */}
                  {item.modelo && (
                    <span
                      title={item.modelo}
                      className="block truncate text-[10px] font-normal text-muted-foreground italic"
                    >
                      {item.modelo}
                    </span>
                  )}
                </th>
              ))}
              {totalPorPiso && (
                // Va aparte de los ítems, con su propio fondo, para que se lea
                // de entrada que no es un ítem más: es la cuenta de todos
                // juntos, que es la que de verdad se usa para programar un
                // pozo de hormigón piso por piso.
                <th
                  title="Suma de todos los ítems de esta sección, piso por piso: lo que de verdad hace falta para programar un pozo de hormigón."
                  className="border-l bg-foreground/[0.04] px-2 pt-2 pb-1 text-center align-bottom text-xs font-medium text-foreground"
                >
                  Total
                </th>
              )}
            </tr>
            <tr className="border-b bg-muted/25">
              <th />
              {items.map((item) => (
                <Subencabezados key={item.id} item={item} puertas={puertas} />
              ))}
              {totalPorPiso && (
                <th className="border-l bg-foreground/[0.04] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground">
                  {simboloUnidad(unidadTotalPorPiso!)}
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              // El detalle abierto es una fila aparte que no acompaña al bloque
              // mientras se arrastra: se cierra al empezar para que no quede
              // colgado debajo de una fila que ya no está ahí.
              onDragStart={() => setAbierta(null)}
              onDragEnd={soltar}
            >
              <SortableContext
                items={arrastrables}
                strategy={verticalListSortingStrategy}
              >
                {filas.map((fila) => (
                  <FilaGrilla
                    key={claveFilaKey(fila.clave)}
                    proyectoId={proyectoId}
                    fila={fila}
                    extra={
                      fila.clave.tipo === "extra"
                        ? extraPorId.get(fila.clave.id)
                        : undefined
                    }
                    items={items}
                    totales={totales}
                    columnas={columnas}
                    totalPorPiso={totalPorPiso}
                    puertas={puertas}
                    abierta={abierta}
                    onAbrir={setAbierta}
                    onItemSaved={onItemSaved}
                    onFilaExtraSaved={onFilaExtraSaved}
                    onFilaExtraDeleted={onFilaExtraDeleted}
                    onNivelSaved={onNivelSaved}
                    onNivelDeleted={onNivelDeleted}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-border bg-muted/80">
              <th
                scope="row"
                className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-foreground uppercase"
              >
                Total
              </th>
              {items.map((item) => {
                const total = totales.get(item.id) ?? 0;
                const vacio = item.mediciones.length === 0;
                const hierro = esHierro(item);
                // Los bultos (barras, palets, etc.) se redondean para arriba
                // una sola vez, acá en el total de toda la obra: hacerlo por
                // nivel y después sumar daría de más una vez por planta, que
                // en una obra de seis plantas son cinco palets comprados de
                // más (o, en hierro, barras de sobra en cada piso).
                const bultos = tieneBultos(item)
                  ? bultosDe(item, materialDe(item, total))
                  : null;

                // El hierro en el total muestra las tres columnas, igual que
                // en cada nivel: los metros totales, al lado las barras a
                // pedir redondeadas para arriba (acá sí tiene sentido
                // redondear, a diferencia de cada nivel por separado: ver el
                // comentario de arriba sobre por qué vive acá y no en cada
                // fila) y por último el peso total en kilos.
                if (hierro) {
                  return (
                    <Fragment key={item.id}>
                      <td className="border-l px-3 py-2 text-right text-sm font-semibold tabular-nums">
                        {vacio ? "—" : formatCantidad(total)}
                      </td>
                      <td className="bg-foreground/[0.04] px-3 py-2 text-right">
                        {vacio || bultos === null ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <span
                            title={`${formatCantidad(bultos.exacto)} barras exactas`}
                            className="flex flex-col items-end leading-tight"
                          >
                            <span className="text-sm font-semibold tabular-nums">
                              {bultos.enteros}
                            </span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {formatCantidad(bultos.exacto)}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="bg-foreground/[0.04] px-3 py-2 text-right text-sm font-semibold tabular-nums">
                        {vacio ? "—" : formatCantidad(materialDe(item, total) ?? 0)}
                      </td>
                    </Fragment>
                  );
                }

                return (
                  <Fragment key={item.id}>
                    <td className="border-l px-3 py-2 text-right text-sm font-semibold tabular-nums">
                      {vacio ? "—" : formatCantidad(total)}
                    </td>
                    {item.desperdicio !== null && (
                      // La del desperdicio va un tono más apagada también acá:
                      // el total que se mira es el medido, y el otro es el que
                      // se copia a la orden de compra.
                      <td className="bg-foreground/[0.04] px-3 py-2 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                        {vacio ? "—" : formatCantidad(conDesperdicio(total, item.desperdicio))}
                      </td>
                    )}
                    {tieneBultos(item) && (
                      <td className="bg-foreground/[0.04] px-3 py-2 text-right">
                        {vacio || bultos === null ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <span
                            title={`${formatCantidad(bultos.exacto)} ${etiquetaBultos([item])} exactos`}
                            className="flex flex-col items-end leading-tight"
                          >
                            <span className="text-sm font-semibold tabular-nums">
                              {bultos.enteros}
                            </span>
                            {/* El exacto al lado del entero: 6,26 dice que
                                sobran tres cuartos del último, y eso a veces
                                cambia la decisión de cuántos pedir. */}
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {formatCantidad(bultos.exacto)}
                            </span>
                          </span>
                        )}
                      </td>
                    )}
                    {conversionDe(item) !== null && (
                      <td className="bg-foreground/[0.06] px-3 py-2 text-right text-sm font-semibold tabular-nums">
                        {vacio ? "—" : formatCantidad(materialDe(item, total) ?? 0)}
                      </td>
                    )}
                    {puertas && (
                      <Fragment>
                        <td
                          title={`Total de cajones C10 de ${item.nombre}`}
                          className="bg-foreground/[0.04] px-3 py-2 text-right text-sm font-semibold tabular-nums"
                        >
                          {formatCantidad(totalCajones(item, "cajonC10"))}
                        </td>
                        <td
                          title={`Total de cajones C15 de ${item.nombre}`}
                          className="bg-foreground/[0.04] px-3 py-2 text-right text-sm font-semibold tabular-nums"
                        >
                          {formatCantidad(totalCajones(item, "cajonC15"))}
                        </td>
                      </Fragment>
                    )}
                  </Fragment>
                );
              })}
              {totalPorPiso && (
                // El mismo número que daría sumar la columna nueva de todos
                // los pisos: la cuenta de toda la obra, para chequear de un
                // vistazo que el total por piso y el total por ítem cierran
                // igual.
                <td className="border-l bg-foreground/[0.04] px-3 py-2 text-right text-sm font-semibold tabular-nums">
                  {items.every((i) => i.mediciones.length === 0)
                    ? "—"
                    : formatCantidad(
                        items.reduce((acc, i) => acc + (totales.get(i.id) ?? 0), 0)
                      )}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

/**
 * Una fila de la grilla: el nivel a la izquierda y una celda por cada ítem.
 *
 * Se mueve entera, del agarre, y no celda por celda: un piso es un bloque, y lo
 * que se reordena es en qué orden se recorre la obra, no dónde cae un número
 * suelto. Arrastrar una celda sola dejaría los m³ de bases en la planta baja y
 * los de columnas en el 1° piso, que es un dato roto.
 *
 * Abajo puede desplegarse el detalle de UNA celda. Va como fila entera y no
 * dentro de la columna porque una columna de la grilla mide dos centímetros: el
 * desglose necesita el ancho de la tabla para que entren la descripción y el
 * número.
 */
function FilaGrilla({
  proyectoId,
  fila,
  extra,
  items,
  totales,
  columnas,
  totalPorPiso,
  puertas,
  abierta,
  onAbrir,
  onItemSaved,
  onFilaExtraSaved,
  onFilaExtraDeleted,
  onNivelSaved,
  onNivelDeleted,
}: {
  proyectoId: string;
  fila: Fila;
  /** La fila extra, si esta fila es una. Los niveles no tienen. */
  extra: FilaExtraOpcion | undefined;
  items: ItemOpcion[];
  totales: Map<string, number>;
  columnas: number;
  /** Si esta sección suma, a la derecha de todo, el total de todos los ítems en este piso. */
  totalPorPiso: boolean;
  /** Si esta sección es PUERTAS: cada ítem suma las columnas de cajones C10/C15. */
  puertas: boolean;
  abierta: CeldaAbierta | null;
  onAbrir: (celda: CeldaAbierta | null) => void;
  onItemSaved: (item: ItemOpcion) => void;
  onFilaExtraSaved: (fila: FilaExtraOpcion) => void;
  onFilaExtraDeleted: (id: string) => void;
  onNivelSaved: (nivel: NivelOpcion) => void;
  onNivelDeleted: (id: string) => void;
}) {
  const filaKey = claveFilaKey(fila.clave);
  // "Toda la obra" no se arrastra: no es una planta, es el resto, y entre las
  // plantas no significaría nada.
  const arrastrable = fila.clave.tipo !== "general";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: filaKey, disabled: !arrastrable });

  const itemAbierto =
    abierta && abierta.filaKey === filaKey
      ? items.find((i) => i.id === abierta.itemId)
      : undefined;

  // La suma de todos los ítems en este piso, sólo si la sección la pidió (ver
  // `mostrarTotalPorFila`). "Vacío" es que ningún ítem tenga nada cargado en
  // esta fila todavía, no que la suma dé 0 —un piso sin excavar en la fila de
  // bases es "—", no "0 m³".
  const tieneAlgo = items.some((i) => tieneMedidoEnFila(i, fila.clave));
  const totalFila = totalPorPiso ? totalPorFila(items, fila.clave, totales) : 0;

  return (
    <Fragment>
      <tr
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn(
          "group/fila border-b transition-colors duration-150 last:border-b-0",
          isDragging ? "relative z-10 bg-background shadow-md" : "hover:bg-muted/30"
        )}
      >
        {/* La columna de los niveles va en gris y con el texto entero: es el
            encabezado de la fila, no un dato, y cortar "SALA DE MÁQUINAS" en
            "SALA DE MÁQ…" obliga a adivinar de qué fila es cada número. Si el
            nombre es largo, baja de renglón. */}
        <th
          scope="row"
          className="bg-muted/40 px-3 py-1 text-left text-sm font-medium transition-colors duration-150 group-hover/fila:bg-muted/60"
        >
          <span className="flex min-w-0 items-start gap-1">
            {arrastrable ? (
              <Tooltip content="Arrastrar para reordenar">
                <button
                  type="button"
                  aria-label={`Mover ${fila.nombre}`}
                  className="mt-0.5 shrink-0 touch-none cursor-grab rounded-sm text-muted-foreground/60 transition-colors duration-150 hover:text-foreground active:cursor-grabbing group-hover/fila:text-muted-foreground"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            ) : (
              // Hueco del mismo ancho que el agarre, para que el nombre de
              // "Toda la obra" no quede corrido respecto de las plantas.
              <span className="w-3.5 shrink-0" aria-hidden />
            )}
            {extra ? (
              <FilaExtraNombre
                proyectoId={proyectoId}
                fila={extra}
                onSaved={onFilaExtraSaved}
                onDeleted={onFilaExtraDeleted}
              />
            ) : fila.clave.tipo === "nivel" ? (
              <NivelNombre
                proyectoId={proyectoId}
                nivel={{ id: fila.clave.id, nombre: fila.nombre }}
                onSaved={onNivelSaved}
                onDeleted={onNivelDeleted}
              />
            ) : (
              <span className="min-w-0 flex-1 leading-tight break-words">
                {fila.nombre}
              </span>
            )}
          </span>
        </th>

        {items.map((item) => {
          const tiene = tieneMedidoEnFila(item, fila.clave);
          const medido = medidoEnFila(item, fila.clave, totales);
          const renglones = medicionesDeFila(item, fila.clave);
          // Una celda que sale de una cuenta sobre otro ítem no se escribe ni
          // se desglosa: el número viene de otro lado y pisarlo borraría la
          // cuenta sin que se vea.
          const derivada = esDerivadaEnFila(item, fila.clave);
          const desglosada = renglones.length > 1;
          const abierto = abierta?.itemId === item.id && abierta.filaKey === filaKey;
          const hierro = esHierro(item);
          // Lo que se lee en la celda de hierro es la cantidad de barras, no
          // los metros: acá sólo interesa cuánto pedir. Sin redondear, como
          // toda celda de nivel (ver bultosDe) — el redondeo es sólo del
          // total, al pie.
          const barrasEnNivel = (ml: number) =>
            formatCantidad(bultosDe(item, materialDe(item, ml))?.exacto ?? 0);
          const kgEnNivel = (ml: number) => formatCantidad(materialDe(item, ml) ?? 0);

          if (hierro) {
            // El hierro va en tres columnas (ml, barras y kg) en vez de la
            // celda única del resto de los ítems. Derivada y desglosada
            // muestran las tres, de solo lectura; la simple delega en
            // CeldaHierro, que ya trae sus tres <td> con los tres campos
            // sincronizados.
            if (derivada) {
              return (
                <Fragment key={item.id}>
                  <td className="border-l px-1 py-0.5">
                    <span
                      title="Sale de una cuenta sobre otro ítem"
                      className="block px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {formatCantidad(medido)}
                    </span>
                  </td>
                  <td className="bg-foreground/[0.04] px-1 py-0.5">
                    <span
                      title="Sale de una cuenta sobre otro ítem"
                      className="block px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {barrasEnNivel(medido)}
                    </span>
                  </td>
                  <td className="bg-foreground/[0.04] px-1 py-0.5">
                    <span
                      title="Sale de una cuenta sobre otro ítem"
                      className="block px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {kgEnNivel(medido)}
                    </span>
                  </td>
                </Fragment>
              );
            }

            if (desglosada) {
              // Con varios renglones el número de la celda es la suma, y una
              // suma no se tipea: se toca y se corrige adentro, en cualquiera
              // de las tres columnas.
              return (
                <Fragment key={item.id}>
                  <td className="border-l px-1 py-0.5">
                    <Tooltip content="Metros, sin redondear. Tocá para ver el detalle de cada renglón.">
                      <button
                        type="button"
                        aria-expanded={abierto}
                        aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                        onClick={() => onAbrir(abierto ? null : { itemId: item.id, filaKey })}
                        className="w-full rounded-sm px-2 py-1 text-right text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                      >
                        {formatCantidad(medido)}
                      </button>
                    </Tooltip>
                  </td>
                  <td className="bg-foreground/[0.04] px-1 py-0.5">
                    <Tooltip content="Cantidad de barras, sin redondear (se redondea sólo en el Total). Tocá para ver el detalle de cada renglón.">
                      <button
                        type="button"
                        aria-expanded={abierto}
                        aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                        onClick={() => onAbrir(abierto ? null : { itemId: item.id, filaKey })}
                        className="w-full rounded-sm px-2 py-1 text-right text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                      >
                        {barrasEnNivel(medido)}
                      </button>
                    </Tooltip>
                  </td>
                  <td className="bg-foreground/[0.04] px-1 py-0.5">
                    <Tooltip content="Peso en kilos, sin redondear. Tocá para ver el detalle de cada renglón.">
                      <button
                        type="button"
                        aria-expanded={abierto}
                        aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                        onClick={() => onAbrir(abierto ? null : { itemId: item.id, filaKey })}
                        className="w-full rounded-sm px-2 py-1 text-right text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                      >
                        {kgEnNivel(medido)}
                      </button>
                    </Tooltip>
                  </td>
                </Fragment>
              );
            }

            return (
              <CeldaHierro
                key={item.id}
                proyectoId={proyectoId}
                item={item}
                fila={fila.clave}
                filaNombre={fila.nombre}
                valor={tiene ? medido : null}
                onSaved={onItemSaved}
                abierto={abierto}
                onAbrir={() => onAbrir(abierto ? null : { itemId: item.id, filaKey })}
              />
            );
          }

          return (
            <Fragment key={item.id}>
              <td className="group/celda border-l px-1 py-0.5">
                <span className="flex items-center gap-0.5">
                  {derivada ? (
                    <span
                      title="Sale de una cuenta sobre otro ítem"
                      className="min-w-0 flex-1 px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {formatCantidad(medido)}
                    </span>
                  ) : desglosada ? (
                    // Con varios renglones el número de la celda es la suma, y
                    // una suma no se tipea: se toca y se corrige adentro.
                    <Tooltip content="Suma de los renglones. Tocá para ver el detalle.">
                      <button
                        type="button"
                        aria-expanded={abierto}
                        aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                        onClick={() =>
                          onAbrir(abierto ? null : { itemId: item.id, filaKey })
                        }
                        className="min-w-0 flex-1 rounded-sm px-2 py-1 text-right text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                      >
                        {formatCantidad(medido)}
                      </button>
                    </Tooltip>
                  ) : (
                    <Celda
                      proyectoId={proyectoId}
                      item={item}
                      fila={fila.clave}
                      filaNombre={fila.nombre}
                      valor={tiene ? medido : null}
                      onSaved={onItemSaved}
                    />
                  )}

                  {!derivada && !desglosada && (
                    // El desplegado arranca invisible: la mayoría de las celdas
                    // son un número suelto y quince flechitas por fila taparían
                    // la lectura de la planilla, que es para lo que se abre.
                    <Tooltip content={`Detalle de ${item.nombre} en ${fila.nombre}`}>
                      <button
                        type="button"
                        aria-expanded={abierto}
                        aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                        onClick={() =>
                          onAbrir(abierto ? null : { itemId: item.id, filaKey })
                        }
                        className={cn(
                          "shrink-0 rounded-sm p-0.5 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground focus:opacity-100",
                          abierto ? "opacity-100" : "opacity-0 group-hover/celda:opacity-100"
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform duration-200",
                            abierto && "rotate-180"
                          )}
                        />
                      </button>
                    </Tooltip>
                  )}
                </span>
              </td>

              {item.desperdicio !== null && (
                // Un tono más apagada que la de al lado: no es un dato medido,
                // es el mismo número con la merma encima. Se lee de reojo al
                // armar la compra, no al computar.
                <td className="bg-foreground/[0.03] px-2 py-1 text-right text-sm tabular-nums text-muted-foreground">
                  {!tiene ? "—" : formatCantidad(conDesperdicio(medido, item.desperdicio))}
                </td>
              )}

              {tieneBultos(item) && (
                // El exacto de este nivel, sin redondear: redondear acá y
                // sumar los niveles después compraría de más, una vez por
                // nivel (ver el comentario de `bultosDe`). El número que se
                // usa para pedir es el redondeado del total, al pie.
                <td
                  title={`${item.nombre} en ${fila.nombre}: cantidad de ${etiquetaBultos([item])}, sin redondear`}
                  className="bg-foreground/[0.04] px-2 py-1 text-right text-sm tabular-nums text-muted-foreground"
                >
                  {!tiene
                    ? "—"
                    : formatCantidad(bultosDe(item, materialDe(item, medido))?.exacto ?? 0)}
                </td>
              )}

              {conversionDe(item) !== null && (
                // El material del nivel. No se puede escribir: sale de lo medido
                // y pisarlo a mano rompería la única regla del módulo, que es
                // que ningún total se carga a dedo.
                <td
                  title={`${item.nombre} en ${fila.nombre}, en la unidad en que se compra`}
                  className="bg-foreground/[0.05] px-2 py-1 text-right text-sm font-medium tabular-nums"
                >
                  {!tiene ? "—" : formatCantidad(materialDe(item, medido) ?? 0)}
                </td>
              )}

              {puertas &&
                // Los cajones (C10, C15) de esta celda. Van en la misma fila
                // que la cantidad de puertas, pero son un número aparte: se
                // puede cargar uno sin el otro. Derivada o desglosada
                // (varios renglones) muestran la suma de solo lectura, igual
                // que la columna de puertas: no hay una fila obvia a la que
                // mandar un número tipeado ahí.
                (derivada || desglosada ? (
                  <Fragment>
                    <td
                      title={`Suma de los cajones C10 de ${item.nombre} en ${fila.nombre}`}
                      className="bg-foreground/[0.04] px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {formatCantidad(cajonesEnFila(item, fila.clave, "cajonC10"))}
                    </td>
                    <td
                      title={`Suma de los cajones C15 de ${item.nombre} en ${fila.nombre}`}
                      className="bg-foreground/[0.04] px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {formatCantidad(cajonesEnFila(item, fila.clave, "cajonC15"))}
                    </td>
                  </Fragment>
                ) : (
                  <Fragment>
                    <td className="bg-foreground/[0.04] px-1 py-0.5">
                      <CeldaCajon
                        proyectoId={proyectoId}
                        item={item}
                        fila={fila.clave}
                        filaNombre={fila.nombre}
                        campo="cajonC10"
                        etiqueta="C10"
                        valor={
                          renglones.some((m) => m.cajonC10 !== null)
                            ? cajonesEnFila(item, fila.clave, "cajonC10")
                            : null
                        }
                        onSaved={onItemSaved}
                      />
                    </td>
                    <td className="bg-foreground/[0.04] px-1 py-0.5">
                      <CeldaCajon
                        proyectoId={proyectoId}
                        item={item}
                        fila={fila.clave}
                        filaNombre={fila.nombre}
                        campo="cajonC15"
                        etiqueta="C15"
                        valor={
                          renglones.some((m) => m.cajonC15 !== null)
                            ? cajonesEnFila(item, fila.clave, "cajonC15")
                            : null
                        }
                        onSaved={onItemSaved}
                      />
                    </td>
                  </Fragment>
                ))}
            </Fragment>
          );
        })}

        {totalPorPiso && (
          <td
            title={`Suma de todos los ítems de esta sección en ${fila.nombre}`}
            className="border-l bg-foreground/[0.04] px-2 py-1 text-right text-sm font-semibold tabular-nums"
          >
            {!tieneAlgo ? "—" : formatCantidad(totalFila)}
          </td>
        )}
      </tr>

      {itemAbierto && (
        <tr className="border-b bg-muted/50 duration-150 animate-in fade-in">
          <td colSpan={columnas} className="px-3 py-2">
            <DetalleCelda
              proyectoId={proyectoId}
              item={itemAbierto}
              fila={fila.clave}
              filaNombre={fila.nombre}
              onSaved={onItemSaved}
              onCerrar={() => onAbrir(null)}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * El desglose de una celda: de dónde sale el número.
 *
 * "38 m³ de bases en la planta baja" no se revisa; "Base B1 — 12, Base B2 — 14,
 * Base B3 — 12" sí, y cuando el estructuralista cambia una base se corrige esa
 * y el total se rehace solo.
 *
 * Cada renglón es una descripción y el número ya hecho, sin largo × ancho ×
 * alto. El volumen de cada base viene calculado de la planilla del
 * estructuralista, y pedir las tres medidas obligaría a rehacer a mano una
 * cuenta que ya está hecha. El costo, dicho de frente: después no se puede
 * revisar de dónde salió ese 0,58.
 */
/**
 * Las columnas del despiece, en grid y no en flex.
 *
 * En flex, lo único que crece es la descripción: los números quedan
 * apretados contra el borde derecho, uno pegado al otro, sin importar cuánto
 * ancho sobre. En grid cada columna tiene su lugar fijo y los números quedan
 * repartidos bajo su rótulo del encabezado, igual en el renglón nuevo que en
 * cada uno ya cargado.
 *
 * El hierro suma dos columnas (barras y kilos) que el resto de los ítems no
 * tiene; de ahí que haya dos planillas distintas y no una con columnas vacías
 * para todos.
 */
function columnasDetalle(hierro: boolean) {
  return hierro
    ? "grid-cols-[1fr_6.5rem_6.5rem_6.5rem_1.75rem]"
    : "grid-cols-[1fr_6.5rem_1.75rem]";
}

function DetalleCelda({
  proyectoId,
  item,
  fila,
  filaNombre,
  onSaved,
  onCerrar,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  onSaved: (item: ItemOpcion) => void;
  onCerrar: () => void;
}) {
  const renglones = medicionesDeFila(item, fila);
  const hierro = esHierro(item);

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {item.nombre} · {filaNombre}
      </p>

      {/* El rótulo de cada columna, alineado con el mismo grid que usa cada
          renglón de abajo: así se lee de entrada en qué medida está cada
          número, sin tener que adivinarlo o pasar el mouse por arriba. */}
      <div
        className={cn(
          "grid items-end gap-2 px-2 text-[10px] font-medium text-muted-foreground",
          columnasDetalle(hierro)
        )}
      >
        <span />
        <span className="text-right">{simboloUnidad(item.unidad)}</span>
        {hierro && <span className="text-right">barras</span>}
        {hierro && <span className="text-right">kg</span>}
        <span />
      </div>

      {renglones.map((medicion) => (
        <RenglonDetalle
          key={medicion.id}
          proyectoId={proyectoId}
          item={item}
          medicion={medicion}
          onSaved={onSaved}
        />
      ))}

      <RenglonNuevo
        proyectoId={proyectoId}
        item={item}
        fila={fila}
        // El primer renglón de una celda que ya tenía un número suelto se suma
        // al que había: el total no cambia de golpe, se desglosa.
        onSaved={onSaved}
        onCerrar={onCerrar}
      />
    </div>
  );
}

/** Un renglón del desglose: descripción, número y tacho. */
function RenglonDetalle({
  proyectoId,
  item,
  medicion,
  onSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  medicion: MedicionOpcion;
  onSaved: (item: ItemOpcion) => void;
}) {
  const [descripcion, setDescripcion] = useState(medicion.descripcion ?? "");
  const [valor, setValor] = useState(medidaATexto(medicion.cantidad));
  const [prev, setPrev] = useState(medicion);
  const [pending, startTransition] = useTransition();

  if (medicion !== prev) {
    setPrev(medicion);
    setDescripcion(medicion.descripcion ?? "");
    setValor(medidaATexto(medicion.cantidad));
  }

  // Los renglones viejos, los que se cargaron con largo × ancho × alto desde el
  // diálogo de medidas, aportan al total algo distinto de su cantidad. Se
  // muestra lo que aportan para que el número de la celda no parezca mal sumado.
  const aporta = parcialMedicion(medicion, item.unidad);
  const conMedidas = Math.abs(aporta - medicion.cantidad) > 0.0001;

  // Para el hierro, de los metros de este renglón salen la cantidad de barras
  // y los kilos: es la misma cuenta que arma la celda de la grilla general,
  // aplicada a lo que aporta esta base en vez de al total del nivel. Sin
  // redondear, como toda cuenta que no es el total de la obra (ver bultosDe).
  const hierro = esHierro(item);
  const kg = hierro ? materialDe(item, aporta) ?? 0 : null;
  const barras = hierro ? barrasDeMetros(item, aporta) : null;

  const guardar = () => {
    const limpio = descripcion.trim();
    const numero = parseMedida(valor.trim());
    if (limpio === (medicion.descripcion ?? "") && numero === medicion.cantidad) return;

    if (!limpio) {
      toast.error("Poné un nombre para el renglón.");
      setDescripcion(medicion.descripcion ?? "");
      return;
    }
    if (numero === null) {
      toast.error("Escribí un número mayor a 0.");
      setValor(medidaATexto(medicion.cantidad));
      return;
    }

    startTransition(async () => {
      const result = await guardarDetalle(proyectoId, medicion.id, limpio, numero);
      if (!result.success) {
        toast.error(result.error);
        setDescripcion(medicion.descripcion ?? "");
        setValor(medidaATexto(medicion.cantidad));
        return;
      }
      onSaved(result.item);
    });
  };

  const borrar = () =>
    startTransition(async () => {
      const result = await borrarDetalle(proyectoId, medicion.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
    });

  return (
    <div className={cn("grid items-center gap-2", columnasDetalle(hierro))}>
      <input
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="Descripción"
        aria-label="Descripción del renglón"
        disabled={pending}
        className="min-w-0 rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm transition-colors duration-150 hover:border-input focus:border-ring focus:bg-background focus:outline-none"
      />
      {/* El valor tipeado y, si corresponde, lo que aporta debajo: van juntos
          en la misma columna porque son la misma medida, una cargada y otra
          calculada a partir de ella (ver el comentario de `aporta` arriba). */}
      <span className="flex flex-col items-end">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          inputMode="decimal"
          aria-label="Cantidad del renglón"
          disabled={pending}
          className="w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums transition-colors duration-150 hover:border-input focus:border-ring focus:bg-background focus:outline-none"
        />
        {conMedidas && (
          <span className="pr-2 text-right text-[10px] text-muted-foreground tabular-nums">
            = {formatCantidad(aporta)}
          </span>
        )}
      </span>
      {hierro && (
        <span
          title={`${formatCantidad(aporta)} m ÷ 12 m por barra`}
          className="text-right text-sm text-muted-foreground tabular-nums"
        >
          {formatCantidad(barras ?? 0)}
        </span>
      )}
      {hierro && (
        <span
          title={`${formatCantidad(barras ?? 0)} barras × ${formatCantidad(item.porBulto ?? 0)} kg cada una`}
          className="text-right text-sm text-muted-foreground tabular-nums"
        >
          {formatCantidad(kg ?? 0)}
        </span>
      )}
      <Tooltip content={`Eliminar ${medicion.descripcion ?? "renglón"}`}>
        <button
          type="button"
          aria-label={`Eliminar ${medicion.descripcion ?? "renglón"}`}
          onClick={borrar}
          disabled={pending}
          className="justify-self-end rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * La línea para sumar un renglón al desglose.
 *
 * Queda siempre abierta y con foco en la descripción, al revés que la fila
 * extra de la sección: acá cargar varios seguidos es lo normal —una obra tiene
 * ocho bases, no una— y esconder el campo detrás de un botón agregaría un click
 * por base.
 */
function RenglonNuevo({
  proyectoId,
  item,
  fila,
  onSaved,
  onCerrar,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  onSaved: (item: ItemOpcion) => void;
  onCerrar: () => void;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [valor, setValor] = useState("");
  const [pending, startTransition] = useTransition();
  const hierro = esHierro(item);

  const agregar = () => {
    const limpio = descripcion.trim();
    const numero = parseMedida(valor.trim());
    if (!limpio) {
      toast.error("Poné un nombre para el renglón.");
      return;
    }
    if (numero === null) {
      toast.error("Escribí un número mayor a 0.");
      return;
    }

    startTransition(async () => {
      const result = await agregarDetalle(proyectoId, item.id, fila, limpio, numero);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
      setDescripcion("");
      setValor("");
    });
  };

  return (
    // El botón va en su propia fila, no adentro del grid de las columnas: ahí
    // adentro sólo tenía la columna del tacho (1,75rem) para acomodarse —la
    // que le sobra a un renglón ya guardado, que no tiene botón de agregar— y
    // "+ Agregar" no entraba, así que se superponía con la columna de al
    // lado. Separado así nunca se pisa con nada, haya o no columnas extra de
    // hierro.
    <div className="space-y-1 pt-1">
      <div className={cn("grid items-center gap-2", columnasDetalle(hierro))}>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
            if (e.key === "Escape") onCerrar();
          }}
          placeholder="Descripción"
          aria-label="Descripción del renglón nuevo"
          className="min-w-0 rounded-sm border border-input bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none"
        />
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
            if (e.key === "Escape") onCerrar();
          }}
          inputMode="decimal"
          placeholder="0,58"
          aria-label="Cantidad del renglón nuevo"
          className="rounded-sm border border-input bg-background px-2 py-1 text-right text-sm tabular-nums focus:border-ring focus:outline-none"
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={agregar}>
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </div>
  );
}

/**
 * Las subcolumnas de un ítem: lo medido, lo medido con la merma, los bultos
 * (si se compra agrupado) y el material.
 *
 * El porcentaje y el rinde van acá arriba, en el encabezado, y no repetidos en
 * cada celda: son propiedades del ítem, y verlos quince veces hacia abajo no
 * agrega nada. De paso el encabezado deja la cuenta a la vista —"medido",
 * "+10%", "×15 un"— así que la tercera columna no aparece como un número
 * mágico: se lee de izquierda a derecha de dónde salió.
 *
 * Las últimas tres aparecen sólo si el ítem las tiene. Una columna que repite
 * exactamente el número de al lado es una columna que no dice nada.
 */
function Subencabezados({
  item,
  puertas,
}: {
  item: ItemOpcion;
  /** Si esta sección es PUERTAS: dos columnas más, C10 y C15, los cajones. */
  puertas: boolean;
}) {
  const conversion = conversionDe(item);

  const cajones = puertas && (
    <Fragment>
      <th
        title="Cajones chicos (C10) de este ítem en esta fila"
        className="bg-foreground/[0.04] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
      >
        C10
      </th>
      <th
        title="Cajones grandes (C15) de este ítem en esta fila"
        className="bg-foreground/[0.04] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
      >
        C15
      </th>
    </Fragment>
  );

  // El hierro va en tres subcolumnas, ml, barras y kg, una al lado de la
  // otra: las tres se pueden tipear y se mantienen sincronizadas entre sí
  // (ver CeldaHierro). Barras y kg llevan fondo gris como las demás columnas
  // calculadas, aunque acá también se pueda escribir directamente.
  if (esHierro(item)) {
    return (
      <Fragment>
        <th
          title="Lo que se mide en obra, en metros lineales. Se puede completar acá, en barras o en kg: lo que no se toque sale solo de lo que sí."
          className="border-l px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
        >
          ml
        </th>
        <th
          title={`Cantidad de barras de 12 m, de ${formatCantidad(item.porBulto!)} kg cada una. Se puede completar acá, en ml o en kg: lo que no se toque sale solo de lo que sí.`}
          className="bg-foreground/[0.04] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
        >
          barras
        </th>
        <th
          title="Peso total del hierro, en kilos. Se puede completar acá, en ml o en barras: lo que no se toque sale solo de lo que sí."
          className="bg-foreground/[0.04] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
        >
          kg
        </th>
        {cajones}
      </Fragment>
    );
  }

  return (
    <Fragment>
      {/* El rótulo de esta primera columna es la unidad en la que se carga
          ("ml", "m²", "kg"...) y no la palabra genérica "medido": así queda
          claro de entrada qué es lo único que hay que tipear. */}
      <th
        title={`Lo que se carga a mano, en ${UNIDAD_INFO[item.unidad].nombre.toLowerCase()}`}
        className="border-l px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
      >
        {simboloUnidad(item.unidad)}
      </th>
      {item.desperdicio !== null && (
        <th className="px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground">
          +{formatCantidad(item.desperdicio)}%
        </th>
      )}
      {tieneBultos(item) && (
        <th
          title={`Cantidad de ${etiquetaBultos([item])}, de ${formatCantidad(item.porBulto!)} ${simboloUnidad(item.rindeUnidad!)} cada una`}
          className="bg-foreground/[0.04] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
        >
          {etiquetaBultos([item])}
        </th>
      )}
      {conversion && (
        // El rótulo es la unidad del material ("kg"), no la fórmula: la
        // fórmula (cuánto rinde cada unidad medida) queda en el title, para
        // quien la quiera ver sin ocupar el ancho de la columna.
        <th
          title={`Cada ${simboloUnidad(item.unidad)} son ${formatCantidad(conversion.rinde)} ${simboloUnidad(conversion.unidad)}`}
          className="bg-foreground/[0.05] px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
        >
          {simboloUnidad(conversion.unidad)}
        </th>
      )}
      {cajones}
    </Fragment>
  );
}
