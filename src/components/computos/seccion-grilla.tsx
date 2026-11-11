"use client";

import {
  Fragment,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  horizontalListSortingStrategy,
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
  crearSubItem,
  eliminarFilaExtra,
  eliminarSeccion,
  eliminarSubItem,
  guardarCelda,
  guardarDetalle,
  guardarSubItemCelda,
  renombrarFilaExtra,
  renombrarSeccion,
  renombrarSubItem,
  reordenarFilasSeccion,
  reordenarItems,
} from "@/actions/computos";
import { eliminarNivel, renombrarNivel } from "@/actions/niveles-proyecto";
import {
  barrasDeMetros,
  bultosDe,
  claveFilaKey,
  conDesperdicio,
  conversionDe,
  esDerivadaEnFila,
  esFormula,
  esHierro,
  esSeccionMamposteria,
  esSeccionPuertas,
  etiquetaBultos,
  mayuscula,
  evaluarFormula,
  formatCantidad,
  formulaATexto,
  formulaDeMedicion,
  kgDeMetros,
  materialDe,
  medicionesDeFila,
  medidaATexto,
  medidoEnFila,
  metrosDeBarras,
  metrosDeKg,
  normalizarFormula,
  ordenarFilas,
  parcialMedicion,
  parseMedida,
  simboloUnidad,
  subItemEnFila,
  subItemMedicionesDeFila,
  subItemsEnFila,
  tieneBultos,
  tieneMedidoEnFila,
  totalSubItem,
  UNIDAD_INFO,
  type ClaveFila,
  type FilaExtraOpcion,
  type ItemOpcion,
  type MedicionOpcion,
  type SeccionOpcion,
  type SubItemOpcion,
} from "@/lib/computos";
import { SIN_NIVEL, type NivelOpcion } from "@/lib/niveles";
import { cn } from "@/lib/utils";

/** Una fila de la grilla, ya lista para dibujar. */
type Fila = { clave: ClaveFila; nombre: string };

/** Qué celda tiene el detalle abierto. Una sola a la vez en toda la grilla. */
type CeldaAbierta = { itemId: string; filaKey: string };

/**
 * El estado de una celda que se escribe a mano y puede llevar una fórmula
 * (Albañilería de Cómputos 2, ver `aceptaFormulas`).
 *
 * Quieta muestra el número, como cualquier celda. Con fórmula, al entrar al
 * campo cambia a la cuenta ("=3,5*2,8") para corregirla, y al salir vuelve
 * al resultado. Escribir un número suelto encima de una fórmula la borra: la
 * celda pasa a ser un número tipeado, como antes.
 *
 * `guardarEn` recibe el número (o null para vaciar) y la fórmula tipeada (o
 * null si no hay); el resultado de la fórmula lo resuelve el servidor.
 */
function useCeldaEditable({
  valor,
  formula,
  conFormulas,
  guardarEn,
}: {
  valor: number | null;
  formula: string | null;
  conFormulas: boolean;
  guardarEn: (numero: number | null, formula: string | null) => Promise<boolean>;
}) {
  const inicial = valor === null ? "" : medidaATexto(valor);
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [prev, setPrev] = useState({ valor, formula });
  const [pending, startTransition] = useTransition();

  if (valor !== prev.valor || formula !== prev.formula) {
    setPrev({ valor, formula });
    setTexto(inicial);
    setGuardado(inicial);
  }

  const conFormula = conFormulas && formula !== null;
  const textoFormula = formula === null ? "" : formulaATexto(formula);

  const alEnfocar = () => {
    if (conFormula) setTexto(textoFormula);
  };

  // Escape descarta lo tipeado: el blur que sigue no tiene que guardar nada.
  const cancelado = useRef(false);

  const guardar = () => {
    if (cancelado.current) {
      cancelado.current = false;
      setTexto(guardado);
      return;
    }
    const limpio = texto.trim();

    if (conFormulas && esFormula(limpio)) {
      // La misma fórmula que ya estaba: no hay nada que guardar, sólo se
      // vuelve a mostrar el resultado.
      if (conFormula && normalizarFormula(limpio) === formula) {
        setTexto(guardado);
        return;
      }
      if (evaluarFormula(limpio) === null) {
        toast.error("La fórmula no se entiende o no da un número mayor a 0.");
        setTexto(guardado);
        return;
      }
      startTransition(async () => {
        const ok = await guardarEn(null, limpio);
        if (!ok) setTexto(guardado);
      });
      return;
    }

    // Sin cambios: el número de siempre, o la fórmula que se mostró al
    // entrar y no se tocó (eso ya lo atajó el bloque de arriba).
    if (limpio === guardado && !conFormula) {
      setTexto(guardado);
      return;
    }
    // Con fórmula, cualquier número tipeado (aunque sea el mismo que daba la
    // cuenta) se guarda: la celda pasa a ser un número suelto, sin fórmula.

    const numero = limpio === "" ? null : parseMedida(limpio);
    if (limpio !== "" && numero === null) {
      toast.error(
        conFormulas
          ? "Escribí un número mayor a 0, o una fórmula que empiece con =."
          : "Escribí un número mayor a 0."
      );
      setTexto(guardado);
      return;
    }

    setGuardado(limpio);
    startTransition(async () => {
      const ok = await guardarEn(numero, null);
      if (!ok) {
        setTexto(guardado);
        setGuardado(guardado);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      cancelado.current = true;
      e.currentTarget.blur();
    }
  };

  return {
    inputProps: {
      value: texto,
      onChange: (e: ChangeEvent<HTMLInputElement>) => setTexto(e.target.value),
      onFocus: alEnfocar,
      onBlur: guardar,
      onKeyDown,
      inputMode: conFormulas ? ("text" as const) : ("decimal" as const),
      placeholder: "—",
      disabled: pending,
    },
    conFormula,
    textoFormula,
  };
}

/** Clase común de las celdas editables. Con fórmula, el número va subrayado de puntos. */
function claseCelda(conFormula: boolean) {
  return cn(
    "w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-center text-sm tabular-nums",
    "transition-colors duration-150",
    "hover:border-input focus:border-ring focus:bg-background focus:outline-none",
    "placeholder:text-muted-foreground",
    conFormula && "underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 focus:no-underline"
  );
}

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
  formula = null,
  conFormulas = false,
  onSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  /** Lo medido, o null si esta celda todavía no tiene ninguna fila. */
  valor: number | null;
  /** La fórmula con la que se cargó, si se cargó con una. */
  formula?: string | null;
  /** Si esta celda acepta fórmulas (ver `aceptaFormulas`). */
  conFormulas?: boolean;
  onSaved: (item: ItemOpcion) => void;
}) {
  const { inputProps, conFormula, textoFormula } = useCeldaEditable({
    valor,
    formula,
    conFormulas,
    guardarEn: async (numero, formulaTexto) => {
      const result = await guardarCelda(proyectoId, item.id, fila, numero, formulaTexto);
      if (!result.success) {
        toast.error(result.error);
        return false;
      }
      onSaved(result.item);
      return true;
    },
  });

  return (
    <input
      {...inputProps}
      title={conFormula ? `Fórmula: ${textoFormula}` : undefined}
      aria-label={`${item.nombre} en ${filaNombre}`}
      className={claseCelda(conFormula)}
    />
  );
}

/**
 * Una celda de sub ítem, sólo en los ítems de la grilla de PUERTAS.
 *
 * Va aparte de cualquier otra cantidad de la celda: cada sub ítem es
 * independiente de los demás, así que se puede cargar uno sin tener los
 * otros todavía. Mismo comportamiento que `Celda` —se guarda al salir del
 * campo, vacío borra— pero llama a `guardarSubItemCelda` en vez de
 * `guardarCelda`, y está atada a un sub ítem puntual en vez de al ítem.
 */
