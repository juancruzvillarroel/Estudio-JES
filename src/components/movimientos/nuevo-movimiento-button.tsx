"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NuevoMovimientoButton() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shadow-md"
            aria-label="Nuevo movimiento"
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push("/pedidos/nuevo?tipo=PEDIDO")}>
          Nuevo pedido
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/pedidos/nuevo?tipo=ENTREGA")}>
          Nueva entrega
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
