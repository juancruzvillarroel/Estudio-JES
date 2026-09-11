"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { MovimientoFondoSchema, type MovimientoFondoInput } from "@/lib/validations/movimiento-fondo";
import { movimientoFondoInclude, mapMovimientoFondo, type MovimientoFondoOpcion } from "@/lib/flujo-fondos";

export type ActionResult =
  | { success: true; movimiento: MovimientoFondoOpcion }
  | { success: false; error: string };

/**
 * Los dos papeles del gasto, que se manejan por separado.
 *
 * El comprobante prueba que se pagó y la factura es el respaldo fiscal: a fin
 * de mes van a carpetas distintas, así que cada uno se sube, se reemplaza y se
 * quita solo, sin arrastrar al otro.
 */
export type AdjuntosMovimiento = {
  comprobante?: File;
  factura?: File;
  quitarComprobante?: boolean;
  quitarFactura?: boolean;
};

async function subir(archivo?: File) {
  if (!archivo || archivo.size === 0) return undefined;
  const blob = await put(`flujo-fondos/${crypto.randomUUID()}-${archivo.name}`, archivo, {
    access: "public",
  });
  return blob.url;
}

export async function createMovimientoFondo(
  input: MovimientoFondoInput,
  adjuntos?: AdjuntosMovimiento
): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = MovimientoFondoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  const archivoUrl = await subir(adjuntos?.comprobante);
  const facturaUrl = await subir(adjuntos?.factura);

  try {
    const movimiento = await prisma.movimientoFondo.create({
      data: {
        proyectoId: data.proyectoId,
        tipo: data.tipo,
        fecha: new Date(data.fecha),
        descripcion: data.descripcion,
        monto: data.monto,
        moneda: data.moneda,
        tipoCambio: data.tipoCambio,
        notas: data.notas,
        medioPagoId: data.medioPagoId || undefined,
        archivoUrl,
        facturaUrl,
        rubroId: data.tipo === "GASTO" ? data.rubroId : undefined,
        subrubroId: data.tipo === "GASTO" ? data.subrubroId || undefined : undefined,
        proveedorId: data.tipo === "GASTO" ? data.proveedorId || undefined : undefined,
        proyectoInversorId: data.tipo === "APORTE" ? data.proyectoInversorId : undefined,
      },
      include: movimientoFondoInclude,
    });

    revalidatePath(`/proyectos/${data.proyectoId}`);
    return { success: true, movimiento: mapMovimientoFondo(movimiento) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "No se pudo crear el movimiento." };
  }
}

export async function updateMovimientoFondo(
  id: string,
  input: MovimientoFondoInput,
  adjuntos?: AdjuntosMovimiento
): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = MovimientoFondoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  // `undefined` es "no lo toques" y `null` es "borralo": subir uno nuevo pisa
  // al anterior, y quitarlo solo lo borra si no vino ninguno de reemplazo.
  const subido = await subir(adjuntos?.comprobante);
  const subidaFactura = await subir(adjuntos?.factura);
  const archivoUrl = subido ?? (adjuntos?.quitarComprobante ? null : undefined);
  const facturaUrl = subidaFactura ?? (adjuntos?.quitarFactura ? null : undefined);

  try {
    const movimiento = await prisma.movimientoFondo.update({
      where: { id },
      data: {
        proyectoId: data.proyectoId,
        tipo: data.tipo,
        fecha: new Date(data.fecha),
        descripcion: data.descripcion,
        monto: data.monto,
        moneda: data.moneda,
        tipoCambio: data.tipoCambio ?? null,
        notas: data.notas,
        medioPagoId: data.medioPagoId ?? null,
        ...(archivoUrl !== undefined ? { archivoUrl } : {}),
        ...(facturaUrl !== undefined ? { facturaUrl } : {}),
        rubroId: data.tipo === "GASTO" ? data.rubroId : null,
        subrubroId: data.tipo === "GASTO" ? data.subrubroId || null : null,
        proveedorId: data.tipo === "GASTO" ? data.proveedorId || null : null,
        proyectoInversorId: data.tipo === "APORTE" ? data.proyectoInversorId : null,
      },
      include: movimientoFondoInclude,
    });

    revalidatePath(`/proyectos/${data.proyectoId}`);
    return { success: true, movimiento: mapMovimientoFondo(movimiento) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "No se pudo actualizar el movimiento." };
  }
}

export async function deleteMovimientoFondo(id: string): Promise<{ error?: string; success?: boolean }> {
  await requireSeccion("flujo-fondos");

  const movimiento = await prisma.movimientoFondo.delete({ where: { id } });
  revalidatePath(`/proyectos/${movimiento.proyectoId}`);
  return { success: true };
}
