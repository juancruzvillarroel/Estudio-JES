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

function siguienteNumero(ultimoCodigo: string | undefined, digitos: number): string {
  let siguiente = 1;
  if (ultimoCodigo) {
    const match = ultimoCodigo.match(/-(\d+)$/);
    if (match) siguiente = parseInt(match[1], 10) + 1;
  }
  return String(siguiente).padStart(digitos, "0");
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
  const ultimo = await prisma.material.findFirst({
    where: { codigo: { startsWith: `${prefijo}-` } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  return `${prefijo}-${siguienteNumero(ultimo?.codigo ?? undefined, DIGITOS_MATERIAL)}`;
}

/** Genera el próximo código correlativo para un proveedor (PROV-0001, PROV-0002, ...). */
export async function generarCodigoProveedor(): Promise<string> {
  const ultimo = await prisma.proveedor.findFirst({
    where: { codigo: { startsWith: "PROV-" } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  return `PROV-${siguienteNumero(ultimo?.codigo ?? undefined, DIGITOS_PROVEEDOR)}`;
}
