"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.string().min(1, "Ingresá tu email"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type LoginState = {
  error?: string;
} | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validatedFields = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: "Completá email y contraseña." };
  }

  const { email, password } = validatedFields.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Email o contraseña incorrectos." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { error: "Email o contraseña incorrectos." };
  }

  await createSession(user.id, user.nombre, user.esAdmin);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
