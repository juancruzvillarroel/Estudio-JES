"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        // Igual que `default` pero la pastilla blanca de la solapa activa la
        // dibuja <TabsIndicator />, que se desliza de una solapa a la otra en
        // vez de aparecer y desaparecer. `relative` es lo que le da el marco de
        // referencia al indicador, que va posicionado en absoluto.
        indicator: "relative bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        // Con indicador la solapa no se pinta a sí misma: el fondo lo pone el
        // indicador, que va por debajo (`z-10` acá lo deja pasar). Si además se
        // pintara la solapa, al deslizarse se verían dos pastillas a la vez.
        "group-data-[variant=indicator]/tabs-list:z-10 group-data-[variant=indicator]/tabs-list:data-active:bg-transparent group-data-[variant=indicator]/tabs-list:data-active:shadow-none dark:group-data-[variant=indicator]/tabs-list:data-active:border-transparent dark:group-data-[variant=indicator]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

/**
 * La pastilla que marca la solapa activa. Va adentro de un <TabsList
 * variant="indicator">.
 *
 * Base UI mide la solapa activa y publica su posición y su tamaño en variables
 * CSS (`--active-tab-left`, `--active-tab-top`, `--active-tab-width`,
 * `--active-tab-height`). Acá sólo se las lee: al cambiar de solapa cambian los
 * valores y la transición hace el resto, así que el movimiento sale de CSS y no
 * hay nada que animar a mano.
 *
 * `top` entra en la transición además de `translate` porque en móvil la barra
 * envuelve en varios renglones y la pastilla también se mueve para abajo.
 *
 * `renderBeforeHydration` la dibuja ya posicionada en el HTML del servidor; sin
 * eso arranca en la esquina y salta a su lugar cuando React hidrata.
 */
function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      renderBeforeHydration
      className={cn(
        "absolute left-0 z-0 rounded-md bg-background shadow-sm",
        "top-[var(--active-tab-top)] h-[var(--active-tab-height)] w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)]",
        "transition-[translate,width,top] duration-300 ease-out motion-reduce:transition-none",
        "dark:border dark:border-input dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("min-w-0 flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent, tabsListVariants }
