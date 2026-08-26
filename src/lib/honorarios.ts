/**
 * Calculadora de honorarios del estudio.
 *
 * Todos los meses se suman los gastos de la obra y se cobra un porcentaje. La
 * cuenta se venía haciendo a mano; acá queda escrita para que el sistema la
 * proponga solo.
 *
 * Tres decisiones que no son obvias y conviene tener presentes:
 *
 * 1. El período arranca en el último honorario cargado, no en el primero del
 *    mes. Así un mes que no se cobró no se pierde y un gasto cargado tarde
 *    entra en la próxima liquidación, sin contarse dos veces. El corte va por
 *    moneda: el de los pesos no depende de cuándo se cobró el de dólares.
 *
 * 2. La base es nominal y va por moneda: los gastos en pesos se suman en pesos
 *    y se cobra el porcentaje en pesos; los gastos en dólares se suman aparte y
 *    se cobra el porcentaje en dólares. No se convierte nada. Es como se venían
 *    liquidando los honorarios a mano y da exacto contra los ya cargados.
 *
 *    Que no haya conversión tiene una consecuencia buena: un gasto en pesos sin
 *    tipo de cambio cargado ya no queda afuera de la base. El tipo de cambio no
 *    interviene en esta cuenta.
 *
 * 3. No todos los rubros pagan: la compra del terreno queda afuera, y los
 *    honorarios tampoco pagan honorarios. Eso se configura con un tilde en
 *    cada rubro (Rubro.pagaHonorarios), no está escrito acá.
 *
 * La función es pura: recibe los movimientos ya cargados y no toca la base.
 */

export type Moneda = "ARS" | "USD";

export type RubroHonorarios = {
  id: string;
  nombre: string;
  pagaHonorarios: boolean;
  esHonorarios: boolean;
};

export type MovimientoParaHonorarios = {
  id: string;
  tipo: "GASTO" | "APORTE";
  fecha: string;
  createdAt: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  tipoCambio: number | null;
  rubroId: string | null;
  rubroNombre: string | null;
};

export type GastoDelPeriodo = {
  id: string;
  fecha: string;
  descripcion: string;
  rubroNombre: string | null;
  monto: number;
  moneda: Moneda;
};

/**
 * Lo que se cobra en una moneda. Hay una de estas por cada moneda en la que
 * hubo gastos en el período: si la obra gastó en pesos y en dólares, son dos
 * honorarios distintos y cada uno se cobra en lo suyo.
 */
export type HonorarioPorMoneda = {
  moneda: Moneda;
  /**
   * Fecha del último honorario cobrado *en esta moneda*. `null` si todavía no
   * se cobró ninguno y entra toda la historia de la obra.
   */
  desde: string | null;
  /** Gastos del período en esta moneda, en orden cronológico. */
  gastos: GastoDelPeriodo[];
  /** Suma nominal de `gastos`. */
  base: number;
  /** `base` por el porcentaje. `null` si la obra no tiene porcentaje cargado. */
  monto: number | null;
};

export type CalculoHonorarios = {
  /** `false` si ningún rubro está marcado como el de honorarios. */
  configurado: boolean;
  /**
   * Una entrada por moneda con gastos en el período. Va vacío cuando no hubo
   * gastos nuevos desde el último cobro. Los pesos van primero.
   */
  porMoneda: HonorarioPorMoneda[];
  porcentaje: number | null;
};

/**
 * Lo que el diálogo de gastos necesita para proponer el monto al elegir el
 * rubro de honorarios. Es una por moneda: el diálogo muestra la que coincide
 * con la moneda que se haya elegido en el formulario.
 */
export type SugerenciaHonorarios = {
  /** El rubro que dispara la sugerencia. */
  rubroId: string;
  moneda: Moneda;
  base: number;
  porcentaje: number;
  monto: number;
};

/** Redondeo a centavos, para no arrastrar la basura del punto flotante. */
function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

/** Lo mínimo que hace falta para ordenar un movimiento. */
export type MovimientoOrdenable = {
  id: string;
  createdAt: string;
  rubroId: string | null;
  rubroNombre: string | null;
};

/**
 * Orden de los movimientos que caen en un mismo día.
 *
 * La fecha sola no alcanza para decidir: es habitual cargar varios gastos con
 * la misma fecha, y si además hay un honorario ese día, de qué lado del corte
 * queda cada uno cambia la base del período siguiente. Las reglas, en orden:
 *
 * 1. El honorario va último. Todo lo que se cargó ese día queda *antes* del
 *    corte, o sea que se considera ya cobrado por ese honorario. Es lo que
 *    venía pasando al liquidar a mano: se cargan los gastos del mes, se suma y
 *    se cobra el honorario con fecha del mismo día. Si el honorario fuera
 *    primero, esos gastos volverían a entrar en la liquidación siguiente y se
 *    cobrarían dos veces.
 *
 * 2. Después se agrupa por rubro, para que los gastos del mismo rubro queden
 *    juntos y la lista se lea de a bloques en vez de salteado.
 *
 * 3. Dentro del rubro, por orden de carga (`createdAt`) y al final por id, que
 *    no empata nunca. Sin este último desempate el orden sería inestable y dos
 *    pantallas podrían mostrar lo mismo en distinto orden.
 */
