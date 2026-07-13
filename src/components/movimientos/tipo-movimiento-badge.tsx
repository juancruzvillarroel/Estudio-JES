import { Badge } from "@/components/ui/badge";

export function TipoMovimientoBadge({ tipo }: { tipo: "PEDIDO" | "ENTREGA" }) {
  return (
    <Badge variant={tipo === "PEDIDO" ? "outline" : "secondary"}>
      {tipo === "PEDIDO" ? "Pedido" : "Entrega"}
    </Badge>
  );
}
