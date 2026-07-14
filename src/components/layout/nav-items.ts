import { LayoutDashboard, Building2, Truck, ClipboardList, Warehouse, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, key: "dashboard" },
  { href: "/proyectos", label: "Proyectos", icon: Building2, key: "proyectos" },
  { href: "/pedidos", label: "Pedidos y entregas", icon: ClipboardList, key: "pedidos" },
  { href: "/proveedores", label: "Proveedores y materiales", icon: Truck, key: "proveedores" },
  { href: "/inventario", label: "Inventario", icon: Warehouse, key: "inventario" },
  { href: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];
