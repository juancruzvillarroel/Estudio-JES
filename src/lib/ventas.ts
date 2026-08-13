import type { Prisma } from "@/generated/prisma/client";

export const ventaInclude = {
  unidad: true,
  medioPago: true,
  cuotas: { orderBy: [{ esAnticipo: "desc" }, { numero: "asc" }] },
} satisfies Prisma.VentaInclude;

export type VentaConRelaciones = Prisma.VentaGetPayload<{
  include: typeof ventaInclude;
}>;

export type VentaCuotaOpcion = {
  id: string;
  numero: number;
  esAnticipo: boolean;
  fecha: string;
  monto: number;
  cobrada: boolean;
  fechaCobro: string | null;
};

export type VentaOpcion = {
  id: string;
  proyectoId: string;
  unidadId: string;
  unidadNombre: string;
  compradorNombre: string;
  fecha: string;
  moneda: "ARS" | "USD";
  precioTotal: number;
  modalidad: "CONTADO" | "FINANCIADO";
  medioPagoId: string | null;
  medioPagoNombre: string | null;
  notas: string | null;
  cuotas: VentaCuotaOpcion[];
};

export function mapVentaCuota(c: {
  id: string;
  numero: number;
  esAnticipo: boolean;
  fecha: Date;
  monto: Prisma.Decimal;
  cobrada: boolean;
  fechaCobro: Date | null;
}): VentaCuotaOpcion {
  return {
    id: c.id,
    numero: c.numero,
    esAnticipo: c.esAnticipo,
    fecha: c.fecha.toISOString(),
    monto: Number(c.monto),
    cobrada: c.cobrada,
    fechaCobro: c.fechaCobro ? c.fechaCobro.toISOString() : null,
  };
}

export function mapVenta(v: VentaConRelaciones): VentaOpcion {
  return {
    id: v.id,
    proyectoId: v.proyectoId,
    unidadId: v.unidadId,
    unidadNombre: v.unidad.nombre,
    compradorNombre: v.compradorNombre,
    fecha: v.fecha.toISOString(),
    moneda: v.moneda,
    precioTotal: Number(v.precioTotal),
    modalidad: v.modalidad,
    medioPagoId: v.medioPagoId,
    medioPagoNombre: v.medioPago?.nombre ?? null,
    notas: v.notas,
    cuotas: v.cuotas.map(mapVentaCuota),
  };
}
