import type { Prisma } from "@/generated/prisma/client";

export const facturaInclude = {
  proveedor: { select: { id: true, nombre: true } },
  rubro: { select: { id: true, nombre: true } },
  subrubro: { select: { id: true, nombre: true } },
  pedidos: { select: { id: true, numero: true } },
  pagos: {
    select: { id: true, fecha: true, monto: true, moneda: true, tipoCambio: true },
    orderBy: { fecha: "asc" },
  },
} satisfies Prisma.FacturaInclude;

export type FacturaConRelaciones = Prisma.FacturaGetPayload<{
  include: typeof facturaInclude;
}>;

export type PagoFacturaOpcion = {
  id: string;
  fecha: string;
  monto: number;
};

export type FacturaOpcion = {
  id: string;
  proyectoId: string;
  proveedorId: string;
  proveedorNombre: string;
  numero: string;
  fecha: string;
  /** "AAAA-MM-DD" o null. Ver `aDiaCalendario` para por qué no viaja un Date. */
  fechaVencimiento: string | null;
  monto: number;
  moneda: "ARS" | "USD";
  tipoCambio: number | null;
  rubroId: string;
  rubroNombre: string;
  subrubroId: string | null;
  subrubroNombre: string | null;
  archivoUrl: string | null;
  notas: string | null;
  /** Los pedidos que respalda, para mostrar "#0012, #0015" en la lista. */
  pedidos: { id: string; numero: number }[];
  pagos: PagoFacturaOpcion[];
  /**
   * Lo que ya se pagó, en la moneda de la factura. Solo se suman los pagos de
   * esa moneda: un pago en pesos de una factura en dólares no se puede imputar
   * sin decidir a qué cambio, y adivinarlo daría un saldo falso.
   */
  pagado: number;
  /** Monto menos lo pagado. Cero o negativo significa cancelada. */
  saldo: number;
};

/**
 * Pasa una fecha a "AAAA-MM-DD" tomando el día en UTC.
 *
 * Las fechas de factura se guardan al mediodía UTC, igual que la fecha de
 * inicio de obra, para que ningún huso las corra de día. Recortar el ISO es
 * seguro justamente por eso.
 */
function aDiaCalendario(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export function mapFactura(f: FacturaConRelaciones): FacturaOpcion {
  const monto = Number(f.monto);
  const pagado = f.pagos
    .filter((p) => p.moneda === f.moneda)
    .reduce((acc, p) => acc + Number(p.monto), 0);

  return {
    id: f.id,
    proyectoId: f.proyectoId,
    proveedorId: f.proveedorId,
    proveedorNombre: f.proveedor.nombre,
    numero: f.numero,
    fecha: aDiaCalendario(f.fecha),
    fechaVencimiento: f.fechaVencimiento ? aDiaCalendario(f.fechaVencimiento) : null,
    monto,
    moneda: f.moneda,
    tipoCambio: f.tipoCambio ? Number(f.tipoCambio) : null,
    rubroId: f.rubroId,
    rubroNombre: f.rubro.nombre,
    subrubroId: f.subrubroId,
    subrubroNombre: f.subrubro?.nombre ?? null,
    archivoUrl: f.archivoUrl,
    notas: f.notas,
    pedidos: f.pedidos.map((p) => ({ id: p.id, numero: p.numero })),
    pagos: f.pagos.map((p) => ({
      id: p.id,
      fecha: aDiaCalendario(p.fecha),
      monto: Number(p.monto),
    })),
    pagado,
    saldo: monto - pagado,
  };
}

/**
 * Una factura está pendiente mientras le quede saldo.
 *
 * Se compara contra un centavo y no contra cero por los redondeos de los pagos
 * parciales: tres pagos de un tercio dejan un resto de fracciones de centavo
 * que no es una deuda, es ruido, y no tiene por qué seguir apareciendo en la
 * lista de lo que hay que pagar.
 */
export function estaPendiente(factura: FacturaOpcion) {
  return factura.saldo > 0.01;
}

export type TramoVencimiento = "VENCIDA" | "ESTA_SEMANA" | "ESTE_MES" | "MAS_ADELANTE" | "SIN_FECHA";

export const TRAMO_LABELS: Record<TramoVencimiento, string> = {
  VENCIDA: "Vencidas",
  ESTA_SEMANA: "Vencen en 7 días",
  ESTE_MES: "Vencen en 30 días",
  MAS_ADELANTE: "Más adelante",
  SIN_FECHA: "Sin fecha de vencimiento",
};

/** El orden en que se muestran los grupos: primero lo que aprieta. */
export const TRAMOS_ORDENADOS: TramoVencimiento[] = [
  "VENCIDA",
  "ESTA_SEMANA",
  "ESTE_MES",
  "MAS_ADELANTE",
  "SIN_FECHA",
];

/**
 * En qué tramo de vencimiento cae una factura.
 *
 * `hoy` se recibe como "AAAA-MM-DD" en vez de calcularlo acá adentro porque
 * esto corre en el cliente: si cada llamada armara su propio `new Date()`, el
 * servidor y el navegador podrían resolver días distintos y la lista se
 * reordenaría sola en la hidratación.
 */
export function tramoVencimiento(factura: FacturaOpcion, hoy: string): TramoVencimiento {
  if (!factura.fechaVencimiento) return "SIN_FECHA";
  if (factura.fechaVencimiento < hoy) return "VENCIDA";

  const dias = diasEntre(hoy, factura.fechaVencimiento);
  if (dias <= 7) return "ESTA_SEMANA";
  if (dias <= 30) return "ESTE_MES";
  return "MAS_ADELANTE";
}

/**
 * El día de hoy en Buenos Aires, como "AAAA-MM-DD".
 *
 * Se calcula en el servidor y viaja como prop hasta la solapa: el servidor
 * corre en UTC, así que después de las nueve de la noche `new Date()` ya está
 * en el día siguiente y las facturas que vencen mañana aparecerían vencidas.
 * Fijar el huso lo evita, y mandar el resultado ya resuelto evita además que el
 * navegador calcule uno distinto y la lista se reordene sola en la hidratación.
 */
export function diaHoyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Días entre dos "AAAA-MM-DD". Ambas se leen a mediodía UTC, sin husos de por medio. */
function diasEntre(desde: string, hasta: string) {
  const a = Date.parse(`${desde}T12:00:00.000Z`);
  const b = Date.parse(`${hasta}T12:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}
