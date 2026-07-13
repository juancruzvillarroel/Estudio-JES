import { Badge } from "@/components/ui/badge";

export const ESTADO_CONFIG = {
  PENDIENTE: { label: "Pendiente", variant: "error" },
  PARCIAL: { label: "Parcial", variant: "warning" },
  COMPLETO: { label: "Completo", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "outline" },
} as const;

export function EstadoPedidoBadge({
  estado,
}: {
  estado: keyof typeof ESTADO_CONFIG;
}) {
  const config = ESTADO_CONFIG[estado];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
