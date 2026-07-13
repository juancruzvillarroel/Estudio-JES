"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

export type ComboboxOption = { value: string; label: string }

function isOptionEqual(a: ComboboxOption | null, b: ComboboxOption | null) {
  return (a?.value ?? null) === (b?.value ?? null)
}

function Combobox({
  id,
  value,
  onValueChange,
  items,
  placeholder,
  disabled,
  className,
}: {
  id?: string
  value: string
  onValueChange: (value: string) => void
  items: ComboboxOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const selected = items.find((item) => item.value === value) ?? null

  return (
    <ComboboxPrimitive.Root
      items={items}
      value={selected}
      onValueChange={(item) => onValueChange(item ? item.value : "")}
      isItemEqualToValue={isOptionEqual}
      disabled={disabled}
    >
      <ComboboxPrimitive.InputGroup
        data-slot="combobox-trigger"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 h-8 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
      >
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-left outline-none placeholder:text-muted-foreground"
        />
        <ComboboxPrimitive.Icon
          render={
            <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
          }
        />
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="isolate z-50" sideOffset={4}>
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            className="relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <ComboboxPrimitive.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              Sin resultados.
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="p-1">
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                  {item.label}
                  <ComboboxPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="pointer-events-none" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
