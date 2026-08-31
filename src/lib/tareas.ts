import type { Prisma } from "@/generated/prisma/client";

export const PRIORIDADES = [
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
] as const;

export type Prioridad = (typeof PRIORIDADES)[number]["value"];

export const PRIORIDAD_LABELS: Record<Prioridad, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

/** Color del badge de prioridad en las listas de tareas. */
export const PRIORIDAD_BADGE: Record<Prioridad, "error" | "warning" | "outline"> = {
  ALTA: "error",
  MEDIA: "warning",
  BAJA: "outline",
};

/**
 * Paleta para los badges de las personas asignadas. Cada una se queda siempre
 * con el mismo color, así se reconoce quién está en cada tarea barriendo la
 * lista con la vista, sin leer los nombres.
 *
 * No hay rojos ni ámbares a propósito: son los colores que la app usa para
 * decir "urgente" y "atención" (el badge de prioridad, los avisos), y un
 * nombre en rojo se leería como una alarma en vez de como una persona.
 *
 * Las clases están escritas enteras y no armadas con template strings porque
 * Tailwind busca los nombres de clase como texto en el código: un
 * `bg-${color}-100` no lo encuentra y el color no llega al build.
 */
const COLORES_PERSONA = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
];

/**
 * Color fijo de una persona, salido de su id.
 *
 * Va por id y no por nombre para que el color no cambie si a alguien se le
 * corrige cómo está escrito el nombre. Es un hash, así que dos personas pueden
 * caer en el mismo color: el color ayuda a encontrar, el nombre es el que
 * identifica.
 */
export function colorPersona(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COLORES_PERSONA[Math.abs(hash) % COLORES_PERSONA.length];
}

export const tareaInclude = {
  proyecto: { select: { id: true, nombre: true } },
  // Sin `codigoPrefijo`: el código del rubro sirve para armar códigos de
  // materiales, no aporta nada al leer una tarea.
  rubro: { select: { id: true, nombre: true } },
  asignados: { include: { user: { select: { id: true, nombre: true } } } },
  // El checklist se ordena por `orden` (el que le dio el usuario al cargarlo) y
  // no por fecha, así no se le mueven los pasos de lugar al editarlos.
  //
  // `items` trae solo los sueltos (los que no están en ninguna sección); los
  // demás vienen dentro de su sección, ya agrupados como se muestran.
  items: { where: { seccionId: null }, orderBy: { orden: "asc" } },
  secciones: {
    orderBy: { orden: "asc" },
    include: { items: { orderBy: { orden: "asc" } } },
  },
} satisfies Prisma.TareaInclude;

export type TareaConRelaciones = Prisma.TareaGetPayload<{ include: typeof tareaInclude }>;

/** Opción de un desplegable/filtro: rubro, obra o persona. */
export type OpcionSimple = { id: string; nombre: string };

/** Un paso del checklist de una tarea. */
export type TareaItemOpcion = {
  id: string;
  texto: string;
  completado: boolean;
};

/** Bloque de sub ítems dentro de una tarea. */
export type TareaSeccionOpcion = {
  id: string;
  titulo: string;
  items: TareaItemOpcion[];
};

/**
 * Circuito de una tarea: se hace, se manda a revisar (o no) y se aprueba.
 *
 * El paso por revisión es opcional: al tildar una tarea se elige si va a
 * revisión o si se da por terminada ahí mismo. Desde revisión se aprueba
 * (COMPLETADA) o se devuelve, y volver a PENDIENTE no es un estado nuevo sino
 * el mismo de siempre con `aCorregir` prendido: la tarea tiene que reaparecer
 * entre las pendientes, no en una cuarta lista aparte.
 */
export type EstadoTarea = "PENDIENTE" | "EN_REVISION" | "COMPLETADA";

export const ESTADO_TAREA_LABELS: Record<EstadoTarea, string> = {
  PENDIENTE: "Pendientes",
  EN_REVISION: "En revisión",
  COMPLETADA: "Completadas",
};