function CeldaSubItem({
  proyectoId,
  item,
  subItem,
  fila,
  filaNombre,
  valor,
  formula = null,
  conFormulas = false,
  onSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  subItem: SubItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  /** Lo cargado, o null si esta celda todavía no tiene ninguna fila. */
  valor: number | null;
  /** La fórmula con la que se cargó, si se cargó con una. */
  formula?: string | null;
  /** Si esta celda acepta fórmulas (ver `aceptaFormulas`). */
  conFormulas?: boolean;
  onSaved: (item: ItemOpcion) => void;
}) {
  const { inputProps, conFormula, textoFormula } = useCeldaEditable({
    valor,
    formula,
    conFormulas,
    guardarEn: async (numero, formulaTexto) => {
      const result = await guardarSubItemCelda(proyectoId, subItem.id, fila, numero, formulaTexto);
      if (!result.success) {
        toast.error(result.error);
        return false;
      }
      onSaved(result.item);
      return true;
    },
  });

  return (
    <input
      {...inputProps}
      title={
        conFormula
          ? `${subItem.nombre} — fórmula: ${textoFormula}`
          : `${item.nombre} en ${filaNombre}: ${subItem.nombre}`
      }
      aria-label={`${item.nombre} en ${filaNombre}, ${subItem.nombre}`}
      className={claseCelda(conFormula)}
    />
  );
}

/**
 * Una celda de hierro que no se mide directamente: "barras" o "kg". Lo que
 * se tipea se convierte a metros antes de guardar —es la única unidad que
 * entiende `guardarCelda`— con la conversión del ítem.
 *
 * A diferencia de la vieja celda de hierro (que tenía los tres campos
 * apilados adentro de una sola columna), ahora cada unidad es su propia fila
 * de la tabla: esta celda vive sola, y la de metros lineales es la celda
 * común `Celda` de más arriba, sin conversión.
 */
function CeldaHierroConvertida({
  proyectoId,
  item,
  fila,
  filaNombre,
  valor,
  unidad,
  aTexto,
  aMetros,
  onSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  /** Lo medido en metros, o null si esta celda todavía no tiene ninguna fila. */
  valor: number | null;
  /** Nombre de la unidad de esta celda, para el título y el aria-label. */
  unidad: string;
  aTexto: (metros: number) => string;
  aMetros: (n: number) => number;
  onSaved: (item: ItemOpcion) => void;
}) {
  const inicial = valor === null ? "" : aTexto(valor);
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
      const metros = numero === null ? null : aMetros(numero);
      const result = await guardarCelda(proyectoId, item.id, fila, metros);
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
      title={`${item.nombre} en ${filaNombre}, en ${unidad}`}
      aria-label={`${item.nombre} en ${filaNombre}, en ${unidad}`}
      disabled={pending}
      className={cn(
        "w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-center text-sm tabular-nums",
        "transition-colors duration-150",
        "hover:border-input focus:border-ring focus:bg-background focus:outline-none",
        "placeholder:text-muted-foreground"
      )}
    />
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
    // El lápiz y el tacho van absolutos, apoyados en el borde derecho: en el
    // flujo normal ocupan lugar aunque estén invisibles (opacity-0) y corren
    // el nombre hacia la izquierda del centro real de la columna.
    <span className="group relative block w-full">
      {/* Sin truncate: el nombre del nivel se lee entero y si no entra, baja
          de renglón. Es la etiqueta de la fila; cortada no sirve. */}
      <span className="block w-full leading-tight break-words">{fila.nombre}</span>
      <span className="absolute top-1/2 right-0 flex -translate-y-1/2 gap-0.5">
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
    // Mismo truco que en `FilaExtraNombre`: el tacho va absoluto para no
    // correr el nombre del nivel del centro de la columna.
    <span className="group relative block w-full">
      {/* Sin truncate: el nombre del nivel se lee entero y si no entra, baja
          de renglón. Es la etiqueta de la fila; cortada no sirve. */}
      <span
        onDoubleClick={() => setEditando(true)}
        title="Doble clic para renombrar"
        className="block w-full cursor-text leading-tight break-words"
      >
        {nivel.nombre}
      </span>
      <Tooltip content={`Eliminar ${nivel.nombre}`}>
        <button
          type="button"
          aria-label={`Eliminar ${nivel.nombre}`}
          onClick={borrar}
          className="absolute top-1/2 right-0 shrink-0 -translate-y-1/2 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
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
 * Una sección del cómputo, como grilla: los ítems en fila, los niveles al costado.
 *
 * Lo que crece sin límite al cargar un cómputo es la lista de ítems, no la de
 * niveles —una obra tiene media docena de plantas y puede tener cuarenta
 * ítems—, así que los niveles van en columnas, fijas, y los ítems en filas:
 * agregar el ítem cuarenta y uno suma un renglón abajo, no corre toda la
 * tabla para el costado. Las columnas se leen en el orden en que se construye
 * la obra, de abajo hacia arriba.
 *
 * Un ítem puede tener más de un valor —hierro mide en metros, barras y kilos
 * a la vez; una puerta suma además una fila por cada sub ítem que tenga—, y
 * cada uno de esos valores es una fila de verdad (ver `lineasDeItem` y `FilaItem`), con su
 * propia etiqueta a la izquierda: así el alto de la fila lo pone el
 * navegador, igual para la etiqueta que para los datos, en vez de calcularlo
 * a mano.
 *
 * A la derecha de todo, el total de cada ítem en toda la obra. No hay total
 * de columna (de nivel): cada celda es de un ítem en un piso, y nada más.
 *
 * La grilla entra siempre en el ancho de la página y nunca scrollea a lo
 * ancho más que lo que fuerzan los niveles —que no crecen al cargar el
 * cómputo—, así que el ancho de la tabla queda estable aunque se agreguen
 * cien ítems.
 */

/**
 * El encabezado de una columna: un nivel, una fila extra o "Toda la obra". Se
 * arrastra entera del agarre de arriba, con desplazamiento horizontal —el
 * arrastre de los ítems, en cambio, es vertical: ver `FilaItem`.
 */
function EncabezadoFila({
  proyectoId,
  fila,
  extra,
  arrastrable,
  onFilaExtraSaved,
  onFilaExtraDeleted,
  onNivelSaved,
  onNivelDeleted,
}: {
  proyectoId: string;
  fila: Fila;
  /** La fila extra, si esta columna es una. Los niveles no tienen. */
  extra: FilaExtraOpcion | undefined;
  arrastrable: boolean;
  onFilaExtraSaved: (fila: FilaExtraOpcion) => void;
  onFilaExtraDeleted: (id: string) => void;
  onNivelSaved: (nivel: NivelOpcion) => void;
  onNivelDeleted: (id: string) => void;
}) {
  const filaKey = claveFilaKey(fila.clave);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filaKey,
    disabled: !arrastrable,
  });

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative border-l px-2 py-2 text-center align-middle text-xs font-semibold",
        isDragging && "z-10 bg-background opacity-90 shadow-lg"
      )}
    >
      {/* El agarre va absoluto, no en el flujo: así no corre el nombre del
          medio milímetro que pesa su ancho, y todas las columnas —tengan o
          no de qué agarrarse— quedan centradas exactamente igual. */}
      {arrastrable && (
        <Tooltip content="Arrastrar para reordenar">
          <button
            type="button"
            aria-label={`Arrastrar ${fila.nombre}`}
            className="absolute top-1/2 left-1 shrink-0 -translate-y-1/2 touch-none cursor-grab text-muted-foreground/60 transition-colors duration-150 hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
      <span className="block w-full px-4">
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
          <span className="block w-full leading-tight break-words">{fila.nombre}</span>
        )}
      </span>
    </th>
  );
}

