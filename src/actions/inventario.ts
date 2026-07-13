"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  MovimientoInventarioSchema,
  type MovimientoInventarioInput,
} from "@/lib/validations/inventario";

export type MovimientoInventarioOpcion = {
  id: string;
  materialId: string;
  materialNombre: string;
  unidad: string;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  fecha: string;
  notas: string | null;
};

export type CreateMovimientoResult =
  | { success: true; movimiento: MovimientoInventarioOpcion }
  | { success: false; error: string };

export async function createMovimientoInventario(
  input: MovimientoInventarioInput
): Promise<CreateMovimientoResult> {
  const validated = MovimientoInventarioSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = validated.data;

  try {
    const material = await prisma.material.findUnique({ where: { id: data.materialId } });
    if (!material) {
      return { success: false, error: "El material seleccionado ya no existe." };
    }

    if (data.tipo === "SALIDA") {
      const [entradas, salidas] = await Promise.all([
        prisma.inventarioMovimiento.aggregate({
          where: { materialId: data.materialId, tipo: "ENTRADA" },
          _sum: { cantidad: true },
        }),
        prisma.inventarioMovimiento.aggregate({
          where: { materialId: data.materialId, tipo: "SALIDA" },
          _sum: { cantidad: true },
        }),
      ]);
      const stockActual = Number(entradas._sum.cantidad ?? 0) - Number(salidas._sum.cantidad ?? 0);
      if (data.cantidad > stockActual) {
        return {
          success: false,
          error: `No hay suficiente stock de "${material.nombre}". Stock actual: ${stockActual} ${material.unidad}.`,
        };
      }
    }

    const movimiento = await prisma.inventarioMovimiento.create({
      data: {
        materialId: data.materialId,
        tipo: data.tipo,
        cantidad: data.cantidad,
        notas: data.notas,
      },
      include: { material: true },
    });

    revalidatePath("/inventario");

    return {
      success: true,
      movimiento: {
        id: movimiento.id,
        materialId: movimiento.materialId,
        materialNombre: movimiento.material.nombre,
        unidad: movimiento.material.unidad,
        tipo: movimiento.tipo,
        cantidad: Number(movimiento.cantidad),
        fecha: movimiento.fecha.toISOString(),
        notas: movimiento.notas,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el movimiento.",
    };
  }
}

type DeleteActionState = { error?: string; success?: boolean } | undefined;

export async function deleteMovimientoInventario(id: string): Promise<DeleteActionState> {
  try {
    await prisma.inventarioMovimiento.delete({ where: { id } });
    revalidatePath("/inventario");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo eliminar el movimiento." };
  }
}
