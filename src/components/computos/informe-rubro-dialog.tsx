"use client";

import { useState } from "react";
import { ChevronDown, FileDown } from "lucide-react";

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
  calcularTotales,
  claveFilaKey,
  esHierro,
  fechaDeComputo,
  medicionesDeFila,
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

/**
 * Cómo se agrupan los renglones del detalle de una celda para elegirlos.
 *
 * Sin distinguir mayúsculas ni espacios de más: "c01 " y "C01" son la misma
 * columna escrita apurado, y en la lista tienen que ser un solo tilde.
 */
function claveRenglon(descripcion: string) {
  return descripcion.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Un renglón de una celda, tal como se ofrece en el diálogo. */
type RenglonOpcion = {
  /** `itemId|fila|CLAVE`: lo que se guarda en `renglonesFuera`. */
  llave: string;
  nombre: string;
  /** Las mediciones que caen bajo este tilde (casi siempre una). */
  medicionIds: string[];
  /**
   * Lo cargado sin nombre en esa celda (un número suelto, como casi todo el
   * hierro). No se lista para elegirlo de a uno —no hay cómo llamarlo—, pero
   * entra y sale con el tilde de su nivel: sin esto, un ítem sin renglones
   * con nombre no tendría forma de sacar un piso.
   */
  sinNombre: boolean;
};

/** Los renglones de un nivel, bajo su subtítulo. */
type NivelRenglones = { clave: string; nombre: string; renglones: RenglonOpcion[] };

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
  todosLosItems,
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
  /**
   * TODOS los ítems de la obra, para recalcular los totales sobre lo
   * elegido: una fila derivada puede salir de un ítem de otro rubro, así que
   * hace falta la obra entera para resolverla (ver `vistaTotales`).
   */
  todosLosItems: ItemOpcion[];
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
   * Los sub ítems que se pueden elegir: los de los ítems recién calculados,
   * de a uno (no hace falta que el ítem esté marcado: destildado igual se
   * pueden ver, sólo que no se van a imprimir).
   *
   * Se sincronizan con la misma huella que los ítems, por la misma razón:
   * un sub ítem nuevo tiene que entrar marcado, no quedar afuera en silencio.
   */
  const subItemsDisponibles = itemsDisponibles.flatMap((i) => i.subItems);
  const huellaSubItems = subItemsDisponibles.map((si) => si.id).join("|");
  const [subItemsElegidos, setSubItemsElegidos] = useState<Set<string>>(
    new Set(subItemsDisponibles.map((si) => si.id))
  );
  const [prevSubItems, setPrevSubItems] = useState(huellaSubItems);

  if (huellaSubItems !== prevSubItems) {
    setPrevSubItems(huellaSubItems);
    setSubItemsElegidos(new Set(subItemsDisponibles.map((si) => si.id)));
  }

  /** Qué ítems tienen la lista de sus sub ítems desplegada, en el diálogo. */
  const [itemsExpandidos, setItemsExpandidos] = useState<Set<string>>(new Set());

  /**
   * Los renglones del detalle destildados, por su `llave` (`itemId|fila|CLAVE`).
   *
   * La fila es parte de la llave porque la lista se lee por nivel: la C01 de
   * planta baja y la C01 de la planta tipo son dos tildes distintos, y sacar
   * una no tiene que sacar la otra.
   *
   * Se guardan los que se SACAN y no los que quedan, al revés que el resto del
   * diálogo: así un renglón que no estaba cuando se abrió —o el de un ítem
   * recién sumado— entra marcado sin tener que resincronizar nada, que es lo
   * mismo que logran las huellas de arriba.
   */
  const [renglonesFuera, setRenglonesFuera] = useState<Set<string>>(new Set());

  /** Qué niveles (`itemId|fila`) tienen sus renglones desplegados. */
  const [nivelesExpandidos, setNivelesExpandidos] = useState<Set<string>>(new Set());

  /** Las filas de la grilla de una sección, en el orden en que se ven. */
  const filasDeSeccion = (seccionId: string): FilaInforme[] => {
    const seccion = secciones.find((s) => s.id === seccionId);
    if (!seccion) return [];
    return ordenarFilas(
      [
        ...niveles.map((n) => ({
          clave: { tipo: "nivel" as const, id: n.id },
          nombre: n.nombre,
        })),
        ...filasExtra
          .filter((f) => f.seccionId === seccionId)
          .sort((a, b) => a.orden - b.orden)
          .map((f) => ({ clave: { tipo: "extra" as const, id: f.id }, nombre: f.nombre })),
        { clave: { tipo: "general" as const }, nombre: SIN_NIVEL },
      ],
      seccion.ordenFilas
    );
  };

  /**
   * Lo cargado en un ítem, agrupado por nivel en el orden de la grilla: los
   * renglones con nombre en orden natural (C2 antes que C10) y, al final, lo
   * que no tiene nombre (ver `RenglonOpcion.sinNombre`). Los niveles sin nada
   * cargado no aparecen.
   */
  const renglonesPorNivel = (item: ItemOpcion): NivelRenglones[] =>
    // Un ítem sin sección no está en ninguna grilla: no tiene niveles que mostrar.
    (item.seccionId ? filasDeSeccion(item.seccionId) : []).flatMap((fila) => {
      const filaKey = claveFilaKey(fila.clave);
      const grupos = new Map<string, RenglonOpcion>();
      for (const m of medicionesDeFila(item, fila.clave)) {
        // Las derivadas no se eligen acá: salen de otro ítem, y sacarlas
        // escondería un número que depende de lo que se haga allá.
        if (m.origenId !== null) continue;
        const nombre = m.descripcion?.trim() ?? "";
        const clave = nombre ? claveRenglon(nombre) : "";
        const grupo = grupos.get(clave);
        if (grupo) grupo.medicionIds.push(m.id);
        else
          grupos.set(clave, {
            llave: `${item.id}|${filaKey}|${clave}`,
            nombre,
            medicionIds: [m.id],
            sinNombre: !nombre,
          });
      }
      if (grupos.size === 0) return [];
      const renglones = [...grupos.values()].sort(
        (a, b) =>
          Number(a.sinNombre) - Number(b.sinNombre) ||
          a.nombre.localeCompare(b.nombre, "es", { numeric: true, sensitivity: "base" })
      );
      return [{ clave: filaKey, nombre: fila.nombre, renglones }];
    });

  /** Las mediciones que quedan afuera por un renglón destildado. */
  const medicionesFuera = (item: ItemOpcion) =>
    new Set(
      renglonesPorNivel(item).flatMap((nivel) =>
        nivel.renglones
          .filter((r) => renglonesFuera.has(r.llave))
          .flatMap((r) => r.medicionIds)
      )
    );

  /** Marca o desmarca de una vez un grupo de renglones. */
  const marcarRenglones = (renglones: RenglonOpcion[], marcar: boolean) =>
    setRenglonesFuera((prev) => {
      const next = new Set(prev);
      for (const r of renglones) {
        if (marcar) next.delete(r.llave);
        else next.add(r.llave);
      }
      return next;
    });

  /**
   * Los niveles que se repiten (planta tipo ×4) que van a salir como UNA
   * planta en vez del total. Por nivel y no para todo el informe: una obra
   * puede tener dos plantas tipo distintas y querer una de cada forma.
   */
  const [unaPlanta, setUnaPlanta] = useState<Set<string>>(new Set());

  /**
   * Una medición leída como de una sola planta, si su nivel está en
   * `unaPlanta`.
   *
   * Alcanza con bajar `repeticiones` a 1: es lo único que multiplica (ver
   * `parcialMedicion`), así que la celda, el total del ítem, los kg, las
   * barras y la fila de totales salen solos de una planta y el papel cierra.
   * Las derivadas no tienen nivel y no se tocan: su total de origen ya viene
   * recalculado desde la vista.
   */
  const aUnaPlanta = <M extends { nivelId: string | null; repeticiones: number }>(m: M): M =>
    m.nivelId !== null && m.repeticiones > 1 && unaPlanta.has(m.nivelId)
      ? { ...m, repeticiones: 1 }
      : m;

  /**
   * Cómo se titula un nivel en el papel: con las repeticiones a la vista,
   * para que nadie lea "PLANTA TIPO" sin saber si es una o son cuatro.
   * Si el nombre ya trae el "×4" escrito a mano, no se repite.
   */
  const nombreEnInforme = (n: NivelOpcion) => {
    if (n.repeticiones <= 1) return n.nombre;
    // "x planta" se lee "por planta", como se dice en obra.
    if (unaPlanta.has(n.id)) return `${n.nombre} (x planta)`;
    return /[x×]\s*\d/i.test(n.nombre) ? n.nombre : `${n.nombre} ×${n.repeticiones}`;
  };

  /**
   * Un ítem, pero con sólo los sub ítems y los renglones que quedaron marcados.
   *
   * Sacar un renglón es sacar su medición entera, no esconder su línea: así la
   * celda, el total del ítem, la fila de totales y cualquier derivada que
   * dependa de él se calculan sin ese número, y un nivel donde sólo estaba esa
   * columna queda vacío y desaparece como cualquier otro.
   */
  const conSubItemsElegidos = (item: ItemOpcion): ItemOpcion => {
    const fuera = renglonesFuera.size === 0 ? null : medicionesFuera(item);
    const mediciones = fuera
      ? item.mediciones.filter((m) => !fuera.has(m.id))
      : item.mediciones;
    return {
      ...item,
      mediciones: mediciones.map(aUnaPlanta),
      subItems: item.subItems
        .filter((si) => subItemsElegidos.has(si.id))
        .map((si) => ({ ...si, mediciones: si.mediciones.map(aUnaPlanta) })),
    };
  };

  /**
   * De acá para abajo, "los ítems" son sólo los elegidos, y cada uno con sólo
   * los sub ítems elegidos.
   *
   * Importa que sea así y no sólo a la hora de imprimir: si se baja únicamente
   * la columna de las columnas, una planta donde lo único cargado son las vigas
   * queda vacía de verdad, y tiene que desaparecer de la lista de niveles como
   * cualquier otra fila vacía. Filtrar recién al final imprimiría esa planta
   * como una fila de rayas.
   */
  const itemsActivos = itemsDisponibles
    .filter((i) => itemsElegidos.has(i.id))
    .map(conSubItemsElegidos);
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
    setPrevSubItems("");
    setPrevHuella("");
    setItemsExpandidos(new Set());
    setRenglonesFuera(new Set());
    setUnaPlanta(new Set());
    setNivelesExpandidos(new Set());
  };

  const marcada = (clave: ClaveFila) => filasElegidas.has(claveFilaKey(clave));

  /** La clave de la fila en la que cae una celda (ver `esDeLaFila`). */
  const filaDeCelda = (m: { nivelId: string | null; filaExtraId: string | null }) =>
    m.nivelId !== null
      ? `nivel:${m.nivelId}`
      : m.filaExtraId !== null
        ? `extra:${m.filaExtraId}`
        : "general";

  /**
   * Un ítem, pero con sólo lo cargado en los niveles tildados.
   *
   * Es lo que hace que el TOTAL del papel sea el de las columnas que se ven:
   * si se baja sólo la planta baja, el total de columnas tiene que ser el de
   * la planta baja, no el de la obra entera con las otras plantas escondidas.
   * Va aparte de `conSubItemsElegidos` porque la lista de niveles del diálogo
   * necesita seguir viendo lo cargado en un nivel destildado: si no, al
   * destildarlo pasaría a decir "sin cargar".
   */
  const soloFilasElegidas = (item: ItemOpcion): ItemOpcion => ({
    ...item,
    mediciones: item.mediciones.filter((m) => filasElegidas.has(filaDeCelda(m))),
    subItems: item.subItems.map((si) => ({
      ...si,
      mediciones: si.mediciones.filter((m) => filasElegidas.has(filaDeCelda(m))),
    })),
  });

  const armarSecciones = (): SeccionInforme[] =>
    activas.map((seccion) => {
      const propias = filasExtra
        .filter((f) => f.seccionId === seccion.id)
        .sort((a, b) => a.orden - b.orden);
      const itemsSeccion = itemsDe(seccion.id)
        .filter((i) => itemsElegidos.has(i.id))
        .map((i) => soloFilasElegidas(conSubItemsElegidos(i)));
      const hayGeneralAca = itemsSeccion.some((i) =>
        i.mediciones.some((m) => m.nivelId === null && m.filaExtraId === null)
      );

      const todas: FilaInforme[] = [
        ...niveles.map((n) => ({
          clave: { tipo: "nivel" as const, id: n.id },
          nombre: nombreEnInforme(n),
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

  /**
   * Los totales del papel: sólo sobre lo que se eligió, no sobre toda la
   * obra. Un ítem destildado, un sub ítem destildado dentro de uno que sigue
   * marcado, o lo cargado en un nivel destildado, no tienen que sumar nada
   * —ni en su propia fila de Total ni en ninguna fila derivada que dependa
   * de ellos—, así que se recalcula
   * sobre una "vista" de la obra entera donde eso queda en cero, en vez de
   * usar el total ya calculado de toda la obra (que sí los suma).
   *
   * Hace falta la obra entera, y no sólo los ítems de este rubro, porque una
   * fila derivada puede salir de un ítem de otro rubro (los ladrillos salen
   * de los m² de mampostería): ese ítem ajeno sigue aportando lo que tenía,
   * tal cual, porque este diálogo no ofrece ninguna forma de destildarlo.
   */
  const vistaTotales = (): Map<string, number> => {
    const disponibles = new Set(itemsDisponibles.map((i) => i.id));
    const vista = todosLosItems.map((item) => {
      if (!disponibles.has(item.id)) return item;
      if (!itemsElegidos.has(item.id)) return { ...item, mediciones: [], subItems: [] };
      return soloFilasElegidas(conSubItemsElegidos(item));
    });
    return calcularTotales(vista);
  };

  const descargar = () => {
    abrirInformeRubro({
      proyectoNombre,
      rubroNombre,
      totales: vistaTotales(),
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
              {itemsDisponibles.map((item) => {
                const tieneSubItems = item.subItems.length > 0;
                const porNivel = renglonesPorNivel(item);
                const renglones = porNivel.flatMap((n) => n.renglones);
                const tieneRenglones = renglones.length > 0;
                const desplegable = tieneSubItems || tieneRenglones;
                const queSeDespliega = tieneSubItems ? "sub ítems" : "niveles";
                const expandido = itemsExpandidos.has(item.id);
                const elegidosDeEste = item.subItems.filter((si) =>
                  subItemsElegidos.has(si.id)
                ).length;
                const renglonesElegidos = renglones.filter(
                  (r) => !renglonesFuera.has(r.llave)
                ).length;
                // Un nivel cuenta como "va" mientras le quede algo marcado.
                const nivelesQueVan = porNivel.filter((n) =>
                  n.renglones.some((r) => !renglonesFuera.has(r.llave))
                ).length;
                return (
                  <div key={item.id} className="flex flex-col">
                    <span className="flex min-w-0 items-center gap-1">
                      {desplegable ? (
                        <Tooltip
                          content={
                            expandido ? `Ocultar ${queSeDespliega}` : `Elegir ${queSeDespliega}`
                          }
                        >
                          <button
                            type="button"
                            aria-expanded={expandido}
                            aria-label={
                              expandido
                                ? `Ocultar ${queSeDespliega} de ${item.nombre}`
                                : `Elegir ${queSeDespliega} de ${item.nombre}`
                            }
                            onClick={() =>
                              setItemsExpandidos((prev) => alternar(prev, item.id))
                            }
                            className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform duration-200",
                                !expandido && "-rotate-90"
                              )}
                            />
                          </button>
                        </Tooltip>
                      ) : (
                        <span className="w-5 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <Opcion
                          marcado={itemsElegidos.has(item.id)}
                          // Con una sola sección a la vista, de qué sección es
                          // no aporta nada y la unidad sí. Con varias, dos
                          // secciones pueden tener las dos un ítem "Hormigón" y
                          // hay que poder distinguirlos.
                          detalle={
                            tieneSubItems
                              ? `${elegidosDeEste}/${item.subItems.length} sub ítems`
                              : tieneRenglones && renglonesElegidos < renglones.length
                                ? `${nivelesQueVan}/${porNivel.length} niveles`
                                : activas.length > 1
                                ? activas.find((s) => s.id === item.seccionId)?.nombre
                                : simboloUnidad(item.unidad)
                          }
                          onCambio={() => setItemsElegidos((prev) => alternar(prev, item.id))}
                        >
                          {item.nombre}
                        </Opcion>
                      </span>
                    </span>
                    {tieneSubItems && expandido && (
                      <div className="ml-5 flex flex-col border-l pl-2">
                        {item.subItems.map((subItem) => (
                          <Opcion
                            key={subItem.id}
                            marcado={subItemsElegidos.has(subItem.id)}
                            onCambio={() =>
                              setSubItemsElegidos((prev) => alternar(prev, subItem.id))
                            }
                          >
                            {subItem.nombre}
                          </Opcion>
                        ))}
                      </div>
                    )}
                    {tieneRenglones && expandido && (
                      <div className="ml-5 flex flex-col border-l pl-2">
                        {/* Con treinta columnas y tres para imprimir, destildar
                            veintisiete de a una es lo que hace falta evitar. */}
                        <button
                          type="button"
                          onClick={() =>
                            marcarRenglones(renglones, renglonesElegidos < renglones.length)
                          }
                          className="self-end px-1.5 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                        >
                          {renglonesElegidos < renglones.length ? "Todos" : "Ninguno"}
                        </button>
                        {porNivel.map((nivel) => {
                          const todosDelNivel = nivel.renglones.every(
                            (r) => !renglonesFuera.has(r.llave)
                          );
                          // Sólo los renglones con nombre se eligen de a uno;
                          // lo suelto va y viene con el tilde del nivel.
                          const conNombre = nivel.renglones.filter((r) => !r.sinNombre);
                          const elegidosDelNivel = conNombre.filter(
                            (r) => !renglonesFuera.has(r.llave)
                          ).length;
                          const llaveNivel = `${item.id}|${nivel.clave}`;
                          const nivelAbierto =
                            conNombre.length > 0 && nivelesExpandidos.has(llaveNivel);
                          return (
                            <div key={nivel.clave} className="flex flex-col">
                              {/* Cada nivel es un renglón con su tilde, que saca
                                  o deja la planta entera de una vez, y su flecha,
                                  que muestra las C1, C2… para elegir de a una.
                                  Arranca cerrado: con treinta columnas por planta,
                                  todo abierto es una lista que no se recorre. */}
                              <span className="flex min-w-0 items-center gap-1">
                                {conNombre.length === 0 ? (
                                  <span className="w-5 shrink-0" aria-hidden />
                                ) : (
                                  <Tooltip
                                    content={nivelAbierto ? "Ocultar renglones" : "Elegir renglones"}
                                  >
                                    <button
                                      type="button"
                                      aria-expanded={nivelAbierto}
                                      aria-label={
                                        nivelAbierto
                                          ? `Ocultar renglones de ${nivel.nombre}`
                                          : `Elegir renglones de ${nivel.nombre}`
                                      }
                                      onClick={() =>
                                        setNivelesExpandidos((prev) => alternar(prev, llaveNivel))
                                      }
                                      className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                      <ChevronDown
                                        className={cn(
                                          "h-3.5 w-3.5 transition-transform duration-200",
                                          !nivelAbierto && "-rotate-90"
                                        )}
                                      />
                                    </button>
                                  </Tooltip>
                                )}
                                <span className="min-w-0 flex-1">
                                  <Opcion
                                    // Tildado sólo si van todos: con algunos
                                    // afuera, un click lo vuelve a completar.
                                    marcado={todosDelNivel}
                                    detalle={
                                      conNombre.length > 0
                                        ? `${elegidosDelNivel}/${conNombre.length}`
                                        : undefined
                                    }
                                    onCambio={() =>
                                      marcarRenglones(nivel.renglones, !todosDelNivel)
                                    }
                                  >
                                    <span className="font-medium">{nivel.nombre}</span>
                                  </Opcion>
                                </span>
                              </span>
                              {nivelAbierto && (
                                <div className="ml-5 flex flex-col border-l pl-2">
                                  {conNombre.map((renglon) => (
                                    <Opcion
                                      key={renglon.llave}
                                      marcado={!renglonesFuera.has(renglon.llave)}
                                      onCambio={() =>
                                        setRenglonesFuera((prev) =>
                                          alternar(prev, renglon.llave)
                                        )
                                      }
                                    >
                                      {renglon.nombre}
                                    </Opcion>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
                const nivel =
                  opcion.clave.tipo === "nivel"
                    ? niveles.find((n) => n.id === (opcion.clave as { id: string }).id)
                    : undefined;
                const opcionFila = (
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
                // Sólo los niveles que se repiten ofrecen elegir: en uno común
                // "total" y "una planta" son el mismo número.
                if (!nivel || nivel.repeticiones <= 1) return opcionFila;
                const soloUna = unaPlanta.has(nivel.id);
                const elegir = (una: boolean) =>
                  setUnaPlanta((prev) => {
                    const next = new Set(prev);
                    if (una) next.add(nivel.id);
                    else next.delete(nivel.id);
                    return next;
                  });
                return (
                  <div key={clave} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">{opcionFila}</span>
                    {/* Fuera del renglón clickeable: tocar el selector no
                        tiene que tildar ni destildar el nivel. */}
                    <div
                      role="radiogroup"
                      aria-label={`Cómo sale ${nivel.nombre}`}
                      className="mr-1 flex shrink-0 rounded-md border p-0.5 text-xs"
                    >
                      {[
                        { una: false, texto: `Total ×${nivel.repeticiones}` },
                        { una: true, texto: "x planta" },
                      ].map((op) => (
                        <button
                          key={op.texto}
                          type="button"
                          role="radio"
                          aria-checked={soloUna === op.una}
                          onClick={() => elegir(op.una)}
                          className={cn(
                            "rounded-sm px-2 py-0.5 transition-colors",
                            soloUna === op.una
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {op.texto}
                        </button>
                      ))}
                    </div>
                  </div>
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
