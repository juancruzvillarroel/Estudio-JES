import { LayoutDashboard, Building2, Truck, ClipboardList, Warehouse, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/proyectos", label: "Proyectos", icon: Building2 },
  { href: "/pedidos", label: "Pedidos y entregas", icon: ClipboardList },
  { href: "/proveedores", label: "Proveedores y materiales", icon: Truck },
  { href: "/inventario", label: "Inventario", icon: Warehouse },
  { href: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];