export type TareaOpcion = {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  titulo: string;
  descripcion: string | null;
  rubroId: string | null;
  rubroNombre: string | null;
  prioridad: Prioridad;
  estado: EstadoTarea;
  completadaEl: string | null;
  /** Desde cuándo espera revisión. Solo tiene valor mientras está EN_REVISION. */
  enRevisionEl: string | null;
  /** La devolvieron de la revisión: se muestra con el cartelito "Corregir". */
  aCorregir: boolean;
  /** Qué hay que corregir. Se puede devolver sin escribir nada. */
  correccionNota: string | null;
  createdAt: string;
  asignados: { id: string; nombre: string }[];
  /** Sub ítems sueltos, los que no están dentro de ninguna sección. */
  items: TareaItemOpcion[];
  secciones: TareaSeccionOpcion[];
};

export function mapTarea(t: TareaConRelaciones): TareaOpcion {
  return {
    id: t.id,
    proyectoId: t.proyectoId,
    proyectoNombre: t.proyecto.nombre,
    titulo: t.titulo,
    descripcion: t.descripcion,
    rubroId: t.rubroId,
    rubroNombre: t.rubro?.nombre ?? null,
    prioridad: t.prioridad,
    estado: t.estado,
    completadaEl: t.completadaEl?.toISOString() ?? null,
    enRevisionEl: t.enRevisionEl?.toISOString() ?? null,
    aCorregir: t.aCorregir,
    correccionNota: t.correccionNota,
    createdAt: t.createdAt.toISOString(),
    asignados: t.asignados.map((a) => ({ id: a.user.id, nombre: a.user.nombre })),
    items: t.items.map(mapItem),
    secciones: t.secciones.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      items: s.items.map(mapItem),
    })),
  };
}

function mapItem(i: { id: string; texto: string; completado: boolean }): TareaItemOpcion {
  return { id: i.id, texto: i.texto, completado: i.completado };
}

/** Todos los sub ítems de la tarea: los sueltos y los de todas las secciones. */
export function todosLosItems(tarea: TareaOpcion): TareaItemOpcion[] {
  return [...tarea.items, ...tarea.secciones.flatMap((s) => s.items)];
}

/**
 * Avance del checklist, contando sueltos y de secciones juntos. Devuelve null
 * cuando la tarea no tiene sub ítems, para que la vista sepa que no hay nada
 * que mostrar (y no dibuje un "0/0").
 */
export function avanceItems(tarea: TareaOpcion): { hechos: number; total: number } | null {
  const items = todosLosItems(tarea);
  if (items.length === 0) return null;
  return {
    hechos: items.filter((i) => i.completado).length,
    total: items.length,
  };
}

const ORDEN_ESTADO: Record<EstadoTarea, number> = {
  PENDIENTE: 0,
  EN_REVISION: 1,
  COMPLETADA: 2,
};

/**
 * Orden de la lista: por fecha de creación, de la más nueva a la más vieja.
 *
 * La prioridad ya no interviene. Ordenar por prioridad hacía que una tarea
 * recién cargada apareciera en el medio de la lista, según el color que le
 * hubieras puesto, y era difícil encontrarla; con la fecha, lo último que
 * cargaste está siempre arriba. La prioridad sigue a la vista en el badge y se
 * puede filtrar por ella.
 *
 * Antes que la fecha se miran dos cosas:
 *
 * - El estado, que las agrupa en el orden del circuito. Ahora cada estado tiene
 *   su propia solapa, así que casi nunca conviven en la misma lista, pero el
 *   orden queda igual por si alguna vista las junta.
 * - Lo que volvió de la revisión, que va arriba de todo entre las pendientes:
 *   es trabajo que alguien ya dio por hecho y quedó frenado esperando el
 *   arreglo, así que es lo primero que hay que ver.
 *
 * Las que están en revisión se ordenan al revés, de la que hace más tiempo que
 * espera a la más reciente: ahí lo que interesa es destrabar lo más viejo.
 */
export function ordenarTareas(tareas: TareaOpcion[]): TareaOpcion[] {
  return [...tareas].sort((a, b) => {
    if (a.estado !== b.estado) return ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
    if (a.estado === "EN_REVISION") {
      // `?? createdAt`: las que ya estaban en la base antes de que existiera la
      // revisión no tienen fecha, y sin este respaldo caerían todas juntas.
      const espera = (t: TareaOpcion) => t.enRevisionEl ?? t.createdAt;
      return espera(a).localeCompare(espera(b));
    }
    if (a.aCorregir !== b.aCorregir) return a.aCorregir ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
