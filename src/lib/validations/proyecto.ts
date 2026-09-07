import * as z from "zod";

export const ESTADOS_PROYECTO = ["ACTIVO", "PAUSADO", "FINALIZADO"] as const;

export const ProyectoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  barrio: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  estado: z.enum(ESTADOS_PROYECTO).default("ACTIVO"),
  descripcion: z.string().trim().optional(),
  // Pisos por encima de planta baja (ver DocumentoCategoria.porPiso).
  cantidadPisos: z.coerce.number().int().min(0).default(0),
});

export type ProyectoInput = z.infer<typeof ProyectoSchema>;

/**
 * Metros cuadrados vendibles totales de la obra. Se cargan aparte del resto
 * de los datos del proyecto (desde Flujo de fondos > Datos del proyecto).
 * `null` significa "sin cargar": en ese caso el resumen no puede calcular
 * los costos por m².
 */
export const ProyectoM2VendiblesSchema = z.object({
  m2Vendibles: z
    .number({ message: "Los m² vendibles tienen que ser un número" })
    .positive("Los m² vendibles tienen que ser mayores a 0")
    .nullable(),
});

export type ProyectoM2VendiblesInput = z.infer<typeof ProyectoM2VendiblesSchema>;

/**
 * Porcentaje de honorarios que cobra el estudio sobre los gastos de la obra.
 * Se carga desde Flujo de fondos > Datos del proyecto. `null` es "sin
 * definir": la calculadora muestra la base pero no propone monto.
 *
 * El tope de 100 es a propósito flojo: el honorario habitual ronda el 12%,
 * pero no hay motivo para pelearle al usuario si en una obra puntual cobra
 * otra cosa. Lo que sí se rechaza es un negativo o algo que no sea número.
 */
export const ProyectoPorcentajeHonorariosSchema = z.object({
  porcentajeHonorarios: z
    .number({ message: "El porcentaje tiene que ser un número" })
    .min(0, "El porcentaje no puede ser negativo")
    .max(100, "El porcentaje no puede ser mayor a 100")
    .nullable(),
});

export type ProyectoPorcentajeHonorariosInput = z.infer<
  typeof ProyectoPorcentajeHonorariosSchema
>;

/**
 * Arranque y largo de la obra. Es la línea de tiempo contra la que se ubican
 * las barras del presupuesto: sin estos dos datos la solapa Presupuesto no
 * tiene eje horizontal y lo único que puede hacer es pedirlos.
 *
 * La fecha llega como "AAAA-MM-DD" (lo que da un <input type="date">) y no como
 * Date porque viaja de cliente a servidor en una server action, y ahí un Date
 * se serializa a UTC: cargar el 1 de marzo desde Argentina lo guardaría como el
 * 28 de febrero a las 21:00. Se arma la fecha en el servidor a mediodía UTC
 * para que ningún huso la corra de día.
 *
 * El largo va en meses y no como fecha de fin porque así se piensa y así se
 * carga ("la obra son 24 meses"). El tope de 120 (diez años) no es una regla
 * del negocio: es para que un dedazo no dibuje una grilla de mil columnas.
 */
export const ProyectoFechaObraSchema = z.object({
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio no es válida")
    .nullable(),
  duracionMeses: z
    .number({ message: "La duración tiene que ser un número" })
    .int("La duración tiene que ser un número entero de meses")
    .min(1, "La duración tiene que ser de al menos un mes")
    .max(120, "La duración no puede superar los 120 meses")
    .nullable(),
});

export type ProyectoFechaObraInput = z.infer<typeof ProyectoFechaObraSchema>;
