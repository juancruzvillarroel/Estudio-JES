import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ESTADO_CONFIG = {
  PENDIENTE: { label: "Pendiente", variant: "error", dotColor: "bg-error" },
  PARCIAL: { label: "Parcial", variant: "warning", dotColor: "bg-warning" },
  COMPLETO: { label: "Completo", variant: "success", dotColor: "bg-success" },
  CANCELADO: { label: "Cancelado", variant: "outline", dotColor: "bg-muted-foreground" },
} as const;

export function EstadoPedidoBadge({
  estado,
  soloIndicador = false,
}: {
  estado: keyof typeof ESTADO_CONFIG;
  soloIndicador?: boolean;
}) {
  const config = ESTADO_CONFIG[estado];

  if (soloIndicador) {
    return (
      <span
        role="img"
        aria-label={config.label}
        title={config.label}
        className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", config.dotColor)}
      />
    );
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
