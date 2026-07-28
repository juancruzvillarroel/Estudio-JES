"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function MobileNav({
  esAdmin,
  paginasPermitidas,
}: {
  esAdmin: boolean;
  paginasPermitidas: string[];
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || esAdmin
  ).filter((item) => esAdmin || !item.key || paginasPermitidas.includes(item.key));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex bg-neutral-900 md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex flex-1 items-center justify-center py-[19px]",
              active ? "text-white" : "text-white/50"
            )}
          >
            <Icon className="h-6 w-6" />
          </Link>
        );
      })}
    </nav>
  );
}
