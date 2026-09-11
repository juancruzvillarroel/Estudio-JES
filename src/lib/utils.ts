import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumeroPedido(numero: number) {
  return numero.toString().padStart(3, "0")
}

/**
 * Un campo numérico en blanco vale cero.
 *
 * Se usa como segundo argumento de `register`, en lugar de `valueAsNumber`:
 * `register("cantidad", campoNumerico)`.
 *
 * Los campos de números arrancan vacíos y no en cero, porque tener que borrar a
 * mano el 0 antes de escribir es incómodo cuando se cargan veinte renglones
 * seguidos. El costo de arrancar vacío es que `valueAsNumber` traduce un input
 * vacío a NaN: no pasa ninguna validación y viaja igual al servidor. Acá el
 * vacío se convierte en 0, que es lo que "no cargué nada" significa en todos
 * estos formularios.
 */
export const campoNumerico = {
  setValueAs: (valor: unknown) =>
    valor === "" || valor === null || valor === undefined ? 0 : Number(valor),
}

/**
 * Valor con el que `setValue` deja un campo numérico en blanco.
 *
 * React Hook Form escribe en el input el valor crudo y guarda en el formulario
 * el que devuelve `setValueAs`: con la cadena vacía el input queda vacío y el
 * valor guardado vuelve a 0. Un `0` pelado dejaría el cero escrito en pantalla,
 * que es justo lo que se quiere evitar.
 */
export const CAMPO_NUMERICO_VACIO = "" as unknown as number

/** Pone en mayúscula solo la primera letra de un texto (formato oración). */
export function capitalizarOracion(texto: string) {
  const t = texto.trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function formatMonto(monto: number) {
  return monto.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
}

/**
 * Importes de dinero, con los centavos a la vista.
 *
 * Van siempre con dos decimales, aunque sean ceros: así los números quedan
 * alineados uno debajo del otro en las columnas del resumen. Sin los centavos,
 * un saldo redondeado no cerraba contra la suma de los movimientos que lo
 * forman y parecía un error de la cuenta.
 */
export function formatMontoMoneda(monto: number, moneda: "ARS" | "USD") {
  return monto.toLocaleString("es-AR", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formatea una fecha guardada como "día calendario" (medianoche UTC, la
 * forma en que la guarda un <input type="date">) sin dejar que la zona
 * horaria del navegador o del servidor le reste un día. Por eso se fuerza
 * timeZone: "UTC" en vez de usar la zona horaria local.
 */
export function formatFecha(fecha: Date | string) {
  const date = typeof fecha === "string" ? new Date(fecha) : fecha
  return date.toLocaleDateString("es-AR", { timeZone: "UTC" })
}
