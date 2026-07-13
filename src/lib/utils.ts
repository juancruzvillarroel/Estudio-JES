import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumeroPedido(numero: number) {
  return numero.toString().padStart(3, "0")
}

export function formatMonto(monto: number) {
  return monto.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
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
