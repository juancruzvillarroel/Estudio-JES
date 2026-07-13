"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/utils";

export function Sidebar({ nombre, esAdmin }: { nombre: string; esAdmin: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || esAdmin);

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-neutral-800 md:bg-black">
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
