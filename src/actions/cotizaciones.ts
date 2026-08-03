"use server";

export type CotizacionBlue = {
  compra: number;
  venta: number;
  fecha: string;
};

/**
 * Busca la cotización del dólar blue para una fecha puntual (para poder
 * autocompletar el tipo de cambio de un gasto en pesos sin tener que
 * ingresarlo a mano). Devuelve null si no hay datos para esa fecha (por
 * ejemplo, una fecha futura) o si falla la consulta.
 */
export async function obtenerCotizacionDolarBlue(fecha: string): Promise<CotizacionBlue | null> {
  const soloFecha = fecha.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) return null;

  const [anio, mes, dia] = soloFecha.split("-");

  try {
    const res = await fetch(
      `https://api.argentinadatos.com/v1/cotizaciones/dolares/blue/${anio}/${mes}/${dia}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { compra?: number; venta?: number; fecha?: string };
    if (typeof data.compra !== "number" || typeof data.venta !== "number") return null;

    return { compra: data.compra, venta: data.venta, fecha: data.fecha ?? soloFecha };
  } catch {
    return null;
  }
}
