"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleMaterialActivo } from "@/actions/materiales";

export function ToggleActivoButton({ id, activo }: { id: string; activo: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleMaterialActivo(id, !activo))}
    >
      {activo ? "Desactivar" : "Activar"}
    </Button>
  );
}
