"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import {
  PedidoSchema,
  type PedidoInput,
  EditarPedidoSchema,
  type EditarPedidoInput,
} from "@/lib/validations/pedido";

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

export type EditarPedidoResult = { success: true } | { success: false; error: string };

export async function updatePedido(
  id: string,
  input: EditarPedidoInput,
  archivo?: File,
  quitarArchivo?: boolean
): Promise<EditarPedidoResult> {
  await verifySession();

  const validated = EditarPedidoSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { proyectoId, proveedorId, fecha, notas, items } = validated.data;
  const acopioId = validated.data.acopioId || undefined;

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { items: { include: { material: true } }, _count: { select: { entregas: true } } },
  });
  if (!pedido) {
    return { success: false, error: "El pedido ya no existe." };
  }

  const hasEntregas = pedido._count.entregas > 0;

  if (hasEntregas && (proyectoId !== pedido.proyectoId || proveedorId !== pedido.proveedorId)) {
    return {
      success: false,
      error: "No se puede cambiar el proyecto ni el proveedor: el pedido ya tiene entregas registradas.",
    };
  }

  if (hasEntregas && acopioId !== (pedido.acopioId ?? undefined)) {
    return {
      success: false,
      error: "No se puede cambiar el acopio: el pedido ya tiene entregas registradas.",
    };
  }

  const itemsPorId = new Map(pedido.items.map((i) => [i.id, i]));
  const idsEnPayload = new Set(items.filter((i) => i.id).map((i) => i.id!));

  for (const existente of pedido.items) {
    const entregada = Number(existente.cantidadEntregada);
    if (!idsEnPayload.has(existente.id) && entregada > 0) {
      return {
        success: false,
        error: `No se puede quitar "${existente.material.nombre}" porque ya tiene entregas registradas.`,
      };
    }
  }

  for (const item of items) {
    if (!item.id) continue;
    const existente = itemsPorId.get(item.id);
    if (!existente) {
      return { success: false, error: "Uno de los ítems del pedido ya no existe." };
    }
    const entregada = Number(existente.cantidadEntregada);
    if (entregada > 0) {
      if (item.materialId !== existente.materialId) {
        return {
          success: false,
          error: `No se puede cambiar el material de "${existente.material.nombre}" porque ya tiene entregas registradas.`,
        };
      }
      if (item.cantidad < entregada) {
        return {
          success: false,
          error: `La cantidad de "${existente.material.nombre}" no puede ser menor a lo ya entregado (${entregada}).`,
        };
      }
    }
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

  let archivoUrl: string | null | undefined;
  if (archivo && archivo.size > 0) {
    const blob = await put(`pedidos/${crypto.randomUUID()}-${archivo.name}`, archivo, {
      access: "public",
    });
    archivoUrl = blob.url;
  } else if (quitarArchivo) {
    archivoUrl = null;
  }

  const idsAEliminar = pedido.items.filter((i) => !idsEnPayload.has(i.id)).map((i) => i.id);

  await prisma.$transaction(async (tx) => {
    if (idsAEliminar.length > 0) {
      await tx.pedidoItem.deleteMany({ where: { id: { in: idsAEliminar } } });
    }

    for (const item of items) {
      const data = {
        materialId: item.materialId,
        cantidadPedida: item.cantidad,
        unidad: materialById.get(item.materialId)!.unidad,
        precioUnitario: precioPorMaterial?.get(item.materialId),
      };
      if (item.id) {
        await tx.pedidoItem.update({ where: { id: item.id }, data });
      } else {
        await tx.pedidoItem.create({ data: { ...data, pedidoId: id } });
      }
    }

    let numero = pedido.numero;
    if (proyectoId !== pedido.proyectoId) {
      const ultimo = await tx.pedido.aggregate({
        where: { proyectoId },
        _max: { numero: true },
      });
      numero = (ultimo._max.numero ?? 0) + 1;
    }

    const itemsActualizados = await tx.pedidoItem.findMany({ where: { pedidoId: id } });
    const todosCompletos = itemsActualizados.every(
      (i) => Number(i.cantidadEntregada) >= Number(i.cantidadPedida)
    );
    const algunoEntregado = itemsActualizados.some((i) => Number(i.cantidadEntregada) > 0);

    await tx.pedido.update({
      where: { id },
      data: {
        numero,
        proyectoId,
        proveedorId,
        acopioId: acopioId ?? null,
        fecha,
        notas: notas?.trim() || null,
        estado: todosCompletos ? "COMPLETO" : algunoEntregado ? "PARCIAL" : "PENDIENTE",
        ...(archivoUrl !== undefined ? { archivoUrl } : {}),
      },
    });
  });

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  revalidatePath(`/proyectos/${pedido.proyectoId}`);
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath(`/proveedores/${pedido.proveedorId}`);
  revalidatePath(`/proveedores/${proveedorId}`);
  revalidatePath("/dashboard");

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
