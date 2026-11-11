import type { MovimientoFondoOpcion } from "@/lib/flujo-fondos";

/**
 * Cambios de moneda de la caja de la obra: vender dólares para pagar en pesos o
 * comprar dólares con los pesos que sobran.
 *
 * Cada cambio es un solo MovimientoFondo de tipo CAMBIO. `moneda` y `monto` son
 * lo que SALE de una caja, y `tipoCambio` son los pesos por dólar de la
 * operación. Lo que entra en la otra caja no se guarda: se calcula acá, así no
 * puede quedar desfasado del monto o de la cotización si se edita alguno.
 *
 * Un cambio no es aporte ni gasto. Mueve plata entre la caja de pesos y la de
 * dólares, pero no cambia cuánto aportó cada inversor ni cuánto se gastó en la
 * obra. En el consolidado en dólares no suma ni resta, porque lo que sale y lo
 * que entra valen lo mismo a la cotización del cambio.
 */

type Moneda = "ARS" | "USD";

export function otraMoneda(moneda: Moneda): Moneda {
  return moneda === "ARS" ? "USD" : "ARS";
}

/** Lo que entra en la otra caja. Sin tipo de cambio no hay forma de saberlo. */
export function montoEntrante(cambio: Pick<MovimientoFondoOpcion, "monto" | "moneda" | "tipoCambio">) {
  if (!cambio.tipoCambio) return 0;
  return cambio.moneda === "USD" ? cambio.monto * cambio.tipoCambio : cambio.monto / cambio.tipoCambio;
}

/**
 * Lo que los cambios le sumaron (positivo) o restaron (negativo) a la caja de
 * una moneda. Ignora los movimientos que no son cambios, así que se le puede
 * pasar la lista entera.
 */
export function netoCambios(movimientos: MovimientoFondoOpcion[], moneda: Moneda) {
  return movimientos
    .filter((m) => m.tipo === "CAMBIO")
    .reduce((acc, c) => acc + (c.moneda === moneda ? -c.monto : montoEntrante(c)), 0);
}
