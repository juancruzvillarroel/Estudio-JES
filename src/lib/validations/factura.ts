import * as z from "zod";

export const FacturaSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  proveedorId: z.string().min(1, "Elegí un proveedor"),
  numero: z.string().trim().min(1, "Ingresá el número de factura"),
  fecha: z.string().min(1, "Ingresá una fecha"),
  /**
   * Opcional a propósito: muchas facturas llegan sin fecha pactada y se pagan
   * cuando se puede. Las que no la tienen se agrupan aparte en la solapa, sin
   * ensuciar el orden de las que sí vencen.
   */
  fechaVencimiento: z.string().optional(),
  /**
   * El total que dice el papel, con IVA y descuentos ya aplicados. Va a mano
   * porque los precios del pedido no incluyen ninguna de esas dos cosas.
   */
  monto: z.number({ error: "Ingresá un monto" }).positive("El monto debe ser mayor a 0"),
  moneda: z.enum(["ARS", "USD"]),
  tipoCambio: z.number().positive("El tipo de cambio debe ser mayor a 0").optional(),
  rubroId: z.string().min(1, "Elegí un rubro"),
  subrubroId: z.string().optional(),
  notas: z.string().trim().optional(),
  /**
   * Los pedidos que la factura respalda. Puede ser ninguno: hay facturas que no
   * salen de un pedido (honorarios, un servicio) y se cargan sueltas.
   */
  pedidoIds: z.array(z.string()).default([]),
});

export type FacturaInput = z.infer<typeof FacturaSchema>;

/**
 * Una factura elegida para pagar, con cuánto se le imputa.
 *
 * El monto viaja por factura y no uno solo para todo el pago porque cada
 * factura genera su propio gasto (así cada uno conserva el rubro de la factura
 * que cancela). Se precarga con el saldo y se puede bajar para un pago parcial.
 */
const PagoFacturaSchema = z.object({
  facturaId: z.string().min(1),
  monto: z.number({ error: "Ingresá un monto" }).positive("El monto debe ser mayor a 0"),
});

/**
 * El pago de un conjunto de facturas.
 *
 * La fecha y el medio de pago son del pago entero —se cargan una sola vez— y
 * cada factura seleccionada termina en un gasto propio. Ver
 * `registrarPagoFacturas` en src/actions/facturas.ts.
 */
export const RegistrarPagoFacturasSchema = z.object({
  proyectoId: z.string().min(1, "Elegí un proyecto"),
  fecha: z.string().min(1, "Ingresá una fecha"),
  medioPagoId: z.string().optional(),
  /**
   * El cambio del día, para las facturas en pesos que lo necesiten. Se pide una
   * vez y se copia a cada gasto generado: todos se pagaron el mismo día, no hay
   * motivo para que tengan cotizaciones distintas.
   */
  tipoCambio: z.number().positive("El tipo de cambio debe ser mayor a 0").optional(),
  descripcion: z.string().trim().optional(),
  facturas: z.array(PagoFacturaSchema).min(1, "Elegí al menos una factura"),
});

export type RegistrarPagoFacturasInput = z.infer<typeof RegistrarPagoFacturasSchema>;
