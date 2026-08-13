"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { normalizarUsuario } from "@/lib/usuarios";

const LoginSchema = z.object({
  usuario: z.string().min(1, "Ingresá tu usuario"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type LoginState = {
  error?: string;
} | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validatedFields = LoginSchema.safeParse({
    usuario: formData.get("usuario"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: "Completá usuario y contraseña." };
  }

  const { usuario, password } = validatedFields.data;

  // Se normaliza igual que al crear el usuario: sin espacios sueltos ni
  // mayúsculas, así no falla el login por cómo lo tipeó cada uno.
  const user = await prisma.user.findUnique({ where: { usuario: normalizarUsuario(usuario) } });
  if (!user) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  await createSession(user.id, user.nombre, user.esAdmin, user.paginasPermitidas);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
