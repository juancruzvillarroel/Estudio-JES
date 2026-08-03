"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/utils";

type ProyectoOpcion = { id: string; nombre: string };

export function Sidebar({
  nombre,
  esAdmin,
  paginasPermitidas,
  proyectos,
}: {
  nombre: string;
  esAdmin: boolean;
  paginasPermitidas: string[];
  proyectos: ProyectoOpcion[];
}) {
  const pathname = usePathname();
  const enProyectos = pathname.startsWith("/proyectos");
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const proyectosAbierto = manualOpen ?? enProyectos;

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || esAdmin
  ).filter((item) => esAdmin || !item.key || paginasPermitidas.includes(item.key));

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-56 md:flex-col md:overflow-y-auto md:border-r md:border-neutral-800 md:bg-black">
      <div className="px-5 py-6">
        <Image
          src="/logo-jes.png"
          alt="JES & arqs"
          width={80}
          height={70}
          className="invert"
        />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.key === "proyectos") {
            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setManualOpen(!proyectosAbierto)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white transition-colors",
                    active
                      ? "bg-neutral-800 font-medium"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      proyectosAbierto && "rotate-180"
                    )}
                  />
                </button>
                {proyectosAbierto && (
                  <div className="mt-1 mb-1 flex flex-col gap-0.5 border-l border-neutral-800 pl-5">
                    <Link
                      href="/proyectos"
                      className={cn(
                        "truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                        pathname === "/proyectos"
                          ? "font-medium text-white"
                          : "text-neutral-400 hover:text-white"
                      )}
                    >
                      Ver todas
                    </Link>
                    {proyectos.map((p) => {
                      const proyectoActivo =
                        pathname === `/proyectos/${p.id}` || pathname.startsWith(`/proyectos/${p.id}/`);
                      return (
                        <Link
                          key={p.id}
                          href={`/proyectos/${p.id}`}
                          className={cn(
                            "truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                            proyectoActivo
                              ? "font-medium text-white"
                              : "text-neutral-400 hover:text-white"
                          )}
                        >
                          {p.nombre}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white transition-colors",
                active
                  ? "bg-neutral-800 font-medium"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-neutral-800 px-4 py-3">
        <p className="mb-2 truncate text-xs text-neutral-400">{nombre}</p>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
