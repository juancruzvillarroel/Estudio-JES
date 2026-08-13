import * as z from "zod";

export const MedioPagoSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  nombre: z.string().min(1, "Ingresá el nombre del medio de pago"),
  incluyeIva: z.boolean().default(false),
});

export type MedioPagoInput = z.infer<typeof MedioPagoSchema>;

export const MedioPagoUpdateSchema = MedioPagoSchema.pick({
  nombre: true,
  incluyeIva: true,
});

export type MedioPagoUpdateInput = z.infer<typeof MedioPagoUpdateSchema>;
