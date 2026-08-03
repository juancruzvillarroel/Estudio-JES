import type { Prisma } from "@/generated/prisma/client";

export const MONEDA_LABELS = { ARS: "Pesos (ARS)", USD: "Dólares (USD)" };
export const MEDIO_PAGO_LABELS = {
  Efectivo: "Efectivo",
  Transferencia: "Transferencia",
  Cheque: "Cheque",
  Tarjeta: "Tarjeta",
  Otro: "Otro",
};

export const movimientoFondoInclude = {
  rubro: true,
  subrubro: true,
  proveedor: true,
  proyectoInversor: true,
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
  medioPago: string | null;
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
    medioPago: m.medioPago,
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
