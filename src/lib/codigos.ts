import { prisma } from "@/lib/db";

/**
 * Códigos automáticos para identificar rubros, materiales y proveedores
 * además de su nombre. Todos son editables después de creados desde su
 * respectivo formulario.
 *
 * - Rubro: correlativo numérico de 2 dígitos (01, 02, ...).
 * - Material: "<código de rubro>-<número>" (ej. 05-01). El número refleja
 *   el orden alfabético entre los materiales del rubro en el momento de
 *   crearlo; una vez asignado no se recalcula (si se inserta uno que
 *   alfabéticamente iría en el medio, se le asigna el siguiente número
 *   libre al final). Sin rubro asignado usa el prefijo "GEN".
 * - Proveedor: correlativo simple (PROV-0001, PROV-0002, ...).
 */

const PREFIJO_MATERIAL_SIN_RUBRO = "GEN";
const DIGITOS_RUBRO = 2;
const DIGITOS_MATERIAL = 2;
const DIGITOS_PROVEEDOR = 4;

// Nota: el "número más alto ya usado" para un prefijo dado (ej. todos los
// "06-XX" de un rubro) NO se puede calcular ordenando el campo `codigo` como
// texto (orderBy: "desc"): "06-99" queda "mayor" que "06-149" porque el 3er
// caracter ("9") es mayor que ("1"), aunque 149 > 99. Eso hacía que, pasados
// los 99 materiales en un rubro, se calculara mal el siguiente número y se
// generara un código que ya existía (choque con la restricción de único).
// Por eso acá se trae el listado completo con ese prefijo y se compara el
// valor numérico real en JS.
function maxNumeroEntre(codigos: string[]): number {
  return codigos.reduce((max, codigo) => {
    const match = codigo.match(/-(\d+)$/);
    const n = match ? parseInt(match[1], 10) : NaN;
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

/** Genera el próximo código de rubro: correlativo numérico (01, 02, ...). */
export async function generarPrefijoRubro(): Promise<string> {
  const rubros = await prisma.rubro.findMany({ select: { codigoPrefijo: true } });
  const maxActual = rubros.reduce((max, r) => {
    const n = r.codigoPrefijo ? parseInt(r.codigoPrefijo, 10) : NaN;
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return String(maxActual + 1).padStart(DIGITOS_RUBRO, "0");
}

/** Genera el próximo código correlativo para un material dentro de su rubro (o "GEN" si no tiene). */
export async function generarCodigoMaterial(rubroId: string | null): Promise<string> {
  let prefijo = PREFIJO_MATERIAL_SIN_RUBRO;
  if (rubroId) {
    const rubro = await prisma.rubro.findUnique({ where: { id: rubroId } });
    if (rubro?.codigoPrefijo) prefijo = rubro.codigoPrefijo;
  }
  const existentes = await prisma.material.findMany({
    where: { codigo: { startsWith: `${prefijo}-` } },
    select: { codigo: true },
  });
  const siguiente = maxNumeroEntre(existentes.map((m) => m.codigo)) + 1;
  return `${prefijo}-${String(siguiente).padStart(DIGITOS_MATERIAL, "0")}`;
}

/** Genera el próximo código correlativo para un proveedor (PROV-0001, PROV-0002, ...). */
export async function generarCodigoProveedor(): Promise<string> {
  const existentes = await prisma.proveedor.findMany({
    where: { codigo: { startsWith: "PROV-" } },
    select: { codigo: true },
  });
  const siguiente = maxNumeroEntre(existentes.map((p) => p.codigo)) + 1;
  return `PROV-${String(siguiente).padStart(DIGITOS_PROVEEDOR, "0")}`;
}
