"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { EntregaSchema, type EntregaInput } from "@/lib/validations/entrega";

export type RegistrarEntregaResult =
  | { success: true }
  | { success: false; error: string };

export async function registrarEntrega(
  input: EntregaInput,
  remitoArchivo?: File
): Promise<RegistrarEntregaResult> {
  const session = await verifySession();
  const validated = EntregaSchema.safeParse(input);

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { pedidoId, fecha, numeroRemito, notas, items, sumarAInventario } = validated.data;
  const itemsACargar = items.filter((i) => i.cantidad > 0);

  if (itemsACargar.length === 0) {
    return { success: false, error: "Cargá al menos una cantidad entregada." };
  }

  let remitoUrl: string | undefined;
  if (remitoArchivo && remitoArchivo.size > 0) {
    const blob = await put(`remitos/${crypto.randomUUID()}-${remitoArchivo.name}`, remitoArchivo, {
      access: "public",
    });
    remitoUrl = blob.url;
  }

  try {
    const { proyectoId, proveedorId } = await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { items: true },
      });

      if (!pedido) {
        throw new Error("El pedido ya no existe.");
      }

      const pedidoItemById = new Map(pedido.items.map((i) => [i.id, i]));

      for (const item of itemsACargar) {
        const pedidoItem = pedidoItemById.get(item.pedidoItemId);
        if (!pedidoItem || pedidoItem.pedidoId !== pedidoId) {
          throw new Error("Uno de los ítems del pedido ya no existe.");
        }
        const restante = Number(pedidoItem.cantidadPedida) - Number(pedidoItem.cantidadEntregada);
        if (item.cantidad > restante) {
          throw new Error(
            `La cantidad entregada de ${pedidoItem.unidad} supera lo pendiente (quedan ${restante}).`
          );
        }
      }

      const entrega = await tx.entrega.create({
        data: {
          pedidoId,
          fecha,
          numeroRemito,
          remitoUrl,
          notas,
          registradoPorId: session.userId,
          items: {
            create: itemsACargar.map((item) => ({
              pedidoItemId: item.pedidoItemId,
              cantidad: item.cantidad,
            })),
          },
        },
      });

      for (const item of itemsACargar) {
        await tx.pedidoItem.update({
          where: { id: item.pedidoItemId },
          data: { cantidadEntregada: { increment: item.cantidad } },
        });
      }

      if (sumarAInventario) {
        for (const item of itemsACargar) {
          const pedidoItem = pedidoItemById.get(item.pedidoItemId)!;
          await tx.inventarioMovimiento.create({
            data: {
              materialId: pedidoItem.materialId,
              tipo: "ENTRADA",
              cantidad: item.cantidad,
              entregaId: entrega.id,
              notas: numeroRemito
                ? `Entrega de pedido, remito ${numeroRemito}`
                : "Entrega de pedido",
            },
          });
        }
      }

      const itemsActualizados = await tx.pedidoItem.findMany({ where: { pedidoId } });
      const todosCompletos = itemsActualizados.every(
        (i) => Number(i.cantidadEntregada) >= Number(i.cantidadPedida)
      );
      const algunoEntregado = itemsActualizados.some((i) => Number(i.cantidadEntregada) > 0);

      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: todosCompletos ? "COMPLETO" : algunoEntregado ? "PARCIAL" : "PENDIENTE",
        },
      });

      return { proyectoId: pedido.proyectoId, proveedorId: pedido.proveedorId };
    });

    revalidatePath(`/pedidos/${pedidoId}`);
    revalidatePath("/pedidos");
    revalidatePath(`/proyectos/${proyectoId}`);
    revalidatePath(`/proveedores/${proveedorId}`);
    revalidatePath("/dashboard");
    if (sumarAInventario) {
      revalidatePath("/inventario");
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "No se pudo registrar la entrega." };
  }
}

export type EditarEntregaInput = {
  fecha?: Date;
  numeroRemito?: string;
  notas?: string;
};

export type EditarEntregaResult = { success: true } | { success: false; error: string };

export async function updateEntrega(
  id: string,
  input: EditarEntregaInput
): Promise<EditarEntregaResult> {
  await verifySession();

  const entrega = await prisma.entrega.findUnique({ where: { id } });
  if (!entrega) {
    return { success: false, error: "La entrega ya no existe." };
  }

  await prisma.entrega.update({
    where: { id },
    data: {
      fecha: input.fecha,
      numeroRemito: input.numeroRemito?.trim() || null,
      notas: input.notas?.trim() || null,
    },
  });

  revalidatePath(`/pedidos/${entrega.pedidoId}`);
  revalidatePath("/pedidos");

  return { success: true };
}

type DeleteActionState = { error?: string; success?: boolean } | undefined;

export async function deleteEntrega(id: string): Promise<DeleteActionState> {
  await verifySession();

  try {
    const { pedidoId, proyectoId, proveedorId, tuvoInventario } = await prisma.$transaction(async (tx) => {
      const entrega = await tx.entrega.findUnique({
        where: { id },
        include: {
          items: true,
          pedido: true,
          movimientosInventario: true,
        },
      });

      if (!entrega) {
        throw new Error("La entrega ya no existe.");
      }

      for (const item of entrega.items) {
        await tx.pedidoItem.update({
          where: { id: item.pedidoItemId },
          data: { cantidadEntregada: { decrement: item.cantidad } },
        });
      }

      const tuvoInventario = entrega.movimientosInventario.length > 0;

      // Elimina la entrega; en cascada borra sus ítems y los movimientos de
      // inventario que haya generado (revirtiendo el stock sumado).
      await tx.entrega.delete({ where: { id } });

      const itemsActualizados = await tx.pedidoItem.findMany({ where: { pedidoId: entrega.pedidoId } });
      const todosCompletos = itemsActualizados.every(
        (i) => Number(i.cantidadEntregada) >= Number(i.cantidadPedida)
      );
      const algunoEntregado = itemsActualizados.some((i) => Number(i.cantidadEntregada) > 0);

      await tx.pedido.update({
        where: { id: entrega.pedidoId },
        data: {
          estado: todosCompletos ? "COMPLETO" : algunoEntregado ? "PARCIAL" : "PENDIENTE",
        },
      });

      return {
        pedidoId: entrega.pedidoId,
        proyectoId: entrega.pedido.proyectoId,
        proveedorId: entrega.pedido.proveedorId,
        tuvoInventario,
      };
    });

    revalidatePath(`/pedidos/${pedidoId}`);
    revalidatePath("/pedidos");
    revalidatePath(`/proyectos/${proyectoId}`);
    revalidatePath(`/proveedores/${proveedorId}`);
    revalidatePath("/dashboard");
    if (tuvoInventario) {
      revalidatePath("/inventario");
    }

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo eliminar la entrega." };
  }
}
