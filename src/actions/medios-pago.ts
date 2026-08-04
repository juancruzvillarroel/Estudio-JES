"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  MedioPagoSchema,
  MedioPagoUpdateSchema,
  type MedioPagoInput,
  type MedioPagoUpdateInput,
} from "@/lib/validations/medio-pago";
import { mapMedioPago, type MedioPagoOpcion } from "@/lib/flujo-fondos";

export type ActionResult =
  | { success: true; item: MedioPagoOpcion }
  | { success: false; error: string };

export async function createMedioPago(input: MedioPagoInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");
  const validated = MedioPagoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const item = await prisma.medioPago.create({ data: validated.data });
    revalidatePath(`/proyectos/${validated.data.proyectoId}`);
    return { success: true, item: mapMedioPago(item) };
  } catch {
    return { success: false, error: "Ya hay un medio de pago con ese nombre en este proyecto." };
  }
}

export async function updateMedioPago(id: string, input: MedioPagoUpdateInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");
  const validated = MedioPagoUpdateSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const item = await prisma.medioPago.update({ where: { id }, data: validated.data });
    revalidatePath(`/proyectos/${item.proyectoId}`);
    return { success: true, item: mapMedioPago(item) };
  } catch {
    return { success: false, error: "Ya hay un medio de pago con ese nombre en este proyecto." };
  }
}

export async function deleteMedioPago(id: string): Promise<{ error?: string; success?: boolean }> {
  await requireSeccion("flujo-fondos");
  const movimientosCount = await prisma.movimientoFondo.count({ where: { medioPagoId: id } });
  if (movimientosCount > 0) {
    return { error: "No se puede quitar: hay movimientos cargados con este medio de pago." };
  }
  const item = await prisma.medioPago.delete({ where: { id } });
  revalidatePath(`/proyectos/${item.proyectoId}`);
  return { success: true };
}
