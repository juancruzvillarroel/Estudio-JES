import * as z from "zod";

import { UNIDADES } from "@/lib/computos";

/**
 * Una dimensión de una fila medida (largo, ancho, alto).
 *
 * Vacío es válido y significa "no la cargué todavía": el cómputo se arma de a
 * poco y obligar a completar las tres celdas para guardar una fila rompería esa
 * forma de trabajar. Lo que no se acepta es cero ni negativo, que no son medidas
 * a medio cargar sino errores de tipeo.
 */
const dimension = z
  .number({ error: "Ingresá un número válido" })
  .positive("La medida tiene que ser mayor a 0")
  .nullish();

export const ItemSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del ítem es obligatorio"),
  unidad: z.enum(UNIDADES as [string, ...string[]], { error: "Elegí una unidad" }),
  rubroId: z.string().min(1, "Elegí un rubro"),
  subrubroId: z.string().nullish(),
  notas: z.string().trim().nullish(),
});

export type ItemInput = z.infer<typeof ItemSchema>;

export const MedicionSchema = z.object({
  descripcion: z.string().trim().nullish(),
  // El nivel de la obra donde va esta fila. Vacío es válido: hay trabajos que
  // no son de ninguna planta (excavación, obrador, cerco). Que el nivel sea de
  // ESTA obra se controla en la acción, donde se puede consultar la base.
  nivelId: z.string().trim().nullish(),
  // Default 1 para que cargar una medida suelta sea escribir sólo las
  // dimensiones: el caso más común es una vez.
  cantidad: z
    .number({ error: "Ingresá una cantidad válida" })
    .positive("La cantidad tiene que ser mayor a 0")
    .default(1),
  largo: dimension,
  ancho: dimension,
  alto: dimension,
  deduccion: z.boolean().default(false),
});

export type MedicionInput = z.infer<typeof MedicionSchema>;

/**
 * Una fila derivada: de qué ítem sale, cuánto por unidad y cuánto se pierde.
 *
 * El desperdicio se admite en 0 (a diferencia de las dimensiones) porque hay
 * materiales donde no hay merma, y se topea en 100 porque más que eso no es un
 * porcentaje de roturas sino un coeficiente mal cargado.
 */
export const DerivadaSchema = z.object({
  origenId: z.string().min(1, "Elegí de qué ítem sale"),
  descripcion: z.string().trim().nullish(),
  cantidad: z
    .number({ error: "Ingresá un coeficiente válido" })
    .positive("El coeficiente tiene que ser mayor a 0"),
  desperdicio: z
    .number({ error: "Ingresá un porcentaje válido" })
    .min(0, "El desperdicio no puede ser negativo")
    .max(100, "El desperdicio no puede pasar el 100%")
    .nullish(),
  deduccion: z.boolean().default(false),
});

export type DerivadaInput = z.infer<typeof DerivadaSchema>;

export const ItemTipoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del ítem es obligatorio"),
  unidad: z.enum(UNIDADES as [string, ...string[]], { error: "Elegí una unidad" }),
  rubroId: z.string().min(1, "Elegí un rubro"),
  subrubroId: z.string().nullish(),
});

export type ItemTipoInput = z.infer<typeof ItemTipoSchema>;