/**
 * Una línea de la fila de un ítem: una unidad (lo medido, la merma, los
 * bultos, el material, cada cajón...) con su etiqueta y, para esa unidad, el
 * contenido de la celda de cada columna y del total.
 *
 * Cada línea es su propia fila de la tabla (ver `FilaItem`): la etiqueta y
 * el dato quedan en el mismo `<tr>`, alineados porque los pone el navegador
 * —la fila mide lo que mide su celda más alta— y no porque un padding
 * haya quedado igual que otro a mano.
 */
/**
 * La columna de Total va toda con el mismo peso de letra que la fila de
 * títulos: cada línea trae su propio `font-medium` o ninguno, y se
 * pisan todos acá para que la columna se lea pareja.
 */
const TOTAL_COL = "font-semibold [&_*]:font-semibold";

type LineaItem = {
  key: string;
  etiqueta: ReactNode;
  /** Si esta línea tiene la flechita para abrir el detalle de la celda. */
  conChevron?: boolean;
  /** Si esta línea es la de un sub ítem: es lo único que esconde la flechita de desplegar/ocultar de la fila de título. */
  esSubItem?: boolean;
  celda: (fila: Fila) => ReactNode;
  /** La celda de la columna de Total: la suma de esta línea en todos los niveles. */
  total: () => ReactNode;
};

/**
 * El nombre de un sub ítem, editable en el lugar. Mismo patrón que
 * `FilaExtraNombre` (lápiz y tacho visibles al pasar el mouse), pero crear,
 * renombrar y borrar un sub ítem devuelven el ítem entero —no el sub ítem
 * suelto ni un id— porque lo que se repinta siempre es el bloque completo del
 * ítem (ver `lineasSubItems`), con su total ya al día.
 */
function SubItemNombre({
  proyectoId,
  subItem,
  onSaved,
}: {
  proyectoId: string;
  subItem: SubItemOpcion;
  onSaved: (item: ItemOpcion) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(subItem.nombre);
  const [prev, setPrev] = useState(subItem);
  const [, startTransition] = useTransition();

  if (subItem !== prev) {
    setPrev(subItem);
    setNombre(subItem.nombre);
  }

  const guardar = () => {
    setEditando(false);
    const limpio = nombre.trim();
    if (limpio === subItem.nombre) return;
    // Vaciar el campo es un tipeo a medias, no un pedido de borrar: se vuelve
    // al nombre anterior en vez de mandar un nombre vacío al servidor.
    if (limpio === "") {
      setNombre(subItem.nombre);
      return;
    }

    startTransition(async () => {
      const result = await renombrarSubItem(proyectoId, subItem.id, limpio);
      if (!result.success) {
        toast.error(result.error);
        setNombre(subItem.nombre);
        return;
      }
      onSaved(result.item);
    });
  };

  const borrar = () =>
    startTransition(async () => {
      const result = await eliminarSubItem(proyectoId, subItem.id);
      if (!result.success) {
        // Si está bloqueado por celdas cargadas, se ofrece forzar el borrado
        // (se pierden esas celdas) en vez de dejar el botón sin efecto visible.
        if (
          result.error.includes("celda") &&
          window.confirm(
            `${result.error}\n\n¿Eliminar "${subItem.nombre}" igual, perdiendo esas celdas cargadas?`
          )
        ) {
          const forzado = await eliminarSubItem(proyectoId, subItem.id, true);
          if (!forzado.success) {
            toast.error(forzado.error);
            return;
          }
          onSaved(forzado.item);
          return;
        }
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
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
            setNombre(subItem.nombre);
            setEditando(false);
          }
        }}
        aria-label="Nombre del sub ítem"
        autoFocus
        className="w-full min-w-0 rounded-sm border border-input bg-background px-1 py-0.5 text-sm focus:border-ring focus:outline-none"
      />
    );
  }

  return (
    <span className="group flex min-w-0 flex-1 items-start gap-1">
      <span className="min-w-0 flex-1 leading-tight break-words">{subItem.nombre}</span>
      <Tooltip content={`Renombrar ${subItem.nombre}`}>
        <button
          type="button"
          aria-label={`Renombrar ${subItem.nombre}`}
          onClick={() => setEditando(true)}
          className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </Tooltip>
      <Tooltip content={`Eliminar ${subItem.nombre}`}>
        <button
          type="button"
          aria-label={`Eliminar ${subItem.nombre}`}
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
 * El campo para sumar un sub ítem a este ítem: un campo de texto con
 * Agregar/Cancelar, igual que antes. Lo nuevo es que el "+" que lo abre ya
 * no vive acá —vive junto al título del ítem, como el lápiz de editar (ver
 * `FilaItem`)— porque ese "+" y este campo quedan en lugares distintos de la
 * fila (uno inline con el nombre, el otro en su propio renglón, debajo). Por
 * eso el estado de si está abierto lo maneja `FilaItem` y entra acá por
 * props, no queda local.
 */
function AgregarSubItem({
  proyectoId,
  item,
  onSaved,
  onCerrar,
}: {
  proyectoId: string;
  item: ItemOpcion;
  onSaved: (item: ItemOpcion) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();

  const guardar = () => {
    const limpio = nombre.trim();
    if (!limpio) return;

    startTransition(async () => {
      const result = await crearSubItem(proyectoId, item.id, limpio);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved(result.item);
      setNombre("");
      onCerrar();
    });
  };

  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1">
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
            onCerrar();
          }
        }}
        placeholder="C10"
        aria-label="Nombre del sub ítem nuevo"
        autoFocus
        className="w-full min-w-0 rounded-sm border border-input bg-background px-1 py-0.5 text-xs focus:border-ring focus:outline-none"
      />
      <Tooltip content="Agregar">
        <button
          type="button"
          aria-label="Agregar sub ítem"
          disabled={pending}
          onClick={guardar}
          className="shrink-0 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
        </button>
      </Tooltip>
      <Tooltip content="Cancelar">
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => {
            setNombre("");
            onCerrar();
          }}
          className="shrink-0 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </Tooltip>
    </span>
  );
}

/**
 * Las líneas de los sub ítems de un ítem de PUERTAS: una por cada sub ítem
 * que ya tenga, con su nombre editable y su propio total. Reemplazan a las
 * viejas tres líneas fijas de cajones (C10, C15, C18) por una cantidad libre
 * de renglones con el nombre que elija el que carga el cómputo.
 *
 * El alta de un sub ítem nuevo ya no es una línea más de este listado: es el
 * "+" junto al título del ítem (ver `FilaItem` y `AgregarSubItem`). Por eso
 * esta función puede devolver un array vacío si el ítem todavía no tiene
 * ningún sub ítem cargado.
 */
function lineasSubItems({
  item,
  proyectoId,
  conFormulas,
  onItemSaved,
}: {
  item: ItemOpcion;
  proyectoId: string;
  conFormulas: boolean;
  onItemSaved: (item: ItemOpcion) => void;
}): LineaItem[] {
  const lineas: LineaItem[] = item.subItems.map((subItem) => ({
    key: subItem.id,
    esSubItem: true,
    etiqueta: <SubItemNombre proyectoId={proyectoId} subItem={subItem} onSaved={onItemSaved} />,
    celda: (fila: Fila) => {
      const cargadas = subItemMedicionesDeFila(subItem, fila.clave);
      const cargado = cargadas.length > 0;
      return (
        <CeldaSubItem
          proyectoId={proyectoId}
          item={item}
          subItem={subItem}
          fila={fila.clave}
          filaNombre={fila.nombre}
          valor={cargado ? subItemEnFila(subItem, fila.clave) : null}
          conFormulas={conFormulas}
          onSaved={onItemSaved}
        />
      );
    },
    total: () => {
      const total = totalSubItem(subItem);
      return (
        <span className="block text-center text-sm font-medium tabular-nums">
          {total > 0 ? formatCantidad(total) : "—"}
        </span>
      );
    },
  }));

  return lineas;
}

