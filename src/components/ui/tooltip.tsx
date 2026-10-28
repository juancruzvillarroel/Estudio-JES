"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

/**
 * Tooltip de ayuda para botones: envolvé el botón con `<Tooltip content="...">`
 * y al pasar el cursor por encima aparece el texto. Si `content` viene vacío
 * o `undefined`, se muestra el hijo sin ningún tooltip alrededor.
 */
function Tooltip({
  content,
  children,
  side = "top",
  sideOffset = 6,
  ...rootProps
}: {
  content?: React.ReactNode
  children: React.ReactElement
} & Omit<TooltipPrimitive.Root.Props, "children"> &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset">) {
  if (!content) return children

  return (
    <TooltipPrimitive.Root {...rootProps}>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          side={side}
          sideOffset={sideOffset}
          className="z-50"
        >
          <TooltipPrimitive.Popup
            data-slot="tooltip-content"
            className={cn(
              "z-50 origin-(--transform-origin) rounded-md bg-foreground px-2 py-1 text-xs text-background duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
