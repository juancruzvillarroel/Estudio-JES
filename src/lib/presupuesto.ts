import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";

/**
 * Presupuesto proyectado de una obra: cuánto se planea gastar por rubro y
 * cuándo.
 *
 * La idea central es que los montos mensuales no se cargan ni se guardan: se
 * derivan de tres datos por línea —un total, un tramo de meses y una curva—.
 * Eso es lo que separa esto de una planilla. Correr una etapa dos meses es
 * arrastrar una barra, no reescribir doce celdas; y cambiar el total redistribuye
 * todo solo.
 *
 * Todo se maneja en dólares, igual que el resto de Flujo de fondos.
 */

export type CurvaPresupuesto = "UNIFORME" | "CRECIENTE" | "DECRECIENTE" | "CAMPANA";

export const CURVAS: CurvaPresupuesto[] = ["UNIFORME", "CRECIENTE", "DECRECIENTE", "CAMPANA"];

/** Nombre y explicación de cada curva, para los selectores y la ayuda. */
export const CURVA_INFO: Record<
  CurvaPresupuesto,
  { nombre: string; ayuda: string; ejemplo: string }
> = {
  UNIFORME: {
    nombre: "Pareja",
    ayuda: "Todos los meses el mismo monto.",
    ejemplo: "Alquileres, sueldos, seguros.",
  },
  CRECIENTE: {
    nombre: "Creciente",
    ayuda: "Arranca despacio y termina fuerte.",
    ejemplo: "Terminaciones, carpinterías, equipamiento.",
  },
  DECRECIENTE: {
    nombre: "Decreciente",
    ayuda: "Arranca fuerte y va aflojando.",
    ejemplo: "Demolición, movimiento de suelos, excavación.",
  },
  CAMPANA: {
    nombre: "Campana",
    ayuda: "Poco al principio y al final, el grueso en el medio.",
    ejemplo: "Estructura, albañilería, instalaciones.",
  },
};

export type PresupuestoItemOpcion = {
  id: string;
  proyectoId: string;
  rubroId: string;
  subrubroId: string | null;
  montoUSD: number;
  mesInicio: number;
  duracionMeses: number;
  curva: CurvaPresupuesto;
  notas: string | null;
};

export function mapPresupuestoItem(item: {
  id: string;
  proyectoId: string;
  rubroId: string;
  subrubroId: string | null;
  montoUSD: unknown;
  mesInicio: number;
  duracionMeses: number;
  curva: string;
  notas: string | null;
}): PresupuestoItemOpcion {
  return {
    id: item.id,
    proyectoId: item.proyectoId,
    rubroId: item.rubroId,
    subrubroId: item.subrubroId,
    montoUSD: Number(item.montoUSD),
    mesInicio: item.mesInicio,
    duracionMeses: item.duracionMeses,
    curva: item.curva as CurvaPresupuesto,
    notas: item.notas,
  };
}

/**
 * Peso de cada mes dentro de una línea, normalizado para que sumen 1.
 *
 * Se calcula con fórmulas y no con tablas fijas porque la duración es variable:
 * la misma curva tiene que servir para una línea de 2 meses y para una de 18.
 *
 * Las formas son suaves a propósito. Una campana muy marcada dejaría los meses
 * de los extremos casi en cero, y un mes en cero en el medio de un tramo se lee
 * como un error de carga en vez de como una decisión.
 */
export function pesosCurva(curva: CurvaPresupuesto, duracionMeses: number): number[] {
  const n = Math.max(1, Math.floor(duracionMeses));
  if (n === 1) return [1];

  const crudos: number[] = [];
  for (let i = 0; i < n; i++) {
    // Posición dentro del tramo, de 0 a 1.
    const t = i / (n - 1);
    switch (curva) {
      case "UNIFORME":
        crudos.push(1);
        break;
      // Rampas que van de 0,5 a 1,5: el último mes pesa el triple del primero.
      // Alcanza para que la forma se vea sin que los extremos queden vacíos.
      case "CRECIENTE":
        crudos.push(0.5 + t);
        break;
      case "DECRECIENTE":
        crudos.push(1.5 - t);
        break;
      // Media onda de seno, levantada para que las puntas no toquen cero.
      case "CAMPANA":
        crudos.push(0.35 + Math.sin(Math.PI * t));
        break;
    }
  }

  const suma = crudos.reduce((acc, p) => acc + p, 0);
  return crudos.map((p) => p / suma);
}

