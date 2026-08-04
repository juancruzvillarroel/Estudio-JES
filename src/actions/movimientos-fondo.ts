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

export async function createMovimientoFondo(
  input: MovimientoFondoInput,
  archivo?: File
): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = MovimientoFondoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  let archivoUrl: string | undefined;
  if (archivo && archivo.size > 0) {
    const blob = await put(`flujo-fondos/${crypto.randomUUID()}-${archivo.name}`, archivo, {
      access: "public",
    });
    archivoUrl = blob.url;
  }

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
  archivo?: File,
  quitarArchivo?: boolean
): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = MovimientoFondoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  let archivoUrl: string | null | undefined;
  if (archivo && archivo.size > 0) {
    const blob = await put(`flujo-fondos/${crypto.randomUUID()}-${archivo.name}`, archivo, {
      access: "public",
    });
    archivoUrl = blob.url;
  } else if (quitarArchivo) {
    archivoUrl = null;
  }

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
