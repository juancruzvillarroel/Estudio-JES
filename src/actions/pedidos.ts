"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { PedidoSchema, type PedidoInput } from "@/lib/validations/pedido";

export type CreatePedidoResult =
  | { success: true; pedidoId: string }
  | { success: false; error: string };

export async function createPedido(
  input: PedidoInput,
  archivo?: File
): Promise<CreatePedidoResult> {
  const session = await verifySession();
  const validated = PedidoSchema.safeParse(input);

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { proyectoId, proveedorId, acopioId, fecha, notas, items } = validated.data;

  let archivoUrl: string | undefined;
  if (archivo && archivo.size > 0) {
    const blob = await put(`pedidos/${crypto.randomUUID()}-${archivo.name}`, archivo, {
      access: "public",
    });
    archivoUrl = blob.url;
  }

  const materiales = await prisma.material.findMany({
    where: { id: { in: items.map((i) => i.materialId) } },
  });
  const materialById = new Map(materiales.map((m) => [m.id, m]));

  for (const item of items) {
    if (!materialById.has(item.materialId)) {
      return { success: false, error: "Uno de los materiales seleccionados ya no existe." };
    }
  }

  let precioPorMaterial: Map<string, number> | undefined;

  if (acopioId) {
    const acopio = await prisma.acopio.findUnique({
      where: { id: acopioId },
      include: { precios: true },
    });
    if (!acopio || acopio.proyectoId !== proyectoId || acopio.proveedorId !== proveedorId) {
      return { success: false, error: "El acopio seleccionado ya no está disponible." };
    }
    if (acopio.tipo === "MATERIAL") {
      if (items.some((i) => i.materialId !== acopio.materialId)) {
        return { success: false, error: "Este acopio es de un solo material." };
      }
    } else {
      precioPorMaterial = new Map(acopio.precios.map((p) => [p.materialId, Number(p.precioUnitario)]));
      for (const item of items) {
        if (!precioPorMaterial.has(item.materialId)) {
          return { success: false, error: "Uno de los materiales no tiene precio en este acopio." };
        }
      }
    }
  }

  const pedido = await prisma.$transaction(async (tx) => {
    const ultimo = await tx.pedido.aggregate({
      where: { proyectoId },
      _max: { numero: true },
    });
    const numero = (ultimo._max.numero ?? 0) + 1;

    return tx.pedido.create({
      data: {
        numero,
        proyectoId,
        proveedorId,
        acopioId,
        fecha,
        notas,
        archivoUrl,
        creadoPorId: session.userId,
        items: {
          create: items.map((item) => ({
            materialId: item.materialId,
            cantidadPedida: item.cantidad,
            unidad: materialById.get(item.materialId)!.unidad,
            precioUnitario: precioPorMaterial?.get(item.materialId),
          })),
        },
      },
    });
  });

  revalidatePath("/pedidos");
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath(`/proveedores/${proveedorId}`);
  revalidatePath("/dashboard");

  return { success: true, pedidoId: pedido.id };
}

export type EditarPedidoInput = {
  fecha?: Date;
  notas?: string;
};

export type EditarPedidoResult = { success: true } | { success: false; error: string };

export async function updatePedido(
  id: string,
  input: EditarPedidoInput
): Promise<EditarPedidoResult> {
  await verifySession();

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) {
    return { success: false, error: "El pedido ya no existe." };
  }

  await prisma.pedido.update({
    where: { id },
    data: {
      fecha: input.fecha,
      notas: input.notas?.trim() || null,
    },
  });

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");

  return { success: true };
}

type DeleteActionState = { error?: string; success?: boolean } | undefined;

export async function deletePedido(id: string): Promise<DeleteActionState> {
  await verifySession();

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { _count: { select: { entregas: true } } },
  });

  if (!pedido) {
    return { error: "El pedido ya no existe." };
  }

  if (pedido._count.entregas > 0) {
    return {
      error: "No se puede eliminar: el pedido ya tiene entregas registradas. Eliminá primero las entregas.",
    };
  }

  await prisma.pedido.delete({ where: { id } });

  revalidatePath("/pedidos");
  revalidatePath(`/proyectos/${pedido.proyectoId}`);
  revalidatePath(`/proveedores/${pedido.proveedorId}`);
  revalidatePath("/dashboard");

  return { success: true };
}
