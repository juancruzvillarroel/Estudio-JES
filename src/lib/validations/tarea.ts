import * as z from "zod";

const ItemSchema = z.object({
  id: z.string().optional(),
  texto: z.string().trim().min(1, "El sub ítem no puede estar vacío"),
});

export const TareaSchema = z.object({
  proyectoId: z.string().min(1, "Elegí una obra"),
  titulo: z.string().trim().min(1, "Ingresá un título para la tarea"),
  descripcion: z.string().trim().optional(),
  // Cadena vacía = "sin rubro": es lo que devuelve el <Select> cuando se elige
  // la opción en blanco, y se guarda como null.
  rubroId: z.string().optional(),
  prioridad: z.enum(["ALTA", "MEDIA", "BAJA"]).default("MEDIA"),
  asignadoIds: z.array(z.string()).default([]),
  // Checklist suelto (sin sección). El `id` viene solo en los ítems que ya
  // existían: sirve para conservar si estaban tildados en vez de recrearlos en
  // cada guardado. Los nuevos llegan sin id. El orden del array es el orden en
  // pantalla.
  items: z.array(ItemSchema).default([]),
  // Secciones con sus propios ítems. Mismo criterio con el `id`.
  secciones: z
    .array(
      z.object({
        id: z.string().optional(),
        titulo: z.string().trim().min(1, "La sección necesita un título"),
        items: z.array(ItemSchema).default([]),
      })
    )
    .default([]),
});

export type TareaInput = z.infer<typeof TareaSchema>;

export const TareaUpdateSchema = TareaSchema.omit({ proyectoId: true });

export type TareaUpdateInput = z.infer<typeof TareaUpdateSchema>;
