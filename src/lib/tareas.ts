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
 * Peso para ordenar: las tareas más urgentes primero. Coincide con el orden
 * en que se listan las prioridades en el formulario.
 */
export const PRIORIDAD_ORDEN: Record<Prioridad, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAJA: 2,
};

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

export type TareaOpcion = {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  titulo: string;
  descripcion: string | null;
  rubroId: string | null;
  rubroNombre: string | null;
  prioridad: Prioridad;
  estado: "PENDIENTE" | "COMPLETADA";
  completadaEl: string | null;
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

/**
 * Orden de la lista: primero las pendientes, dentro de ellas por prioridad
 * (alta arriba) y, a igual prioridad, la más nueva primero. Las completadas
 * van al final, también de la más reciente a la más vieja.
 */
export function ordenarTareas(tareas: TareaOpcion[]): TareaOpcion[] {
  return [...tareas].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "PENDIENTE" ? -1 : 1;
    if (a.estado === "PENDIENTE") {
      const porPrioridad = PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad];
      if (porPrioridad !== 0) return porPrioridad;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
