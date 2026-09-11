/**
 * Los tres ayudantes que necesita un campo de dinero que se formatea mientras
 * se escribe: uno para el texto que se ve, uno para el número que se guarda y
 * uno para arrancar el campo con un valor ya cargado.
 *
 * Están acá y no repetidos en cada diálogo porque son tres funciones que tienen
 * que coincidir entre sí: si el formateador pone punto de miles y el parser no
 * lo saca, el monto que viaja al servidor no es el que se ve en pantalla.
 */

/**
 * Formatea lo que se va escribiendo como moneda argentina (punto de miles, coma
 * decimal) sin perder la coma mientras se siguen tipeando los decimales.
 */
export function formatMontoWhileTyping(raw: string): string {
  let limpio = raw.replace(/[^0-9,]/g, "");
  const primeraComa = limpio.indexOf(",");
  if (primeraComa !== -1) {
    limpio = limpio.slice(0, primeraComa + 1) + limpio.slice(primeraComa + 1).replace(/,/g, "");
  }
  const [parteEntera, parteDecimal] = limpio.split(",");
  const enteroFormateado = parteEntera ? Number(parteEntera).toLocaleString("es-AR") : "";
  if (parteDecimal !== undefined) {
    return `${enteroFormateado},${parteDecimal.slice(0, 2)}`;
  }
  return enteroFormateado;
}

/** El número detrás del texto formateado. Lo ilegible vale cero. */
export function parseMontoTexto(texto: string): number {
  const limpio = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isNaN(numero) ? 0 : numero;
}

/**
 * El texto con el que arranca el campo. El cero queda en blanco a propósito:
 * los campos de números empiezan vacíos para no tener que borrar el 0 antes de
 * escribir.
 */
export function formatMontoInicial(monto: number): string {
  if (!monto) return "";
  return monto.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
