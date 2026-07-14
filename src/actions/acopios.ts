"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSeccion } from "@/lib/dal";
import { AcopioSchema, type AcopioInput } from "@/lib/validations/acopio";

export type AcopioOpcion = {
  id: string;
  proyectoId: string;
  proveedorId: string;
  tipo: "MONTO" | "MATERIAL";
  notas: string | null;
  materialId: string | null;
  materialNombre: string | null;
  unidad: string | null;
  cantidadTotal: number | null;
  montoTotal: number | null;
  precios: { materialId: string; materialNombre: string; unidad: string; precioUnitario: number }[];
  consumido: number;
};

export type CreateAcopioResult =
  | { success: true; acopio: AcopioOpcion }
  | { success: false; error: string };

export async function createAcopio(input: AcopioInput): Promise<CreateAcopioResult> {
  await requireSeccion("pedidos");

  const validated = AcopioSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = validated.data;

  try {
    const acopio = await prisma.$transaction(async (tx) => {
      if (data.tipo === "MATERIAL") {
        const material = await tx.material.findUnique({ where: { id: data.materialId } });
        if (!material) {
          throw new Error("El material seleccionado ya no existe.");
        }
        return tx.acopio.create({
          data: {
            proyectoId: data.proyectoId,
            proveedorId: data.proveedorId,
            tipo: "MATERIAL",
            notas: data.notas,
            materialId: data.materialId,
            cantidadTotal: data.cantidadTotal,
            unidad: material.unidad,
          },
          include: { material: true, precios: { include: { material: true } } },
        });
      }

      const materiales = await tx.material.findMany({
        where: { id: { in: data.precios.map((p) => p.materialId) } },
      });
      if (materiales.length !== data.precios.length) {
        throw new Error("Uno de los materiales seleccionados ya no existe.");
      }

      return tx.acopio.create({
        data: {
          proyectoId: data.proyectoId,
          proveedorId: data.proveedorId,
          tipo: "MONTO",
          notas: data.notas,
          montoTotal: data.montoTotal,
          precios: {
            create: data.precios.map((p) => ({
              materialId: p.materialId,
              precioUnitario: p.precioUnitario,
            })),
          },
        },
        include: { material: true, precios: { include: { material: true } } },
      });
    });

    revalidatePath("/pedidos");
    revalidatePath("/pedidos/nuevo");
    revalidatePath(`/proyectos/${data.proyectoId}`);
    revalidatePath(`/proveedores/${data.proveedorId}`);

    return {
      success: true,
      acopio: {
        id: acopio.id,
        proyectoId: acopio.proyectoId,
        proveedorId: acopio.proveedorId,
        tipo: acopio.tipo,
        notas: acopio.notas,
        materialId: acopio.materialId,
        materialNombre: acopio.material?.nombre ?? null,
        unidad: acopio.unidad,
        cantidadTotal: acopio.cantidadTotal ? Number(acopio.cantidadTotal) : null,
        montoTotal: acopio.montoTotal ? Number(acopio.montoTotal) : null,
        precios: acopio.precios.map((p) => ({
          materialId: p.materialId,
          materialNombre: p.material.nombre,
          unidad: p.material.unidad,
          precioUnitario: Number(p.precioUnitario),
        })),
        consumido: 0,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "No se pudo crear el acopio." };
  }
}
