"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteActionState = { error?: string; success?: boolean } | undefined;

export function DeleteButton({
  action,
  confirmMessage,
  onDeleted,
  iconOnly = false,
}: {
  action: () => Promise<DeleteActionState>;
  confirmMessage: string;
  onDeleted?: () => void;
  iconOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        toast.error(result.error);
      } else {
        onDeleted?.();
      }
    });
  };

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={handleClick}
        aria-label="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      onClick={handleClick}
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Eliminando..." : "Eliminar"}
    </Button>
  );
}
