"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import {
  VentaSchema,
  VentaUpdateSchema,
  VentaCuotaCobroSchema,
  type VentaInput,
  type VentaUpdateInput,
  type VentaCuotaCobroInput,
} from "@/lib/validations/venta";
import { ventaInclude, mapVenta, type VentaOpcion } from "@/lib/ventas";

export type ActionResult =
  | { success: true; venta: VentaOpcion }
  | { success: false; error: string };

export async function createVenta(input: VentaInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = VentaSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  try {
    const venta = await prisma.$transaction(async (tx) => {
      const creada = await tx.venta.create({
        data: {
          proyectoId: data.proyectoId,
          unidadId: data.unidadId,
          compradorNombre: data.compradorNombre,
          fecha: new Date(data.fecha),
          moneda: data.moneda,
          precioTotal: data.precioTotal,
          modalidad: data.modalidad,
          medioPagoId: data.medioPagoId || undefined,
          notas: data.notas,
          cuotas: {
            create: data.cuotas.map((c) => ({
              numero: c.numero,
              esAnticipo: c.esAnticipo,
              fecha: new Date(c.fecha),
              monto: c.monto,
            })),
          },
        },
        include: ventaInclude,
      });

      await tx.unidadProyecto.update({
        where: { id: data.unidadId },
        data: { estado: "VENDIDA" },
      });

      return creada;
    });

    revalidatePath(`/proyectos/${data.proyectoId}`);
    return { success: true, venta: mapVenta(venta) };
  } catch {
    return { success: false, error: "Esta unidad ya tiene una venta cargada." };
  }
}

export async function updateVenta(id: string, input: VentaUpdateInput): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = VentaUpdateSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  try {
    const venta = await prisma.$transaction(async (tx) => {
      const existentes = await tx.ventaCuota.findMany({ where: { ventaId: id } });
      const idsIncoming = new Set(data.cuotas.filter((c) => c.id).map((c) => c.id));
      const aEliminar = existentes.filter((c) => !idsIncoming.has(c.id));

      const cobradaEliminada = aEliminar.find((c) => c.cobrada);
      if (cobradaEliminada) {
        throw new Error("No se puede eliminar una cuota ya cobrada.");
      }

      if (aEliminar.length > 0) {
        await tx.ventaCuota.deleteMany({ where: { id: { in: aEliminar.map((c) => c.id) } } });
      }

      for (const c of data.cuotas) {
        if (c.id) {
          await tx.ventaCuota.update({
            where: { id: c.id },
            data: {
              numero: c.numero,
              esAnticipo: c.esAnticipo,
              fecha: new Date(c.fecha),
              monto: c.monto,
            },
          });
        } else {
          await tx.ventaCuota.create({
            data: {
              ventaId: id,
              numero: c.numero,
              esAnticipo: c.esAnticipo,
              fecha: new Date(c.fecha),
              monto: c.monto,
            },
          });
        }
      }

      return tx.venta.update({
        where: { id },
        data: {
          compradorNombre: data.compradorNombre,
          fecha: new Date(data.fecha),
          moneda: data.moneda,
          precioTotal: data.precioTotal,
          modalidad: data.modalidad,
          medioPagoId: data.medioPagoId || null,
          notas: data.notas,
        },
        include: ventaInclude,
      });
    });

    revalidatePath(`/proyectos/${venta.proyectoId}`);
    return { success: true, venta: mapVenta(venta) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo actualizar la venta.",
    };
  }
}

export async function deleteVenta(id: string): Promise<{ error?: string; success?: boolean }> {
  await requireSeccion("flujo-fondos");

  const venta = await prisma.$transaction(async (tx) => {
    const eliminada = await tx.venta.delete({ where: { id } });
    await tx.unidadProyecto.update({
      where: { id: eliminada.unidadId },
      data: { estado: "DISPONIBLE" },
    });
    return eliminada;
  });

  revalidatePath(`/proyectos/${venta.proyectoId}`);
  return { success: true };
}

export async function marcarCuotaCobro(
  id: string,
  input: VentaCuotaCobroInput
): Promise<ActionResult> {
  await requireSeccion("flujo-fondos");

  const validated = VentaCuotaCobroSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  try {
    const cuota = await prisma.ventaCuota.update({
      where: { id },
      data: {
        cobrada: data.cobrada,
        fechaCobro: data.cobrada ? new Date(data.fechaCobro ?? new Date().toISOString()) : null,
      },
      select: { ventaId: true },
    });

    const venta = await prisma.venta.findUnique({
      where: { id: cuota.ventaId },
      include: ventaInclude,
    });
    if (!venta) {
      return { success: false, error: "No se encontró la venta de este pago." };
    }

    revalidatePath(`/proyectos/${venta.proyectoId}`);
    return { success: true, venta: mapVenta(venta) };
  } catch {
    return { success: false, error: "No se pudo actualizar el pago." };
  }
}
