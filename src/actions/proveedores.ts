"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ProveedorSchema } from "@/lib/validations/proveedor";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseForm(formData: FormData) {
  return ProveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    contacto: formData.get("contacto") || undefined,
    telefono: formData.get("telefono") || undefined,
    email: formData.get("email") || undefined,
    cuit: formData.get("cuit") || undefined,
    notas: formData.get("notas") || undefined,
  });
}

export async function createProveedor(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const rubroIds = formData.getAll("rubroIds") as string[];

  await prisma.proveedor.create({
    data: { ...validated.data, rubros: { connect: rubroIds.map((id) => ({ id })) } },
  });
  revalidatePath("/proveedores");
  return { success: true };
}

export async function updateProveedor(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = parseForm(formData);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const rubroIds = formData.getAll("rubroIds") as string[];

  await prisma.proveedor.update({
    where: { id },
    data: { ...validated.data, rubros: { set: rubroIds.map((id) => ({ id })) } },
  });
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  return { success: true };
}

export type CreateProveedorRapidoResult =
  | { success: true; proveedor: { id: string; nombre: string } }
  | { success: false; error: string };

export async function createProveedorRapido(input: {
  nombre: string;
  rubroId: string;
}): Promise<CreateProveedorRapidoResult> {
  const nombre = input.nombre.trim();
  if (!nombre) {
    return { success: false, error: "Ingresá un nombre." };
  }
  if (!input.rubroId) {
    return { success: false, error: "Elegí un rubro primero." };
  }

  const proveedor = await prisma.proveedor.create({
    data: { nombre, rubros: { connect: [{ id: input.rubroId }] } },
  });

  revalidatePath("/proveedores");
  return { success: true, proveedor: { id: proveedor.id, nombre: proveedor.nombre } };
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
