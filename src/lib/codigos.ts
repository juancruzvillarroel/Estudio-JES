import { prisma } from "@/lib/db";

/**
 * Códigos automáticos para identificar materiales y proveedores además de
 * su nombre. Los proveedores usan un correlativo simple (PROV-0001) y los
 * materiales un prefijo por rubro (HIE-001, CEM-001, ...). Todos son
 * editables después de creados desde su respectivo formulario.
 */

const PREFIJO_MATERIAL_SIN_RUBRO = "GEN";
const DIGITOS_MATERIAL = 3;
const DIGITOS_PROVEEDOR = 4;

function quitarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Deriva un prefijo de 3 letras a partir del nombre de un rubro (ej. "Hierros" -> "HIE"). */
function basePrefijo(nombre: string): string {
  const soloLetras = quitarAcentos(nombre)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return soloLetras.slice(0, 3) || PREFIJO_MATERIAL_SIN_RUBRO;
}

/** Genera un prefijo de rubro único (no colisiona con otros rubros ya creados). */
export async function generarPrefijoRubro(nombre: string): Promise<string> {
  const base = basePrefijo(nombre);
  let candidato = base;
  let intento = 1;
  while (await prisma.rubro.findUnique({ where: { codigoPrefijo: candidato } })) {
    intento += 1;
    candidato = `${base.slice(0, 2)}${intento}`;
  }
  return candidato;
}

function siguienteNumero(ultimoCodigo: string | undefined, digitos: number): string {
  let siguiente = 1;
  if (ultimoCodigo) {
    const match = ultimoCodigo.match(/-(\d+)$/);
    if (match) siguiente = parseInt(match[1], 10) + 1;
  }
  return String(siguiente).padStart(digitos, "0");
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