export function compararEnElDia(rubroHonorariosId: string | null | undefined) {
  return (a: MovimientoOrdenable, b: MovimientoOrdenable) => {
    if (rubroHonorariosId) {
      const honorarioA = a.rubroId === rubroHonorariosId ? 1 : 0;
      const honorarioB = b.rubroId === rubroHonorariosId ? 1 : 0;
      if (honorarioA !== honorarioB) return honorarioA - honorarioB;
    }
    const rubroA = a.rubroNombre ?? "";
    const rubroB = b.rubroNombre ?? "";
    if (rubroA !== rubroB) return rubroA < rubroB ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  };
}

/** Orden cronológico completo: por fecha y, dentro del día, por `compararEnElDia`. */
export function compararCronologico(rubroHonorariosId: string | null | undefined) {
  const enElDia = compararEnElDia(rubroHonorariosId);
  return (a: MovimientoParaHonorarios, b: MovimientoParaHonorarios) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return enElDia(a, b);
  };
}

/** Los pesos primero, que son la moneda en la que se gasta casi todo. */
const ORDEN_MONEDAS: Moneda[] = ["ARS", "USD"];

export function calcularHonorarios({
  movimientos,
  rubros,
  porcentaje,
}: {
  movimientos: MovimientoParaHonorarios[];
  rubros: RubroHonorarios[];
  porcentaje: number | null;
}): CalculoHonorarios {
  const rubroHonorarios = rubros.find((r) => r.esHonorarios);
  const paganPorId = new Map(rubros.map((r) => [r.id, r.pagaHonorarios]));

  if (!rubroHonorarios) {
    return { configurado: false, porMoneda: [], porcentaje };
  }

  const gastos = movimientos
    .filter((m) => m.tipo === "GASTO")
    .sort(compararCronologico(rubroHonorarios.id));

  const porMoneda: HonorarioPorMoneda[] = [];
  for (const moneda of ORDEN_MONEDAS) {
    // Cada moneda se liquida por separado, así que también se corta por
    // separado: el período de los pesos arranca en el último honorario cobrado
    // en pesos y no le importa cuándo se cobró el de dólares.
    //
    // Es lo que pasa al cerrar un mes en el que se gastó en las dos monedas: se
    // cargan dos honorarios con la misma fecha, uno por moneda. Con un corte
    // único, el primero de los dos se llevaba todo el período y el segundo se
    // quedaba sin gastos.
    const delaMoneda = gastos.filter((m) => m.moneda === moneda);

    let corte = -1;
    for (let i = delaMoneda.length - 1; i >= 0; i--) {
      if (delaMoneda[i].rubroId === rubroHonorarios.id) {
        corte = i;
        break;
      }
    }
    const desde = corte === -1 ? null : delaMoneda[corte].fecha;

    const filas: GastoDelPeriodo[] = [];
    for (const m of delaMoneda.slice(corte + 1)) {
      // Un gasto sin rubro no puede saberse si paga, así que no entra.
      if (!m.rubroId || !paganPorId.get(m.rubroId)) continue;
      filas.push({
        id: m.id,
        fecha: m.fecha,
        descripcion: m.descripcion,
        rubroNombre: m.rubroNombre,
        monto: m.monto,
        moneda: m.moneda,
      });
    }
    if (filas.length === 0) continue;

    const base = redondear(filas.reduce((total, g) => total + g.monto, 0));
    porMoneda.push({
      moneda,
      desde,
      gastos: filas,
      base,
      monto: porcentaje === null ? null : redondear((base * porcentaje) / 100),
    });
  }

  return { configurado: true, porMoneda, porcentaje };
}

/**
 * Arma las sugerencias para el diálogo de gastos, una por moneda. Va vacío si
 * todavía no hay nada que proponer: sin rubro de honorarios marcado, sin
 * porcentaje cargado o sin gastos nuevos desde el último cobro.
 */
export function sugerirHonorarios(args: {
  movimientos: MovimientoParaHonorarios[];
  rubros: RubroHonorarios[];
  porcentaje: number | null;
}): SugerenciaHonorarios[] {
  const rubroHonorarios = args.rubros.find((r) => r.esHonorarios);
  if (!rubroHonorarios) return [];

  const calculo = calcularHonorarios(args);
  if (calculo.porcentaje === null) return [];

  const porcentaje = calculo.porcentaje;
  return calculo.porMoneda
    .filter((m) => m.base > 0 && m.monto !== null)
    .map((m) => ({
      rubroId: rubroHonorarios.id,
      moneda: m.moneda,
      base: m.base,
      porcentaje,
      monto: m.monto as number,
    }));
}