/**
 * Las líneas de la fila de un ítem (ver `LineaItem`). El hierro siempre
 * tiene tres: ml, barras y kg, los mismos metros en paralelo. El resto
 * arranca con lo medido y agrega merma, bultos y material según tenga
 * desperdicio, se compre agrupado o se compre en otra unidad —salvo en
 * PUERTAS, que no tiene esa primera línea—. Los sub ítems van al final en
 * las dos, sólo en la grilla de PUERTAS (ver `lineasSubItems`).
 */
function lineasDeItem({
  proyectoId,
  item,
  totales,
  puertas,
  mamposteria2,
  conFormulas,
  abierta,
  onAbrir,
  onItemSaved,
}: {
  proyectoId: string;
  item: ItemOpcion;
  totales: Map<string, number>;
  puertas: boolean;
  /**
   * Si es la mampostería de Cómputos 2: no lleva la línea de material
   * (unidades) y los palets van redondeados para arriba en cada casillero.
   */
  mamposteria2: boolean;
  /** Si las celdas que se escriben a mano aceptan fórmulas (ver `aceptaFormulas`). */
  conFormulas: boolean;
  abierta: CeldaAbierta | null;
  onAbrir: (celda: CeldaAbierta | null) => void;
  onItemSaved: (item: ItemOpcion) => void;
}): LineaItem[] {
  const totalBase = totales.get(item.id) ?? 0;
  // "Nada cargado" ya no es sólo "sin mediciones propias": un ítem de
  // PUERTAS (o cualquiera con sub ítems) puede no tener ninguna medición
  // propia y aun así tener algo cargado, en sus sub ítems.
  const vacio =
    item.mediciones.length === 0 && item.subItems.every((si) => si.mediciones.length === 0);
  // Los bultos se redondean para arriba una sola vez, en el total de toda la
  // obra: hacerlo por nivel y después sumar daría de más una vez por planta.
  const bultosTotal = tieneBultos(item) ? bultosDe(item, materialDe(item, totalBase)) : null;

  // Una celda que sale de una cuenta sobre otro ítem no se escribe ni se
  // desglosa: el número viene de otro lado y pisarlo borraría la cuenta sin
  // que se vea.
  const estado = (fila: Fila) => {
    const filaKey = claveFilaKey(fila.clave);
    const tiene = tieneMedidoEnFila(item, fila.clave);
    // `propio` es sólo lo que el ítem tiene cargado a mano en esta fila —lo
    // único que una celda editable puede mostrar y guardar sin pisar datos
    // de otro lado—; `medido` suma además los sub ítems de esta fila, igual
    // que el Total ya suma `totalSubItems` (ver `calcularTotales`), para que
    // la fila de título muestre siempre el mismo número agregado.
    const propio = medidoEnFila(item, fila.clave, totales);
    const subTotal = subItemsEnFila(item, fila.clave);
    const medido = propio + subTotal;
    const renglones = medicionesDeFila(item, fila.clave);
    const derivada = esDerivadaEnFila(item, fila.clave);
    // Con sub ítems de por medio el número deja de ser un valor suelto: se
    // trata igual que una celda desglosada (de sólo lectura, con el detalle
    // al tocarla) para no exponer una celda editable cuyo valor ya no sería
    // sólo lo que se guardaría al tipear.
    const desglosada = renglones.length > 1 || subTotal > 0;
    const abierto = abierta?.itemId === item.id && abierta.filaKey === filaKey;
    const alternar = () => onAbrir(abierto ? null : { itemId: item.id, filaKey });
    return { tiene, medido, propio, derivada, desglosada, abierto, alternar };
  };

  if (esHierro(item)) {
    // Lo que se lee en barras/kg por nivel es la cantidad sin redondear,
    // como toda celda de nivel (ver bultosDe): el redondeo es sólo del total.
    const barrasEnNivel = (ml: number) =>
      formatCantidad(bultosDe(item, materialDe(item, ml))?.exacto ?? 0);
    const kgEnNivel = (ml: number) => formatCantidad(materialDe(item, ml) ?? 0);

    const lineas: LineaItem[] = [
      {
        key: "ml",
        etiqueta: (
          <span title="Lo que se mide en obra, en metros lineales. Se puede completar en ml, en barras o en kg: lo que no se toque sale solo de lo que sí.">
            ml
          </span>
        ),
        celda: (fila) => {
          const { tiene, medido, derivada, desglosada, abierto, alternar } = estado(fila);
          if (derivada) {
            return (
              <span
                title="Sale de una cuenta sobre otro ítem"
                className="block text-center text-sm tabular-nums text-muted-foreground italic"
              >
                {formatCantidad(medido)}
              </span>
            );
          }
          if (desglosada) {
            return (
              <Tooltip content="Metros, sin redondear. Tocá para ver el detalle de cada renglón.">
                <button
                  type="button"
                  aria-expanded={abierto}
                  aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                  onClick={alternar}
                  className="w-full rounded-sm px-2 py-1 text-center text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                >
                  {formatCantidad(medido)}
                </button>
              </Tooltip>
            );
          }
          return (
            <Celda
              proyectoId={proyectoId}
              item={item}
              fila={fila.clave}
              filaNombre={fila.nombre}
              valor={tiene ? medido : null}
              onSaved={onItemSaved}
            />
          );
        },
        total: () => (
          <span className="block text-center text-sm font-medium tabular-nums">
            {vacio ? "—" : formatCantidad(totalBase)}
          </span>
        ),
      },
      {
        key: "barras",
        etiqueta: (
          <span
            title={`Cantidad de barras de 12 m, de ${formatCantidad(item.porBulto ?? 0)} kg cada una.`}
          >
            barras
          </span>
        ),
        celda: (fila) => {
          const { medido, derivada, desglosada, abierto, alternar } = estado(fila);
          if (derivada) {
            return (
              <span
                title="Sale de una cuenta sobre otro ítem"
                className="block text-center text-sm tabular-nums text-muted-foreground italic"
              >
                {barrasEnNivel(medido)}
              </span>
            );
          }
          if (desglosada) {
            return (
              <Tooltip content="Cantidad de barras, sin redondear (se redondea sólo en el Total). Tocá para ver el detalle de cada renglón.">
                <button
                  type="button"
                  aria-expanded={abierto}
                  aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                  onClick={alternar}
                  className="w-full rounded-sm px-2 py-1 text-center text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                >
                  {barrasEnNivel(medido)}
                </button>
              </Tooltip>
            );
          }
          const { tiene } = estado(fila);
          return (
            <CeldaHierroConvertida
              proyectoId={proyectoId}
              item={item}
              fila={fila.clave}
              filaNombre={fila.nombre}
              valor={tiene ? medido : null}
              unidad="barras"
              aTexto={(m) => formatCantidad(barrasDeMetros(item, m))}
              aMetros={(barras) => metrosDeBarras(item, barras)}
              onSaved={onItemSaved}
            />
          );
        },
        // Las barras se redondean para arriba sólo acá, en el total: por
        // nivel se compra en conjunto y no tiene sentido pedir "media barra"
        // de más en cada planta (ver el comentario de `bultosTotal`).
        total: () => (
          <span className="block text-center text-sm font-medium tabular-nums">
            {vacio ? "—" : formatCantidad(bultosDe(item, materialDe(item, totalBase))?.enteros ?? 0)}
          </span>
        ),
      },
      {
        key: "kg",
        etiqueta: <span title="Peso total del hierro, en kilos.">kg</span>,
        conChevron: true,
        celda: (fila) => {
          const { tiene, medido, derivada, desglosada, abierto, alternar } = estado(fila);
          if (derivada) {
            return (
              <span
                title="Sale de una cuenta sobre otro ítem"
                className="block text-center text-sm tabular-nums text-muted-foreground italic"
              >
                {kgEnNivel(medido)}
              </span>
            );
          }
          if (desglosada) {
            return (
              <Tooltip content="Peso en kilos, sin redondear. Tocá para ver el detalle de cada renglón.">
                <button
                  type="button"
                  aria-expanded={abierto}
                  aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                  onClick={alternar}
                  className="w-full rounded-sm px-2 py-1 text-center text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                >
                  {kgEnNivel(medido)}
                </button>
              </Tooltip>
            );
          }
          return (
            <span className="group/celda relative block">
              <CeldaHierroConvertida
                proyectoId={proyectoId}
                item={item}
                fila={fila.clave}
                filaNombre={fila.nombre}
                valor={tiene ? medido : null}
                unidad="kilos"
                aTexto={(m) => formatCantidad(kgDeMetros(item, m))}
                aMetros={(kg) => metrosDeKg(item, kg)}
                onSaved={onItemSaved}
              />
              {/* La flechita para abrir el detalle vive en esta línea, al
                  borde derecho de la celda. */}
              <Tooltip content={`Detalle de ${item.nombre} en ${fila.nombre}`}>
                <button
                  type="button"
                  aria-expanded={abierto}
                  aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                  onClick={alternar}
                  className={cn(
                    "absolute top-1/2 right-0 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground focus:opacity-100",
                    abierto ? "opacity-100" : "opacity-0 group-hover/celda:opacity-100"
                  )}
                >
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform duration-200", abierto && "rotate-180")}
                  />
                </button>
              </Tooltip>
            </span>
          );
        },
        total: () => (
          <span className="block text-center text-sm font-medium tabular-nums">
            {vacio ? "—" : formatCantidad(kgDeMetros(item, totalBase))}
          </span>
        ),
      },
    ];

    // Los sub ítems (ver `lineasSubItems`) no son exclusivos de PUERTAS: el
    // "+" para agregarlos vive en todo ítem (ver `FilaItem`), así que acá se
    // suman siempre. Si el ítem no tiene ninguno todavía, esto no agrega nada.
    lineas.push(...lineasSubItems({ item, proyectoId, conFormulas, onItemSaved }));

    return lineas;
  }

  const conversion = conversionDe(item);
  const lineas: LineaItem[] = [];

  // Un ítem de PUERTAS no tiene cantidad propia: lo que antes era esta
  // primera línea ("lo que se carga a mano") queda reemplazada por la suma
  // de sus sub ítems, cada uno con su propia fila más abajo (ver
  // `lineasSubItems`). La línea sigue existiendo para mostrar esa suma en la
  // fila de título, pero en PUERTAS queda de sólo lectura: no hay nada propio
  // que tipear acá.
  lineas.push({
    key: "medido",
    // Esta línea no tiene fila propia: `FilaItem` la detecta por su key
    // ("medido") y la fusiona con la fila de título del ítem, así que esta
    // etiqueta nunca se llega a pintar. Queda igual por si en algún momento
    // dejara de fusionarse (por ejemplo, si el ítem tuviera más de una
    // línea "principal").
    etiqueta: (
      <span title={`Lo que se carga a mano, en ${UNIDAD_INFO[item.unidad].nombre.toLowerCase()}`}>
        medido
      </span>
    ),
    conChevron: !puertas,
    celda: (fila) => {
      const { tiene, medido, derivada, desglosada, abierto, alternar } = estado(fila);

      if (puertas) {
        // Sin cantidad propia: esto es sólo la suma de los sub ítems de esta
        // columna. Para cargar o corregir se usa la fila del sub ítem
        // correspondiente, más abajo.
        return (
          <span className="block text-center text-sm font-medium tabular-nums">
            {medido > 0 ? formatCantidad(medido) : "—"}
          </span>
        );
      }

      // La flechita del detalle va absoluta, apoyada en el borde derecho: en
      // el flujo le comía ancho al número, que quedaba corrido a la izquierda
      // del de las filas de abajo (+10%, palets, sub ítems).
      return (
        <span className="group/celda relative block">
          {derivada ? (
            <span
              title="Sale de una cuenta sobre otro ítem"
              className="block w-full px-2 py-1 text-center text-sm tabular-nums text-muted-foreground italic"
            >
              {formatCantidad(medido)}
            </span>
          ) : desglosada ? (
            // Con varios renglones, o con sub ítems sumando acá, el número
            // de la celda es una suma, y una suma no se tipea: se toca y se
            // corrige adentro (los renglones propios) o en la fila del sub
            // ítem correspondiente (ver más abajo).
            <Tooltip content="Suma de los renglones y/o sub ítems. Tocá para ver el detalle.">
              <button
                type="button"
                aria-expanded={abierto}
                aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                onClick={alternar}
                className="w-full rounded-sm px-2 py-1 text-center text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
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
              formula={(() => {
                const renglon = medicionesDeFila(item, fila.clave)[0];
                return renglon ? formulaDeMedicion(renglon) : null;
              })()}
              conFormulas={conFormulas}
              onSaved={onItemSaved}
            />
          )}

          {!derivada && !desglosada && (
            // El desplegado arranca invisible: la mayoría de las celdas son
            // un número suelto y una flechita en cada fila taparía la
            // lectura de la planilla, que es para lo que se abre.
            <Tooltip content={`Detalle de ${item.nombre} en ${fila.nombre}`}>
              <button
                type="button"
                aria-expanded={abierto}
                aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                onClick={alternar}
                className={cn(
                  "absolute top-1/2 right-0 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground focus:opacity-100",
                  abierto ? "opacity-100" : "opacity-0 group-hover/celda:opacity-100"
                )}
              >
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform duration-200", abierto && "rotate-180")}
                />
              </button>
            </Tooltip>
          )}
        </span>
      );
    },
    // En la mampostería de Cómputos 2 el Total no muestra los m² pelados:
    // sólo cuentan los de abajo, con el desperdicio puesto y en palets.
    total: () =>
      mamposteria2 ? null : (
        <span className="block text-center text-sm font-medium tabular-nums">
          {vacio ? "—" : formatCantidad(totalBase)}
        </span>
      ),
  });

  if (item.desperdicio !== null) {
    const desperdicio = item.desperdicio;
    lineas.push({
      key: "merma",
      etiqueta: <span>+{formatCantidad(desperdicio)}%</span>,
      celda: (fila) => {
        const { tiene, medido } = estado(fila);
        return (
          <span className="block text-center text-sm tabular-nums text-muted-foreground">
            {!tiene ? "—" : formatCantidad(conDesperdicio(medido, desperdicio))}
          </span>
        );
      },
      total: () => (
        <span className="block text-center text-sm font-medium tabular-nums">
          {vacio ? "—" : formatCantidad(conDesperdicio(totalBase, desperdicio))}
        </span>
      ),
    });
  }

  if (tieneBultos(item)) {
    const etiquetaBulto = etiquetaBultos([item]);
    lineas.push({
      key: "bultos",
      etiqueta: (
        <span
          title={`Cantidad de ${etiquetaBulto}, de ${formatCantidad(item.porBulto!)} ${simboloUnidad(item.rindeUnidad!)} cada una`}
        >
          {mayuscula(etiquetaBulto)}
        </span>
      ),
      celda: (fila) => {
        const { tiene, medido } = estado(fila);
        return (
          <span
            title={`${item.nombre} en ${fila.nombre}: cantidad de ${etiquetaBulto}, sin redondear`}
            className="block text-center text-sm tabular-nums text-muted-foreground"
          >
            {!tiene
              ? "—"
              : mamposteria2
                ? (bultosDe(item, materialDe(item, medido))?.enteros ?? 0)
                : formatCantidad(bultosDe(item, materialDe(item, medido))?.exacto ?? 0)}
          </span>
        );
      },
      // Acá sí van redondeados para arriba (ver `bultosTotal`): un palet se
      // pide una vez para toda la obra, no planta por planta.
      total: () => (
        <span className="block text-center text-sm tabular-nums">
          {vacio || !bultosTotal ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <span className="font-medium">{bultosTotal.enteros}</span>
              {/* En la mampostería de Cómputos 2 sólo el entero: se pidió
                  no ver números con coma en los palets. */}
              {!mamposteria2 && (
                <>
                  {" "}
                  <span className="text-xs text-muted-foreground">
                    ({formatCantidad(bultosTotal.exacto)})
                  </span>
                </>
              )}
            </>
          )}
        </span>
      ),
    });
  }

  if (conversion && !mamposteria2) {
    lineas.push({
      key: "material",
      etiqueta: (
        <span
          title={`Cada ${simboloUnidad(item.unidad)} son ${formatCantidad(conversion.rinde)} ${simboloUnidad(conversion.unidad)}`}
        >
          {simboloUnidad(conversion.unidad)}
        </span>
      ),
      celda: (fila) => {
        const { tiene, medido } = estado(fila);
        return (
          <span
            title={`${item.nombre} en ${fila.nombre}, en la unidad en que se compra`}
            className="block text-center text-sm font-medium tabular-nums"
          >
            {!tiene ? "—" : formatCantidad(materialDe(item, medido) ?? 0)}
          </span>
        );
      },
      total: () => (
        <span className="block text-center text-sm font-medium tabular-nums">
          {vacio ? "—" : formatCantidad(materialDe(item, totalBase) ?? 0)}
        </span>
      ),
    });
  }

  // Los sub ítems (ver `lineasSubItems`) no son exclusivos de PUERTAS: el "+"
  // para agregarlos vive en todo ítem (ver `FilaItem`), así que acá se suman
  // siempre. Si el ítem no tiene ninguno todavía, esto no agrega nada.
  lineas.push(...lineasSubItems({ item, proyectoId, conFormulas, onItemSaved }));

  return lineas;
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
  conFormulas = false,
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
  /** Si las celdas que se escriben a mano aceptan fórmulas (Albañilería de Cómputos 2). */
  conFormulas?: boolean;
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(seccion.nombre);
  // El orden de las columnas (los niveles, las filas extra y "Toda la obra")
  // se mantiene acá además de en el servidor para que la columna quede donde
  // la soltaron apenas se suelta, sin esperar la ida y vuelta. Si el guardado
  // falla se vuelve al anterior.
  const [orden, setOrden] = useState(seccion.ordenFilas);
  const [abierta, setAbierta] = useState<CeldaAbierta | null>(null);
  const [prev, setPrev] = useState(seccion);
  // El orden de las filas (los ítems) se mantiene acá por la misma razón que
  // el de las columnas: para que la fila quede donde se soltó sin esperar la
  // ida y vuelta, y se vuelva atrás si el guardado falla.
  //
  // No se puede usar la posición de `items` tal cual llega: un ítem nuevo o
  // borrado tiene que entrar o salir de esta lista sin perder el orden ya
  // elegido para el resto, así que se sincroniza a mano, conservando lo que
  // sigue vivo y agregando al final lo que no estaba.
  const [ordenItems, setOrdenItems] = useState(items.map((i) => i.id));
  const [prevItems, setPrevItems] = useState(items);
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

  if (items !== prevItems) {
    setPrevItems(items);
    const vivos = new Set(items.map((i) => i.id));
    const conservado = ordenItems.filter((id) => vivos.has(id));
    const nuevos = items.map((i) => i.id).filter((id) => !conservado.includes(id));
    setOrdenItems([...conservado, ...nuevos]);
  }

  /** Los ítems en el orden elegido por arrastre, listos para dibujar. */
  const itemsOrdenados = ordenItems
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ItemOpcion => i !== undefined);

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

  /** Las que se pueden arrastrar: todas menos "Toda la obra", que va fija al final. */
  const arrastrables = filas
    .filter((f) => f.clave.tipo !== "general")
    .map((f) => claveFilaKey(f.clave));

  // Sólo en la grilla de PUERTAS (no en HERRAJES, aunque comparten rubro):
  // cada ítem reemplaza su línea de cantidad por una línea por cada sub
  // ítem que tenga, más una columna angosta con su unidad (ver `FilaItem`).
  const puertas = esSeccionPuertas(seccion);
  const mamposteria2 = seccion.esComputos2 && esSeccionMamposteria(seccion);

  /**
   * Cuántas columnas tiene la tabla: la del nombre del ítem y una por cada
   * nivel/fila extra/"Toda la obra". La necesita el detalle, que se
   * despliega como una fila entera abajo de la que se abrió.
   *
   * A diferencia de la versión anterior (ítems en columna), acá cada ítem
   * ocupa siempre una sola columna por fila, sin colspan variable: lo que
   * antes eran subcolumnas (merma, bultos, material, los tres del hierro)
   * ahora son filas propias dentro del bloque del ítem (ver `lineasDeItem`),
   * así que no hace falta calcularlas acá. Siempre se suma una columna más,
   * angosta, con la unidad de cada ítem (ver el `<thead>` y `FilaItem`).
   * La última, siempre, es la del Total.
   */
  const totalColumnas = 2 + filas.length + 1;

  // Ancho mínimo de la tabla, para que con muchos niveles cada columna
  // conserve un ancho legible en vez de achicarse hasta que los números se
  // encimen. 176px es el ancho fijo de la columna del ítem (w-44), 48px el de
  // la columna angosta de Unidad (w-12) y 64px lo que ocupa cómoda una
  // columna de nivel (o la del Total, del mismo ancho); por debajo de eso
  // `table-fixed` ya reparte bien y no hace falta forzar nada, así que el
  // mínimo nunca empuja una tabla que ya entraba.
  const anchoMinimoPx = 176 + 48 + (filas.length + 1) * 64;

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

  /** Igual que `soltar`, pero para las filas: reordena los ítems. */
  const soltarItem = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const desde = ordenItems.indexOf(String(active.id));
    const hasta = ordenItems.indexOf(String(over.id));
    if (desde === -1 || hasta === -1) return;

    const anterior = ordenItems;
    const nuevo = arrayMove(ordenItems, desde, hasta);
    setOrdenItems(nuevo);

    startTransition(async () => {
      const result = await reordenarItems(proyectoId, nuevo);
      if (!result.success) {
        toast.error(result.error);
        setOrdenItems(anterior);
      }
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

      {filas.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          Esta obra no tiene niveles cargados, así que la grilla no tiene columnas.
        </p>
      ) : (
        // El `div` de afuera es lo que permite una barra horizontal cuando la
        // tabla no entra: `table-fixed` ya no achica las columnas hasta
        // encimar los números, sino que la tabla crece más allá del ancho de
        // la tarjeta y lo que sobra se recorre con scroll. El mínimo de abajo
        // (`anchoMinimoPx`) es lo que fuerza esa situación cuando hay muchas
        // columnas; con pocas, la tabla sigue entrando al 100% como siempre.
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
          <SortableContext items={arrastrables} strategy={horizontalListSortingStrategy}>
            <div className="overflow-x-auto">
              {/* El `DndContext`/`SortableContext` del encabezado envuelve toda
                  la tabla, no sólo el `<tr>`: metido adentro de la fila, los
                  elementos de accesibilidad que agrega (anuncios para lectores
                  de pantalla) quedan como hijos sueltos del `<tr>` —inválido en
                  HTML— y eso le hacía creer al navegador que había una columna
                  de más al calcular los anchos con `table-fixed`, dejando un
                  espacio en blanco a la derecha. */}
              <table
                // La primera columna (los nombres) y la fila de títulos van con
                // una línea más gruesa: son el encabezado de la tabla, y así
                // se separan a simple vista de los números. En esa primera
                // columna cada renglón (el ítem, +10%, Palets...) lleva además
                // su propia línea abajo.
                className="table-fixed border-collapse text-sm [&_tr>:first-child]:border-r-2 [&_tr>:first-child]:border-r-foreground/25 [&_tbody_tr>:first-child]:border-b"
                style={{ width: "100%", minWidth: anchoMinimoPx }}
              >
                <thead>
                  <tr className="border-b-2 border-b-foreground/25 bg-foreground/15">
                    {/* La del ítem es la única con ancho propio: es la que se lee
                        para saber de qué fila es cada número, y si se achicara
                        junto con las demás un nombre largo terminaría partido en
                        varios renglones. Las de los niveles se reparten lo que
                        queda. */}
                    <th className="w-44 px-3 py-2 text-center align-middle text-xs font-semibold">
                      Ítem
                    </th>
                    {/* Columna angosta y fija: la unidad de cada ítem, que en
                        PUERTAS no tiene una fila propia (ver `FilaItem`). */}
                    <th className="w-12 border-l px-1 py-2 text-center align-middle text-xs font-semibold">
                      Unidad
                    </th>
                    {filas.map((fila) => (
                      <EncabezadoFila
                        key={claveFilaKey(fila.clave)}
                        proyectoId={proyectoId}
                        fila={fila}
                        extra={
                          fila.clave.tipo === "extra"
                            ? extraPorId.get(fila.clave.id)
                            : undefined
                        }
                        arrastrable={fila.clave.tipo !== "general"}
                        onFilaExtraSaved={onFilaExtraSaved}
                        onFilaExtraDeleted={onFilaExtraDeleted}
                        onNivelSaved={onNivelSaved}
                        onNivelDeleted={onNivelDeleted}
                      />
                    ))}
                    {/* Fija al final, fuera del `SortableContext`: suma todos
                        los niveles y no se arrastra como ellos. */}
                    <th className="w-16 border-l-2 px-1 py-2 text-center align-middle text-xs font-semibold">
                      TOTAL
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {itemsOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={totalColumnas} className="px-3 py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          Esta sección no tiene ítems todavía.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Cada ítem es una fila, con una celda por nivel. Al
                          crearlo se le indica en qué se mide y cuánto desperdicio
                          lleva.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    <DndContext
                      sensors={sensores}
                      collisionDetection={closestCenter}
                      // El detalle abierto es una fila aparte que no acompaña al
                      // bloque mientras se arrastra: se cierra al empezar para que
                      // no quede colgado debajo de una fila que ya no está ahí.
                      onDragStart={() => setAbierta(null)}
                      onDragEnd={soltarItem}
                    >
                      <SortableContext items={ordenItems} strategy={verticalListSortingStrategy}>
                        {itemsOrdenados.map((item) => (
                          <FilaItem
                            key={item.id}
                            proyectoId={proyectoId}
                            item={item}
                            filas={filas}
                            totales={totales}
                            totalColumnas={totalColumnas}
                            puertas={puertas}
                            mamposteria2={mamposteria2}
                            conFormulas={conFormulas}
                            arrastrable={itemsOrdenados.length > 1}
                            abierta={abierta}
                            onAbrir={setAbierta}
                            seccionId={seccion.id}
                            seccionNombre={seccion.nombre}
                            onItemSaved={onItemSaved}
                            onItemDeleted={onItemDeleted}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/**
 * Una fila de la grilla: el ítem a la izquierda y una celda por cada columna
 * (nivel, fila extra o "Toda la obra"), más el total a la derecha.
 *
 * Se mueve entera, del agarre, y no celda por celda: un ítem es un bloque, y
 * lo que se reordena es en qué orden se lee la lista de ítems de la sección,
 * no dónde cae un número suelto.
 *
 * Abajo puede desplegarse el detalle de UNA celda. Va como fila entera y no
 * dentro de la columna porque una columna de la grilla mide dos centímetros:
 * el desglose necesita el ancho de la tabla para que entren la descripción y
 * el número.
 */
function FilaItem({
  proyectoId,
  item,
  filas,
  totales,
  totalColumnas,
  puertas,
  mamposteria2,
  conFormulas,
  arrastrable,
  abierta,
  onAbrir,
  seccionId,
  seccionNombre,
  onItemSaved,
  onItemDeleted,
}: {
  proyectoId: string;
  item: ItemOpcion;
  filas: Fila[];
  totales: Map<string, number>;
  totalColumnas: number;
  /** Si esta sección es PUERTAS: cada ítem reemplaza su cantidad por sus sub ítems. */
  puertas: boolean;
  mamposteria2: boolean;
  conFormulas: boolean;
  arrastrable: boolean;
  abierta: CeldaAbierta | null;
  onAbrir: (celda: CeldaAbierta | null) => void;
  seccionId: string;
  seccionNombre: string;
  onItemSaved: (item: ItemOpcion) => void;
  onItemDeleted: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !arrastrable,
  });

  // Cualquier ítem con sub ítems puede desplegar u ocultar ese bloque desde
  // la flechita de su propia fila. Arranca desplegado para no esconder de
  // entrada algo que el que carga el cómputo recién hizo.
  const [expandido, setExpandido] = useState(true);
  // Si está abierto, el campo para nombrar un sub ítem nuevo aparece debajo
  // del título (ver `AgregarSubItem`), disparado por el "+" que está al lado
  // del lápiz de editar.
  const [agregandoSubItem, setAgregandoSubItem] = useState(false);

  const filaAbierta =
    abierta && abierta.itemId === item.id
      ? filas.find((f) => claveFilaKey(f.clave) === abierta.filaKey)
      : undefined;

  // El ítem se pinta en una fila "de título" (nombre, lápiz, modelo, unidad y
  // —si el ítem tiene una sola línea de datos, como la mayoría de los que no
  // son PUERTAS— los valores de esa línea, todo en el mismo <tr>) y después,
  // sólo si hace falta, una fila de verdad por cada línea adicional
  // (+desperdicio%, bultos, material, sub ítems...). Cada una de esas es un
  // <tr> entero, con su <th> de etiqueta y una <td> por columna: el alto de
  // la fila lo decide el navegador como el máximo de esas celdas, así que la
  // etiqueta queda alineada con sus datos sin tener que igualar a mano
  // paddings ni alturas de línea. Si no hay ninguna línea adicional, no hay
  // fila abajo: el bloque del ítem es esa única fila.
  const lineas = lineasDeItem({
    proyectoId,
    item,
    totales,
    puertas,
    mamposteria2,
    conFormulas,
    abierta,
    onAbrir,
    onItemSaved,
  });
  // La línea "medido" (sólo existe fuera de PUERTAS, ver `lineasDeItem`) se
  // fusiona con la fila de título en vez de tener su propia fila: es la
  // única línea que tiene casi todo ítem, y separarla obligaba a una fila
  // extra sólo para repetir la unidad y mostrar un único número por nivel.
  const lineaPrincipal = lineas.find((l) => l.key === "medido") ?? null;
  const lineasRestantes = lineaPrincipal ? lineas.filter((l) => l.key !== "medido") : lineas;
  // Colapsar el ítem esconde sólo el bloque de sus sub ítems: las demás
  // líneas (+desperdicio%, bultos, material...) siguen viéndose igual.
  const lineasVisibles = expandido ? lineasRestantes : lineasRestantes.filter((l) => !l.esSubItem);
  const filaStyle = { transform: CSS.Transform.toString(transform), transition };
  const filaClase = cn(
    "group/fila bg-muted/20 transition-colors duration-150",
    isDragging ? "relative z-10 bg-background shadow-md" : "hover:bg-muted/40"
  );
  // Las líneas que salen de la cuenta del ítem (+10%, Palets, material...)
  // van en un gris algo más oscuro que el de la fila del ítem, para que a
  // simple vista se separe lo que se carga de lo que se calcula solo. Los sub
  // ítems no: son datos que se cargan, como el ítem.
  const claseCalculada = (linea: LineaItem) =>
    linea.esSubItem
      ? null
      : {
          fila: "bg-neutral-200/60 hover:bg-neutral-200/80 dark:bg-neutral-800/50 dark:hover:bg-neutral-800/70",
          etiqueta:
            "bg-neutral-200/80 group-hover/fila:bg-neutral-200 dark:bg-neutral-700/40 dark:group-hover/fila:bg-neutral-700/60",
          lateral: "bg-neutral-200/70 dark:bg-neutral-700/30",
        };

  return (
    <Fragment>
      <tr
        ref={setNodeRef}
        style={filaStyle}
        className={cn(
          filaClase,
          // La fila del ítem lleva un mismo gris de punta a punta (nombre,
          // unidad, niveles y total), para leerse como un solo renglón.
          !isDragging && "bg-muted/50 hover:bg-muted/70",
          lineasVisibles.length === 0 && "border-b last:border-b-0"
        )}
      >
        {/* La columna del ítem va en gris y con el texto entero: es el
            encabezado de la fila, no un dato, y cortarlo obligaría a
            adivinar de qué ítem es cada número. Si el nombre es largo, baja
            de renglón. */}
        <th
          scope="row"
          className="px-3 py-1 text-left align-middle"
        >
          <span className="flex min-w-0 items-start gap-1">
            {arrastrable ? (
              <Tooltip content="Arrastrar para reordenar">
                <button
                  type="button"
                  aria-label={`Mover ${item.nombre}`}
                  className="mt-0.5 shrink-0 touch-none cursor-grab rounded-sm text-muted-foreground/60 transition-colors duration-150 hover:text-foreground active:cursor-grabbing group-hover/fila:text-muted-foreground"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            ) : (
              // Hueco del mismo ancho que el agarre, para que el nombre no
              // quede corrido respecto de los demás ítems.
              <span className="w-3.5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-start gap-1">
                {item.subItems.length > 0 && (
                  <Tooltip content={expandido ? "Ocultar sub ítems" : "Mostrar sub ítems"}>
                    <button
                      type="button"
                      aria-expanded={expandido}
                      aria-label={
                        expandido
                          ? `Ocultar sub ítems de ${item.nombre}`
                          : `Mostrar sub ítems de ${item.nombre}`
                      }
                      onClick={() => setExpandido((v) => !v)}
                      className="mt-0.5 shrink-0 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          !expandido && "-rotate-90"
                        )}
                      />
                    </button>
                  </Tooltip>
                )}
                <span className="min-w-0 flex-1 text-sm font-medium leading-tight break-words">
                  {item.nombre}
                </span>
                <ItemSeccionDialog
                  proyectoId={proyectoId}
                  seccionId={seccionId}
                  seccionNombre={seccionNombre}
                  item={item}
                  onSaved={onItemSaved}
                  onDeleted={onItemDeleted}
                  trigger={
                    <button
                      type="button"
                      aria-label={`Editar ${item.nombre}`}
                      title={`Editar ${item.nombre}`}
                      className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover/fila:opacity-100 hover:text-foreground focus:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  }
                />
                {!agregandoSubItem && (
                  <Tooltip content="Agregar sub ítem">
                    <button
                      type="button"
                      aria-label={`Agregar sub ítem a ${item.nombre}`}
                      title={`Agregar sub ítem a ${item.nombre}`}
                      onClick={() => setAgregandoSubItem(true)}
                      className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover/fila:opacity-100 hover:text-foreground focus:opacity-100"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </Tooltip>
                )}
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
              {/* El campo para nombrar el sub ítem nuevo, si está abierto
                  (ver el "+" de arriba). Va en su propio renglón, debajo del
                  nombre, para no competir por espacio con el título. */}
              {agregandoSubItem && (
                <AgregarSubItem
                  proyectoId={proyectoId}
                  item={item}
                  onSaved={onItemSaved}
                  onCerrar={() => setAgregandoSubItem(false)}
                />
              )}
            </span>
          </span>
        </th>

        {/* La unidad del ítem va una sola vez, acá: si hay líneas extra
            abajo (ver más adelante) esa celda queda vacía en ellas, en vez
            de repetir el mismo símbolo fila tras fila. */}
        <td className="border-l px-1 py-0.5 text-center align-middle text-xs text-muted-foreground">
          {simboloUnidad(item.unidad)}
        </td>

        {/* Fuera de PUERTAS, todo ítem tiene esta línea ("medido"): en vez
            de su propia fila, sus valores van directo acá. En PUERTAS no
            hay línea principal —la cantidad vive en los sub ítems— así que
            esta parte queda vacía, salvo por el colSpan que completa la
            fila. */}
        {lineaPrincipal ? (
          <>
            {filas.map((fila) => (
              <td
                key={claveFilaKey(fila.clave)}
                className="group/celda border-l px-1 py-0.5 align-middle"
              >
                {lineaPrincipal.celda(fila)}
              </td>
            ))}
            <td className={cn("border-l-2 px-1 py-0.5 align-middle", TOTAL_COL)}>
              {lineaPrincipal.total()}
            </td>
          </>
        ) : (
          <td className="border-l px-1 py-0.5" colSpan={filas.length + 1} />
        )}
      </tr>

      {lineasVisibles.map((linea, i) => {
        const calculada = claseCalculada(linea);
        return (
        <tr
          key={linea.key}
          style={filaStyle}
          className={cn(
            filaClase,
            !isDragging && calculada?.fila,
            i === lineasVisibles.length - 1 && "border-b last:border-b-0"
          )}
        >
          <th
            scope="row"
            className={cn(
              "bg-muted/50 px-3 py-0.5 text-left align-middle text-xs font-medium text-muted-foreground transition-colors duration-150 group-hover/fila:bg-muted/70",
              calculada?.etiqueta
            )}
          >
            <span className="flex min-w-0 items-center gap-1">
              <span className="w-3.5 shrink-0" aria-hidden />
              {item.subItems.length > 0 && <span className="w-3.5 shrink-0" aria-hidden />}
              {linea.etiqueta}
            </span>
          </th>

          {/* La unidad ya se mostró una vez, en la fila de título: acá la
              celda queda vacía, sólo para que la columna siga alineada. */}
          <td className={cn("border-l bg-muted/30 px-1 py-0.5", calculada?.lateral)} />

          {filas.map((fila) => (
            <td
              key={claveFilaKey(fila.clave)}
              className="group/celda border-l px-1 py-0.5 align-middle"
            >
              {linea.celda(fila)}
            </td>
          ))}

          <td
            className={cn(
              "border-l-2 bg-muted/30 px-1 py-0.5 align-middle",
              TOTAL_COL,
              calculada?.lateral
            )}
          >
            {linea.total()}
          </td>
        </tr>
        );
      })}

      {filaAbierta && (
        <tr className="border-b bg-muted/50 duration-150 animate-in fade-in">
          <td colSpan={totalColumnas} className="px-3 py-2">
            <DetalleCelda
              proyectoId={proyectoId}
              item={item}
              fila={filaAbierta.clave}
              filaNombre={filaAbierta.nombre}
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
        <span className="text-center">{simboloUnidad(item.unidad)}</span>
        {hierro && <span className="text-center">barras</span>}
        {hierro && <span className="text-center">kg</span>}
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
      <span className="flex flex-col items-center">
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
          className="w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-center text-sm tabular-nums transition-colors duration-150 hover:border-input focus:border-ring focus:bg-background focus:outline-none"
        />
        {conMedidas && (
          <span className="block text-center text-[10px] text-muted-foreground tabular-nums">
            = {formatCantidad(aporta)}
          </span>
        )}
      </span>
      {hierro && (
        <span
          title={`${formatCantidad(aporta)} m ÷ 12 m por barra`}
          className="text-center text-sm text-muted-foreground tabular-nums"
        >
          {formatCantidad(barras ?? 0)}
        </span>
      )}
      {hierro && (
        <span
          title={`${formatCantidad(barras ?? 0)} barras × ${formatCantidad(item.porBulto ?? 0)} kg cada una`}
          className="text-center text-sm text-muted-foreground tabular-nums"
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
          className="rounded-sm border border-input bg-background px-2 py-1 text-center text-sm tabular-nums focus:border-ring focus:outline-none"
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