/**
 * Reparte el monto de una línea en sus meses.
 *
 * El último mes se calcula por resta en vez de por peso: los redondeos de los
 * meses anteriores se acumulan ahí y así la suma da exactamente el total. Sin
 * esto, un presupuesto de 100.000 podía mostrar 99.999,97 abajo de todo, que es
 * el tipo de detalle que hace desconfiar de todo el resto del número.
 */
export function distribuir(
  montoUSD: number,
  curva: CurvaPresupuesto,
  duracionMeses: number
): number[] {
  const pesos = pesosCurva(curva, duracionMeses);
  const montos = pesos.map((p) => redondear(montoUSD * p));
  const acumuladoSinUltimo = montos.slice(0, -1).reduce((acc, m) => acc + m, 0);
  montos[montos.length - 1] = redondear(montoUSD - acumuladoSinUltimo);
  return montos;
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/*  Línea de tiempo                                                            */
/* -------------------------------------------------------------------------- */

const MESES_ABREV = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Clave de mes "YYYY-MM", que es la que ordena bien como texto. */
export function claveMes(fechaISO: string) {
  return fechaISO.slice(0, 7);
}

export function sumarMeses(clave: string, delta: number) {
  const [anio, mes] = clave.split("-").map(Number);
  const total = anio * 12 + (mes - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** "2026-03" → "mar-26". */
export function formatMes(clave: string) {
  const [anio, mes] = clave.split("-").map(Number);
  return `${MESES_ABREV[mes - 1]}-${String(anio).slice(2)}`;
}

/** "2026-03" → "marzo 2026", para títulos y tooltips. */
export function formatMesLargo(clave: string) {
  const [anio, mes] = clave.split("-").map(Number);
  const nombre = new Date(Date.UTC(anio, mes - 1, 1)).toLocaleDateString("es-AR", {
    month: "long",
    timeZone: "UTC",
  });
  return `${nombre} ${anio}`;
}

/** Los meses de la obra, desde la fecha de inicio y por la duración cargada. */
export function mesesDeObra(fechaInicioISO: string, duracionMeses: number): string[] {
  const primero = claveMes(fechaInicioISO);
  return Array.from({ length: Math.max(1, duracionMeses) }, (_, i) => sumarMeses(primero, i));
}

/* -------------------------------------------------------------------------- */
/*  Armado de la grilla                                                        */
/* -------------------------------------------------------------------------- */

export type FilaPresupuesto = {
  /** Id del rubro o del subrubro, según el nivel. */
  id: string;
  nombre: string;
  /** La línea guardada, si este nivel tiene una. */
  item: PresupuestoItemOpcion | null;
  /** Total presupuestado. En un rubro con subrubros, la suma de ellos. */
  presupuestado: number;
  /** Gasto real acumulado del nivel, para comparar. */
  ejecutado: number;
  /** Presupuestado por mes, indexado por clave "YYYY-MM". */
  porMes: Map<string, number>;
  /** Ejecutado por mes, misma indexación. */
  ejecutadoPorMes: Map<string, number>;
};

export type FilaRubroPresupuesto = FilaPresupuesto & {
  subrubros: FilaPresupuesto[];
  /**
   * Si el total sale de los subrubros. Cuando es true la línea del rubro no se
   * puede editar directo: se edita bajando al detalle.
   */
  derivado: boolean;
};

export type GrillaPresupuesto = {
  meses: string[];
  filas: FilaRubroPresupuesto[];
  totalPresupuestado: number;
  totalEjecutado: number;
  porMes: Map<string, number>;
  ejecutadoPorMes: Map<string, number>;
  acumuladoPorMes: Map<string, number>;
  /** Gastos en pesos sin tipo de cambio, que no se pueden comparar. */
  gastosSinTipoCambio: number;
};

type RubroEntrada = {
  id: string;
  nombre: string;
  subrubros: { id: string; nombre: string }[];
};

/** Pasa un movimiento a dólares, o null si está en pesos y no tiene cambio. */
function montoUSD(m: MovimientoFondoOpcion): number | null {
  if (m.moneda === "USD") return m.monto;
  if (m.tipoCambio) return m.monto / m.tipoCambio;
  return null;
}

function filaVacia(id: string, nombre: string): FilaPresupuesto {
  return {
    id,
    nombre,
    item: null,
    presupuestado: 0,
    ejecutado: 0,
    porMes: new Map(),
    ejecutadoPorMes: new Map(),
  };
}

/**
 * Arma la tabla completa: una fila por rubro, con sus subrubros adentro, el
 * reparto mensual de lo presupuestado y lo que realmente se gastó.
 *
 * La regla que evita contar dos veces: si un rubro tiene aunque sea un subrubro
 * presupuestado, el total del rubro es la suma de los subrubros y su propia
 * línea se ignora. Es lo que uno espera al bajar al detalle, y sin la regla un
 * rubro cargado a los dos niveles se sumaba a sí mismo.
 */
export function armarGrilla({
  rubros,
  items,
  movimientos,
  fechaInicio,
  duracionMeses,
}: {
  rubros: RubroEntrada[];
  items: PresupuestoItemOpcion[];
  movimientos: MovimientoFondoOpcion[];
  /**
   * Null mientras no se cargó el arranque de la obra. En ese caso la grilla se
   * arma igual pero sin meses: los totales por rubro y lo ejecutado siguen
   * siendo válidos, y es lo que necesita la carga de montos. Solo el flujo
   * mensual queda vacío, que es exactamente lo que no se puede saber todavía.
   */
  fechaInicio: string | null;
  duracionMeses: number | null;
}): GrillaPresupuesto {
  const meses = fechaInicio && duracionMeses ? mesesDeObra(fechaInicio, duracionMeses) : [];

  const itemsPorRubro = new Map<string, PresupuestoItemOpcion>();
  const itemsPorSubrubro = new Map<string, PresupuestoItemOpcion>();
  for (const item of items) {
    if (item.subrubroId) itemsPorSubrubro.set(item.subrubroId, item);
    else itemsPorRubro.set(item.rubroId, item);
  }

  // Reparte una línea sobre los meses de la obra. Lo que cae fuera del tramo de
  // la obra se descarta: una línea que arranca en el mes 30 de una obra de 24 no
  // tiene dónde mostrarse, y sumarla al total diría que hay plata comprometida
  // en un mes que no existe.
  const repartir = (item: PresupuestoItemOpcion): Map<string, number> => {
    const montos = distribuir(item.montoUSD, item.curva, item.duracionMeses);
    const mapa = new Map<string, number>();
    montos.forEach((monto, i) => {
      const mes = meses[item.mesInicio + i];
      if (mes) mapa.set(mes, (mapa.get(mes) ?? 0) + monto);
    });
    return mapa;
  };

  const gastos = movimientos.filter((m) => m.tipo === "GASTO");
  let gastosSinTipoCambio = 0;

  // Gasto real por rubro y por subrubro, mes a mes.
  const realRubro = new Map<string, Map<string, number>>();
  const realSubrubro = new Map<string, Map<string, number>>();
  const totalRealRubro = new Map<string, number>();
  const totalRealSubrubro = new Map<string, number>();

  for (const gasto of gastos) {
    const usd = montoUSD(gasto);
    if (usd === null) {
      gastosSinTipoCambio++;
      continue;
    }
    const mes = claveMes(gasto.fecha.slice(0, 10));

    if (gasto.rubroId) {
      const mapa = realRubro.get(gasto.rubroId) ?? new Map<string, number>();
      mapa.set(mes, (mapa.get(mes) ?? 0) + usd);
      realRubro.set(gasto.rubroId, mapa);
      totalRealRubro.set(gasto.rubroId, (totalRealRubro.get(gasto.rubroId) ?? 0) + usd);
    }
    if (gasto.subrubroId) {
      const mapa = realSubrubro.get(gasto.subrubroId) ?? new Map<string, number>();
      mapa.set(mes, (mapa.get(mes) ?? 0) + usd);
      realSubrubro.set(gasto.subrubroId, mapa);
      totalRealSubrubro.set(
        gasto.subrubroId,
        (totalRealSubrubro.get(gasto.subrubroId) ?? 0) + usd
      );
    }
  }

  const filas: FilaRubroPresupuesto[] = rubros.map((rubro) => {
    const subrubros: FilaPresupuesto[] = rubro.subrubros.map((sub) => {
      const item = itemsPorSubrubro.get(sub.id) ?? null;
      const fila = filaVacia(sub.id, sub.nombre);
      fila.item = item;
      if (item) {
        fila.porMes = repartir(item);
        fila.presupuestado = item.montoUSD;
      }
      fila.ejecutadoPorMes = realSubrubro.get(sub.id) ?? new Map();
      fila.ejecutado = totalRealSubrubro.get(sub.id) ?? 0;
      return fila;
    });

    const conPresupuesto = subrubros.filter((s) => s.item !== null);
    const derivado = conPresupuesto.length > 0;

    const fila: FilaRubroPresupuesto = {
      ...filaVacia(rubro.id, rubro.nombre),
      subrubros,
      derivado,
    };

    if (derivado) {
      // El rubro es la suma de sus subrubros presupuestados.
      for (const sub of conPresupuesto) {
        fila.presupuestado += sub.presupuestado;
        for (const [mes, monto] of sub.porMes) {
          fila.porMes.set(mes, (fila.porMes.get(mes) ?? 0) + monto);
        }
      }
    } else {
      const item = itemsPorRubro.get(rubro.id) ?? null;
      fila.item = item;
      if (item) {
        fila.porMes = repartir(item);
        fila.presupuestado = item.montoUSD;
      }
    }

    // El ejecutado del rubro sale siempre de los gastos cargados con ese rubro,
    // tenga o no subrubros: un gasto puede estar clasificado solo a nivel rubro.
    fila.ejecutadoPorMes = realRubro.get(rubro.id) ?? new Map();
    fila.ejecutado = totalRealRubro.get(rubro.id) ?? 0;

    return fila;
  });

  const porMes = new Map<string, number>();
  const ejecutadoPorMes = new Map<string, number>();
  for (const mes of meses) {
    porMes.set(
      mes,
      filas.reduce((acc, f) => acc + (f.porMes.get(mes) ?? 0), 0)
    );
    ejecutadoPorMes.set(
      mes,
      filas.reduce((acc, f) => acc + (f.ejecutadoPorMes.get(mes) ?? 0), 0)
    );
  }

  const acumuladoPorMes = new Map<string, number>();
  let acumulado = 0;
  for (const mes of meses) {
    acumulado += porMes.get(mes) ?? 0;
    acumuladoPorMes.set(mes, acumulado);
  }

  return {
    meses,
    filas,
    totalPresupuestado: filas.reduce((acc, f) => acc + f.presupuestado, 0),
    totalEjecutado: filas.reduce((acc, f) => acc + f.ejecutado, 0),
    porMes,
    ejecutadoPorMes,
    acumuladoPorMes,
    gastosSinTipoCambio,
  };
}

/* -------------------------------------------------------------------------- */
/*  Estimado automático: en qué tramo de la obra cae cada rubro                */
/* -------------------------------------------------------------------------- */

/**
 * Cuándo pasa cada rubro, como fracción del plazo total de obra.
 *
 * Se guarda en fracciones y no en meses porque el mismo orden de tareas vale
 * para una obra de 10 meses y para una de 30: la estructura siempre arranca
 * apenas terminan los preliminares y la pintura siempre está sobre el final.
 * Multiplicando por la duración se obtienen los meses concretos.
 *
 * Es un punto de partida, no una verdad. La gracia es que apenas se carga un
 * monto ya aparece en el mes que le toca y el flujo del proyecto entero es
 * creíble desde el primer número, en vez de amontonar todo parejo a lo largo
 * de la obra —que es lo que pasaba antes y no le servía a nadie—.
 */
const TRAMOS_POR_RUBRO: Record<string, { desde: number; hasta: number; curva: CurvaPresupuesto }> =
  {
    // El terreno se paga antes de empezar: es un solo desembolso al inicio.
    "ADQUISICION DE TERRENO": { desde: 0, hasta: 0.04, curva: "UNIFORME" },
    "GASTOS MUNICIPALES": { desde: 0, hasta: 0.22, curva: "DECRECIENTE" },
    GESTORIA: { desde: 0, hasta: 0.35, curva: "DECRECIENTE" },
    // Corren todos los meses de la obra, de principio a fin.
    "GASTO FIJO": { desde: 0, hasta: 1, curva: "UNIFORME" },
    "HONORARIOS ESTUDIO ARQ": { desde: 0, hasta: 1, curva: "UNIFORME" },
    VARIOS: { desde: 0, hasta: 1, curva: "UNIFORME" },

    "TRABAJOS PRELIMINARES": { desde: 0, hasta: 0.16, curva: "DECRECIENTE" },
    // "ESTRUCTURA_H°A": el símbolo de grado cuenta como separador al normalizar.
    "ESTRUCTURA H A": { desde: 0.05, hasta: 0.45, curva: "CAMPANA" },
    ALBANILERIA: { desde: 0.25, hasta: 0.8, curva: "CAMPANA" },

    "INSTALACION GAS Y SANITARIA": { desde: 0.3, hasta: 0.78, curva: "CAMPANA" },
    "INSTALACION ELECTRICA": { desde: 0.3, hasta: 0.8, curva: "CAMPANA" },
    "INSTALACION TERMOMECANICA": { desde: 0.45, hasta: 0.85, curva: "CAMPANA" },
    "INSTALACION INCENDIO": { desde: 0.45, hasta: 0.85, curva: "CAMPANA" },
    CALEFACCION: { desde: 0.5, hasta: 0.88, curva: "CAMPANA" },

    HERRERIA: { desde: 0.45, hasta: 0.85, curva: "CAMPANA" },
    ZINGUERIA: { desde: 0.5, hasta: 0.76, curva: "CAMPANA" },
    "YESERIA Y DURLOCK": { desde: 0.55, hasta: 0.86, curva: "CAMPANA" },
    ASCENSOR: { desde: 0.6, hasta: 0.95, curva: "CRECIENTE" },
    CARPINTERIAS: { desde: 0.6, hasta: 0.9, curva: "CAMPANA" },
    VIDRIERIA: { desde: 0.65, hasta: 0.9, curva: "CAMPANA" },
    REVESTIMIENTOS: { desde: 0.65, hasta: 0.92, curva: "CAMPANA" },

    // Terminaciones: todo lo que entra a la obra cuando ya está cerrada.
    PUERTAS: { desde: 0.72, hasta: 0.95, curva: "CRECIENTE" },
    ARTEFACTOS: { desde: 0.75, hasta: 0.96, curva: "CRECIENTE" },
    MESADAS: { desde: 0.75, hasta: 0.95, curva: "CRECIENTE" },
    PINTURA: { desde: 0.75, hasta: 1, curva: "CRECIENTE" },
    MOBILIARIO: { desde: 0.8, hasta: 1, curva: "CRECIENTE" },
    "TERMINACION Y LIMPIEZA": { desde: 0.88, hasta: 1, curva: "CRECIENTE" },
  };

/**
 * Deja un nombre de rubro en una forma comparable: sin acentos, sin guiones
 * bajos y en mayúsculas. Así "ESTRUCTURA_H°A" y "Estructura H A" caen en la
 * misma entrada de la tabla y un renombre menor no rompe el estimado.
 */
function normalizarRubro(nombre: string) {
  return nombre
    .normalize("NFD")
    // Los acentos quedan sueltos como marcas combinantes tras el NFD; este
    // rango las borra. Va escapado y no con el carácter literal porque un
    // acento suelto en el código fuente es invisible y se pierde de un copy.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export type TramoSugerido = {
  mesInicio: number;
  duracionMeses: number;
  curva: CurvaPresupuesto;
};

/**
 * En qué meses cae un rubro y con qué forma, para una obra de `duracionObra`
 * meses.
 *
 * Si el rubro no está en la tabla se lo ubica por su posición en la lista: los
 * rubros vienen ordenados por `orden`, que ya sigue la secuencia de obra, así
 * que un rubro nuevo cae más o menos donde corresponde en vez de irse al mes 0.
 * Es peor que un tramo pensado, pero mucho mejor que nada.
 */
export function tramoSugerido(
  nombreRubro: string,
  duracionObra: number,
  posicion?: { indice: number; total: number }
): TramoSugerido {
  const meses = Math.max(1, Math.floor(duracionObra));
  const conocido = TRAMOS_POR_RUBRO[normalizarRubro(nombreRubro)];

  let desde: number;
  let hasta: number;
  let curva: CurvaPresupuesto;

  if (conocido) {
    ({ desde, hasta, curva } = conocido);
  } else if (posicion && posicion.total > 1) {
    // Una ventana centrada en su posición relativa, de un cuarto de la obra.
    const centro = posicion.indice / (posicion.total - 1);
    desde = Math.max(0, centro - 0.12);
    hasta = Math.min(1, centro + 0.12);
    curva = "CAMPANA";
  } else {
    desde = 0;
    hasta = 1;
    curva = "UNIFORME";
  }

  const mesInicio = Math.min(meses - 1, Math.max(0, Math.floor(desde * meses)));
  // `ceil` en el fin: un rubro que ocupa una franja finita nunca puede quedar en
  // cero meses por redondeo, ni siquiera en una obra muy corta.
  const mesFin = Math.max(mesInicio + 1, Math.min(meses, Math.ceil(hasta * meses)));

  return { mesInicio, duracionMeses: mesFin - mesInicio, curva };
}

/**
 * "USD 12.500,00".
 *
 * Con los dos decimales aunque el total sea redondo: repartir un monto entre
 * meses casi nunca da números enteros, y si unos se muestran con centavos y
 * otros no, la columna deja de alinearse y parece que hubiera dos escalas
 * distintas conviviendo.
 */
export function formatUSD(valor: number) {
  return `USD ${formatDecimal(valor)}`;
}

/** Solo el número, para las celdas de la tabla. Vacío en cero. */
export function formatMonto(valor: number) {
  if (!valor) return "";
  return formatDecimal(valor);
}

/** "12.500,00" — punto de miles y coma decimal, como se escribe acá. */
export function formatDecimal(valor: number) {
  return valor.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Reparte una serie en porcentajes de un decimal que suman exactamente 100.
 *
 * Redondear cada celda por su cuenta no cierra: doce meses parejos dan 8,33%
 * cada uno, se muestran como 8,3% y la fila suma 99,6%. Con dieciocho meses da
 * 100,8%. Es poco, pero el usuario está mirando un reparto que dice ser el
 * 100% de un rubro y le tiene que cerrar cuando lo suma.
 *
 * Se usa resto mayor: se reparten décimas enteras y las que sobran van a los
 * meses cuya parte fraccionaria quedó más cerca de subir. Es el mismo criterio
 * con el que `distribuir` cierra los pesos, y por el mismo motivo.
 *
 * Los ceros quedan en cero: un mes fuera del tramo no compite por sobras.
 */
export function porcentajesExactos(valores: number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0);
  if (total <= 0) return valores.map(() => 0);

  // Se trabaja en décimas de punto para poder repartir unidades enteras.
  const DECIMAS = 1000;
  const crudos = valores.map((v) => (v / total) * DECIMAS);
  const base = crudos.map((c) => Math.floor(c));
  const sobran = DECIMAS - base.reduce((a, b) => a + b, 0);

  const candidatos = crudos
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .filter(({ i }) => valores[i]! > 0)
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < sobran && candidatos.length > 0; k++) {
    base[candidatos[k % candidatos.length]!.i]! += 1;
  }

  return base.map((d) => d / 10);
}

/** "14,3%". Vacío en cero, igual que `formatMonto`. */
export function formatPorcentaje(valor: number) {
  if (!valor) return "";
  return `${valor.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}
