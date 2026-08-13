import type { Prisma } from "@/generated/prisma/client";

export const MONEDA_LABELS = { ARS: "Pesos (ARS)", USD: "Dólares (USD)" };

export const movimientoFondoInclude = {
  rubro: true,
  subrubro: true,
  proveedor: true,
  proyectoInversor: true,
  medioPago: true,
} satisfies Prisma.MovimientoFondoInclude;

export type MovimientoFondoConRelaciones = Prisma.MovimientoFondoGetPayload<{
  include: typeof movimientoFondoInclude;
}>;

export type MovimientoFondoOpcion = {
  id: string;
  proyectoId: string;
  tipo: "GASTO" | "APORTE";
  fecha: string;
  descripcion: string;
  monto: number;
  moneda: "ARS" | "USD";
  tipoCambio: number | null;
  rubroId: string | null;
  rubroNombre: string | null;
  subrubroId: string | null;
  subrubroNombre: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  proyectoInversorId: string | null;
  inversorNombre: string | null;
  notas: string | null;
  medioPagoId: string | null;
  medioPagoNombre: string | null;
  /**
   * Derivado del medio de pago: un gasto se considera facturado (con IVA)
   * cuando se pagó con un medio marcado como tal. Sin medio de pago cuenta
   * como no facturado.
   */
  facturado: boolean;
  archivoUrl: string | null;
};

export function mapMovimientoFondo(m: MovimientoFondoConRelaciones): MovimientoFondoOpcion {
  return {
    id: m.id,
    proyectoId: m.proyectoId,
    tipo: m.tipo,
    fecha: m.fecha.toISOString(),
    descripcion: m.descripcion,
    monto: Number(m.monto),
    moneda: m.moneda,
    tipoCambio: m.tipoCambio ? Number(m.tipoCambio) : null,
    rubroId: m.rubroId,
    rubroNombre: m.rubro?.nombre ?? null,
    subrubroId: m.subrubroId,
    subrubroNombre: m.subrubro?.nombre ?? null,
    proveedorId: m.proveedorId,
    proveedorNombre: m.proveedor?.nombre ?? null,
    proyectoInversorId: m.proyectoInversorId,
    inversorNombre: m.proyectoInversor?.nombre ?? null,
    notas: m.notas,
    medioPagoId: m.medioPagoId,
    medioPagoNombre: m.medioPago?.nombre ?? null,
    facturado: m.medioPago?.incluyeIva ?? false,
    archivoUrl: m.archivoUrl,
  };
}

export type ProyectoInversorOpcion = {
  id: string;
  proyectoId: string;
  inversorNombre: string;
  porcentaje: number;
};

export function mapProyectoInversor(item: {
  id: string;
  proyectoId: string;
  nombre: string;
  porcentaje: Prisma.Decimal;
}): ProyectoInversorOpcion {
  return {
    id: item.id,
    proyectoId: item.proyectoId,
    inversorNombre: item.nombre,
    porcentaje: Number(item.porcentaje),
  };
}

export type MedioPagoOpcion = {
  id: string;
  proyectoId: string;
  nombre: string;
  /** Los pagos con factura cuentan como gasto facturado (con IVA). */
  incluyeIva: boolean;
};

export function mapMedioPago(item: {
  id: string;
  proyectoId: string;
  nombre: string;
  incluyeIva: boolean;
}): MedioPagoOpcion {
  return {
    id: item.id,
    proyectoId: item.proyectoId,
    nombre: item.nombre,
    incluyeIva: item.incluyeIva,
  };
}

export type UnidadProyectoOpcion = {
  id: string;
  proyectoId: string;
  nombre: string;
  tipo: string | null;
  m2: number | null;
  estado: "DISPONIBLE" | "RESERVADA" | "VENDIDA";
};

export function mapUnidadProyecto(item: {
  id: string;
  proyectoId: string;
  nombre: string;
  tipo: string | null;
  m2: Prisma.Decimal | null;
  estado: "DISPONIBLE" | "RESERVADA" | "VENDIDA";
}): UnidadProyectoOpcion {
  return {
    id: item.id,
    proyectoId: item.proyectoId,
    nombre: item.nombre,
    tipo: item.tipo,
    m2: item.m2 ? Number(item.m2) : null,
    estado: item.estado,
  };
}
