"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { UsuarioCreateSchema, UsuarioUpdateSchema } from "@/lib/validations/usuario";

export type ActionState = { error?: string; success?: boolean } | undefined;

async function requireAdmin() {
  const session = await verifySession();
  if (!session.esAdmin) {
    throw new Error("No tenés permisos para administrar usuarios.");
  }
  return session;
}

export async function createUsuario(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const validated = UsuarioCreateSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    password: formData.get("password"),
    esAdmin: formData.get("esAdmin") === "on",
    paginasPermitidas: formData.getAll("paginasPermitidas"),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const existente = await prisma.user.findUnique({ where: { email: validated.data.email } });
  if (existente) {
    return { error: "Ya existe un usuario con ese email." };
  }

  const passwordHash = await bcrypt.hash(validated.data.password, 10);
  await prisma.user.create({
    data: {
      nombre: validated.data.nombre,
      email: validated.data.email,
      passwordHash,
      esAdmin: validated.data.esAdmin,
      paginasPermitidas: validated.data.paginasPermitidas,
    },
  });

  revalidatePath("/usuarios");
  return { success: true };
}

export async function updateUsuario(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  const validated = UsuarioUpdateSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    password: formData.get("password") || undefined,
    esAdmin: formData.get("esAdmin") === "on",
    paginasPermitidas: formData.getAll("paginasPermitidas"),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const usuarioActual = await prisma.user.findUnique({ where: { id } });
  if (!usuarioActual) {
    return { error: "El usuario ya no existe." };
  }

  const otroConEseEmail = await prisma.user.findFirst({
    where: { email: validated.data.email, NOT: { id } },
  });
  if (otroConEseEmail) {
    return { error: "Ya existe un usuario con ese email." };
  }

  if (usuarioActual.esAdmin && !validated.data.esAdmin) {
    const otrosAdmins = await prisma.user.count({ where: { esAdmin: true, NOT: { id } } });
    if (otrosAdmins === 0) {
      return { error: "No se puede quitar el permiso de administrador: es el único administrador." };
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      nombre: validated.data.nombre,
      email: validated.data.email,
      esAdmin: validated.data.esAdmin,
      paginasPermitidas: validated.data.paginasPermitidas,
      ...(validated.data.password ? { passwordHash: await bcrypt.hash(validated.data.password, 10) } : {}),
    },
  });

  revalidatePath("/usuarios");
  return { success: true };
}

export async function deleteUsuario(id: string): Promise<ActionState> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No autorizado." };
  }

  if (id === session.userId) {
    return { error: "No podés eliminar tu propio usuario mientras estás con la sesión iniciada." };
  }

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) {
    return { error: "El usuario ya no existe." };
  }

  if (usuario.esAdmin) {
    const otrosAdmins = await prisma.user.count({ where: { esAdmin: true, NOT: { id } } });
    if (otrosAdmins === 0) {
      return { error: "No se puede eliminar: es el único usuario administrador." };
    }
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/usuarios");
  return { success: true };
}
