import * as z from "zod";

/**
 * Un nivel de la obra. Lo único que tiene es un nombre, y por eso el nombre es
 * lo único que se valida: se escribe como se lo llama en la obra ("PLANTA
 * TIPO", "4TO PISO") y el programa no le impone ningún formato.
 *
 * El tope de 40 caracteres no es una regla de negocio, es el ancho con el que
 * el nombre todavía entra en el desplegable de una fila del cómputo sin
 * romperlo.
 */
export const NivelProyectoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribí el nombre del nivel")
    .max(40, "El nombre del nivel es demasiado largo"),
});

export type NivelProyectoInput = z.infer<typeof NivelProyectoSchema>;
