"use client";

import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Proyecto = { id: string; nombre: string };
type Acopio = { id: string; label: string };

type Filtros = {
  proyectoId?: string;
  acopioId?: string;
  desde?: string;
  hasta?: string;
};

export function CuentaCorrienteFiltro({
  proyectos,
  acopios,
  proyectoId,
  acopioId,
  desde,
  hasta,
}: {
  proyectos: Proyecto[];
  acopios: Acopio[];
} & Filtros) {
  const router = useRouter();
  const pathname = usePathname();

  function updateParams(overrides: Filtros) {
    const next = { proyectoId, acopioId, desde, hasta, ...overrides };
    const params = new URLSearchParams();
    if (next.proyectoId && next.proyectoId !== "todos") params.set("proyectoId", next.proyectoId);
    if (next.acopioId && next.acopioId !== "todos") params.set("acopioId", next.acopioId);
    if (next.desde) params.set("desde", next.desde);
    if (next.hasta) params.set("hasta", next.hasta);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proyectoId">Proyecto</Label>
        <Select
          value={proyectoId ?? "todos"}
          onValueChange={(value) => updateParams({ proyectoId: value ?? "todos" })}
          items={{ todos: "Todos", ...Object.fromEntries(proyectos.map((p) => [p.id, p.nombre])) }}
        >
          <SelectTrigger id="proyectoId" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acopioId">Acopio</Label>
        <Select
          value={acopioId ?? "todos"}
          onValueChange={(value) => updateParams({ acopioId: value ?? "todos" })}
          items={{ todos: "Todos", ...Object.fromEntries(acopios.map((a) => [a.id, a.label])) }}
        >
          <SelectTrigger id="acopioId" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {acopios.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desde">Desde</Label>
        <Input
          id="desde"
          type="date"
          defaultValue={desde}
          className="w-40"
          onChange={(e) => updateParams({ desde: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hasta">Hasta</Label>
        <Input
          id="hasta"
          type="date"
          defaultValue={hasta}
          className="w-40"
          onChange={(e) => updateParams({ hasta: e.target.value })}
        />
      </div>
    </div>
  );
}
