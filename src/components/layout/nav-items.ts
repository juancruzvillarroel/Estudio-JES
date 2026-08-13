import {
  LayoutDashboard,
  Building2,
  Truck,
  ClipboardList,
  ListChecks,
  Warehouse,
  Users,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, key: "dashboard" },
  { href: "/proyectos", label: "Proyectos", icon: Building2, key: "proyectos" },
  // Sin `key`: las tareas las ve cualquier usuario logueado, no dependen de
  // los permisos por sección.
  { href: "/tareas", label: "Tareas", icon: ListChecks },
  { href: "/pedidos", label: "Pedidos y entregas", icon: ClipboardList, key: "pedidos" },
  { href: "/proveedores", label: "Proveedores y materiales", icon: Truck, key: "proveedores" },
  { href: "/inventario", label: "Inventario", icon: Warehouse, key: "inventario" },
  { href: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];
