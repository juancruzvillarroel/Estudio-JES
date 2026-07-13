"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ProveedorSchema, type ProveedorInput } from "@/lib/validations/proveedor";
import { generarCodigoProveedor } from "@/lib/codigos";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  const codigoRaw = formData.get("codigo");
  return ProveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    contacto: formData.get("contacto") || undefined,
    telefono: formData.get("telefono") || undefined,
    email: formData.get("email") || undefined,
    cuit: formData.get("cuit") || undefined,
    notas: formData.get("notas") || undefined,
    codigo: codigoRaw && String(codigoRaw).trim() !== "" ? codigoRaw : undefined,
  });
}

export async function createProveedor(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const rubroIds = formData.getAll("rubroIds") as string[];
  const codigo = await generarCodigoProveedor();

  await prisma.proveedor.create({
    data: { ...validated.data, codigo, rubros: { connect: rubroIds.map((id) => ({ id })) } },
  });
  revalidatePath("/proveedores");
  return { success: true };
}

export async function updateProveedor(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (!validated.data.codigo) {
    return { error: "El código no puede estar vacío." };
  }

  const rubroIds = formData.getAll("rubroIds") as string[];

  try {
    await prisma.proveedor.update({
      where: { id },
      data: {
        ...validated.data,
        codigo: validated.data.codigo,
        rubros: { set: rubroIds.map((id) => ({ id })) },
      },
    });
  } catch (e) {
    const target = (e as { meta?: { target?: string[] } })?.meta?.target;
    if (target?.includes("codigo")) {
      return { error: "Ya existe un proveedor con ese código." };
    }
    throw e;
  }
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  return { success: true };
}

export type CreateProveedorRapidoResult =
  | { success: true; proveedor: { id: string; nombre: string; codigo: string } }
  | { success: false; error: string };

export async function createProveedorRapido(
  input: ProveedorInput & { rubroId: string }
): Promise<CreateProveedorRapidoResult> {
  const validated = ProveedorSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }
  if (!input.rubroId) {
    return { success: false, error: "Elegí un rubro primero." };
  }

  const codigo = await generarCodigoProveedor();

  const proveedor = await prisma.proveedor.create({
    data: { ...validated.data, codigo, rubros: { connect: [{ id: input.rubroId }] } },
  });

  revalidatePath("/proveedores");
  return {
    success: true,
    proveedor: { id: proveedor.id, nombre: proveedor.nombre, codigo: proveedor.codigo },
  };
}

export async function deleteProveedor(id: string): Promise<ActionState> {
  const pedidosCount = await prisma.pedido.count({ where: { proveedorId: id } });
  if (pedidosCount > 0) {
    return { error: "No se puede eliminar: el proveedor tiene pedidos registrados." };
  }

  await prisma.proveedor.delete({ where: { id } });
  revalidatePath("/proveedores");
  return { success: true };
}
