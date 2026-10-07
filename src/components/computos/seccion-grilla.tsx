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
import { ItemSeccionDialog } from "@/components/computos/item-seccion-dialog";
import {
  agregarDetalle,
  borrarDetalle,
  crearFilaExtra,
  eliminarFilaExtra,
  eliminarSeccion,
  guardarCelda,
  guardarDetalle,
  renombrarFilaExtra,
  renombrarSeccion,
  reordenarFilasSeccion,
} from "@/actions/computos";
import {
  bultosDe,
  claveFilaKey,
  conDesperdicio,
  conversionDe,
  esDerivadaEnFila,
  esHierro,
  etiquetaBultos,
  formatCantidad,
  materialDe,
  medicionesDeFila,
  medidaATexto,
  medidoEnFila,
  ordenarFilas,
  parcialMedicion,
  parseMedida,
  simboloUnidad,
  tieneMedidoEnFila,
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
  vistaCalculada,
}: {
  proyectoId: string;
  item: ItemOpcion;
  fila: ClaveFila;
  filaNombre: string;
  /** Lo medido, o null si esta celda todavía no tiene ninguna fila. */
  valor: number | null;
  onSaved: (item: ItemOpcion) => void;
  /**
   * Para el hierro: mientras no se está tocando la celda, se muestra esto en
   * vez del número tipeado (la cantidad de barras, en vez de los metros). Al
   * tocarla para corregir vuelve a verse lo que realmente se cargó, que son
   * los metros: es lo único que se tipea, la barra sale sola.
   */
  vistaCalculada?: (valor: number) => string;
}) {
  const inicial = valor === null ? "" : medidaATexto(valor);
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [prev, setPrev] = useState(valor);
  const [enfocado, setEnfocado] = useState(false);
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

  const mostrarCalculado = !enfocado && vistaCalculada && valor !== null;

  return (
    <input
      value={mostrarCalculado ? vistaCalculada(valor) : texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={() => setEnfocado(true)}
      onBlur={() => {
        setEnfocado(false);
        guardar();
      }}
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
      title={mostrarCalculado ? `${item.nombre} en ${filaNombre}: tocá para ver y corregir los metros cargados` : undefined}
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
 * El nombre de una fila extra, editable en el lugar.
 *
 * Va con lápiz y tacho, como la sección, porque es lo mismo: algo que escribió
 * el usuario a mano y que se corrige donde se lee. Los niveles no llevan
 * ninguno de los dos —se editan en "Editar datos" del proyecto, que es de donde
 * salen— y esa diferencia visual es a propósito: el nivel es de toda la obra y
 * esta fila es de esta grilla y de ninguna otra.
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
      <button
        type="button"
        aria-label={`Renombrar ${fila.nombre}`}
        onClick={() => setEditando(true)}
        className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label={`Eliminar ${fila.nombre}`}
        onClick={borrar}
        className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
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
 * ¿Este ítem, además de convertirse a material, se compra agrupado en
 * bultos (palets, bolsas, barras...)? Hace falta `rinde` para saber cuánto
 * material hay, y `porBulto` para saber cuánto trae cada uno: sin lo primero
 * lo segundo no tiene con qué dividir.
 */
function tieneBultos(item: ItemOpcion) {
  return item.porBulto !== null && conversionDe(item) !== null;
}

/**
 * Cuántas columnas de la tabla ocupa un ítem.
 *
 * El hierro es un caso aparte y va siempre en una sola: la grilla general no
 * necesita ver los metros ni los kilos al lado de las barras, los tres
 * números apretados en una fila de treinta no suman nada que la cantidad de
 * barras sola no diga. El desglose de cada base, con las tres medidas, se ve
 * adentro del detalle (ver DetalleCelda) y no acá.
 *
 * Para el resto: una siempre —lo medido—, más la de la merma si tiene
 * desperdicio, más la de los bultos (palets, bolsas) si se compra agrupado,
 * más la del material si se compra en otra unidad. Se calcula en un solo
 * lugar porque el encabezado, cada fila, el pie y el colspan del detalle
 * tienen que estar todos de acuerdo: si uno cuenta distinto, la tabla sale con
 * las celdas corridas y los números quedan abajo de la columna equivocada.
 */
function subcolumnas(item: ItemOpcion) {
  if (esHierro(item)) return 1;
  return (
    1 +
    (item.desperdicio !== null ? 1 : 0) +
    (tieneBultos(item) ? 1 : 0) +
    (conversionDe(item) !== null ? 1 : 0)
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

  /**
   * Cuántas columnas tiene la tabla. La necesita el detalle, que se despliega
   * como una fila entera abajo de la que se abrió.
   */
  const columnas = 1 + items.reduce((acc, i) => acc + subcolumnas(i), 0);

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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Renombrar ${seccion.nombre}`}
              onClick={() => setRenombrando(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        <FilaExtraNueva
          proyectoId={proyectoId}
          seccionId={seccion.id}
          onSaved={onFilaExtraSaved}
        />
        {agregar}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${seccion.nombre}`}
          onClick={borrar}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
                  colSpan={subcolumnas(item)}
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
                      igual rango. */}
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
            </tr>
            <tr className="border-b bg-muted/25">
              <th />
              {items.map((item) => (
                <Subencabezados key={item.id} item={item} />
              ))}
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
                    abierta={abierta}
                    onAbrir={setAbierta}
                    onItemSaved={onItemSaved}
                    onFilaExtraSaved={onFilaExtraSaved}
                    onFilaExtraDeleted={onFilaExtraDeleted}
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

                // El hierro también en el total es sólo la cantidad de barras
                // a pedir: ni los metros ni los kilos aportan algo que la
                // cantidad de barras, redondeada para arriba, no diga ya.
                if (hierro) {
                  return (
                    <td
                      key={item.id}
                      className="border-l bg-foreground/[0.04] px-3 py-2 text-right"
                    >
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
                  </Fragment>
                );
              })}
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
  abierta,
  onAbrir,
  onItemSaved,
  onFilaExtraSaved,
  onFilaExtraDeleted,
}: {
  proyectoId: string;
  fila: Fila;
  /** La fila extra, si esta fila es una. Los niveles no tienen. */
  extra: FilaExtraOpcion | undefined;
  items: ItemOpcion[];
  totales: Map<string, number>;
  columnas: number;
  abierta: CeldaAbierta | null;
  onAbrir: (celda: CeldaAbierta | null) => void;
  onItemSaved: (item: ItemOpcion) => void;
  onFilaExtraSaved: (fila: FilaExtraOpcion) => void;
  onFilaExtraDeleted: (id: string) => void;
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
              <button
                type="button"
                aria-label={`Mover ${fila.nombre}`}
                className="mt-0.5 shrink-0 touch-none cursor-grab rounded-sm text-muted-foreground/60 transition-colors duration-150 hover:text-foreground active:cursor-grabbing group-hover/fila:text-muted-foreground"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
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

          return (
            <Fragment key={item.id}>
              <td className="group/celda border-l px-1 py-0.5">
                <span className="flex items-center gap-0.5">
                  {derivada ? (
                    <span
                      title="Sale de una cuenta sobre otro ítem"
                      className="min-w-0 flex-1 px-2 py-1 text-right text-sm tabular-nums text-muted-foreground italic"
                    >
                      {hierro ? barrasEnNivel(medido) : formatCantidad(medido)}
                    </span>
                  ) : desglosada ? (
                    // Con varios renglones el número de la celda es la suma, y
                    // una suma no se tipea: se toca y se corrige adentro.
                    <button
                      type="button"
                      aria-expanded={abierto}
                      aria-label={`Detalle de ${item.nombre} en ${fila.nombre}`}
                      onClick={() =>
                        onAbrir(abierto ? null : { itemId: item.id, filaKey })
                      }
                      className="min-w-0 flex-1 rounded-sm px-2 py-1 text-right text-sm font-medium tabular-nums transition-colors duration-150 hover:bg-muted"
                    >
                      {hierro ? barrasEnNivel(medido) : formatCantidad(medido)}
                    </button>
                  ) : (
                    <Celda
                      proyectoId={proyectoId}
                      item={item}
                      fila={fila.clave}
                      filaNombre={fila.nombre}
                      valor={tiene ? medido : null}
                      onSaved={onItemSaved}
                      vistaCalculada={hierro ? barrasEnNivel : undefined}
                    />
                  )}

                  {!derivada && !desglosada && (
                    // El desplegado arranca invisible: la mayoría de las celdas
                    // son un número suelto y quince flechitas por fila taparían
                    // la lectura de la planilla, que es para lo que se abre.
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
                  )}
                </span>
              </td>

              {!hierro && item.desperdicio !== null && (
                // Un tono más apagada que la de al lado: no es un dato medido,
                // es el mismo número con la merma encima. Se lee de reojo al
                // armar la compra, no al computar.
                <td className="bg-foreground/[0.03] px-2 py-1 text-right text-sm tabular-nums text-muted-foreground">
                  {!tiene ? "—" : formatCantidad(conDesperdicio(medido, item.desperdicio))}
                </td>
              )}

              {!hierro && tieneBultos(item) && (
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

              {!hierro && conversionDe(item) !== null && (
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
            </Fragment>
          );
        })}
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
        {item.nombre} · {filaNombre} ·{" "}
        {hierro ? "ml, cantidad de barras y kilos de hierro" : simboloUnidad(item.unidad)}
      </p>

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
  const barras = hierro ? bultosDe(item, kg)?.exacto ?? 0 : null;

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
    <div className="flex items-center gap-2">
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
        placeholder="Base B1"
        aria-label="Descripción del renglón"
        disabled={pending}
        className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm transition-colors duration-150 hover:border-input focus:border-ring focus:bg-background focus:outline-none"
      />
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
        className="w-24 shrink-0 rounded-sm border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums transition-colors duration-150 hover:border-input focus:border-ring focus:bg-background focus:outline-none"
      />
      {conMedidas && (
        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          = {formatCantidad(aporta)}
        </span>
      )}
      {hierro && (
        <>
          <span
            title={`${formatCantidad(aporta)} m ÷ 12 m por barra`}
            className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
          >
            {formatCantidad(barras ?? 0)} barras
          </span>
          <span
            title={`${formatCantidad(barras ?? 0)} barras × ${formatCantidad(item.porBulto ?? 0)} kg cada una`}
            className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
          >
            {formatCantidad(kg ?? 0)} kg
          </span>
        </>
      )}
      <button
        type="button"
        aria-label={`Eliminar ${medicion.descripcion ?? "renglón"}`}
        onClick={borrar}
        disabled={pending}
        className="shrink-0 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
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
    <div className="flex items-center gap-2 pt-1">
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
        placeholder="Base B1"
        aria-label="Descripción del renglón nuevo"
        className="min-w-0 flex-1 rounded-sm border border-input bg-background px-2 py-1 text-sm focus:border-ring focus:outline-none"
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
        className="w-24 shrink-0 rounded-sm border border-input bg-background px-2 py-1 text-right text-sm tabular-nums focus:border-ring focus:outline-none"
      />
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={agregar}>
        <Plus className="h-3.5 w-3.5" />
        Renglón
      </Button>
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
function Subencabezados({ item }: { item: ItemOpcion }) {
  const conversion = conversionDe(item);

  // El hierro va en una sola subcolumna: la cantidad de barras. Los metros
  // que se tipearon y los kilos que pesan quedan adentro del detalle de cada
  // nivel (ver DetalleCelda), no acá, para no repetir las tres medidas en una
  // grilla que ya tiene treinta filas.
  if (esHierro(item)) {
    return (
      <th
        title={`Cantidad de barras de 12 m, de ${formatCantidad(item.porBulto!)} kg cada una. Los metros y los kilos se ven adentro del detalle de cada nivel.`}
        className="border-l px-2 pb-1 text-right text-[10px] font-normal text-muted-foreground"
      >
        barras
      </th>
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
    </Fragment>
  );
}
