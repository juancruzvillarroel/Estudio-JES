"use client";

import { useState, useTransition } from "react";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  actualizarEstadoDocumento,
  eliminarTipoDocumento,
  renombrarTipoDocumento,
} from "@/actions/documentos";
import { cn } from "@/lib/utils";
import { colorEstadoDocumento, type EstadoTarea, type OpcionSimple } from "@/lib/tareas";
import { TareaDialog } from "@/components/tareas/tarea-dialog";
import { BotonRenombrar, RenombrarFila } from "./renombrar-fila";

const COLOR_PUNTO: Record<ReturnType<typeof colorEstadoDocumento>, string> = {
  rojo: "bg-error",
  amarillo: "bg-warning",
  verde: "bg-success",
};

/** Lo que cuenta de la tarea activa para decidir el color y el texto del punto. */
type TareaActiva = { id: string; estado: EstadoTarea; aCorregir: boolean; titulo: string };

const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  COMPLETADA: "Completada",
};

export function DocumentoItemCard({
  proyectoId,
  tipoId,
  nombre,
  descripcion,
  estado,
  tareaActiva,
  compartido,
  dragHandle,
  tituloTareaInicial,
  rubros,
  usuarios,
}: {
  proyectoId: string;
  tipoId: string;
  nombre: string;
  descripcion: string | null;
  estado: "PENDIENTE" | "PRESENTADO";
  /** La tarea sin completar vinculada a este plano, si tiene una. */
  tareaActiva: TareaActiva | null;
  /** Si viene del catálogo global, para avisar que al renombrarlo se despega. */
  compartido?: boolean;
  dragHandle?: React.ReactNode;
  /** Título con el que arranca la tarea del botón "Nueva tarea": categoría - subsección - nivel... */
  tituloTareaInicial: string;
  rubros: OpcionSimple[];
  usuarios: OpcionSimple[];
}) {
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);

  const handleToggle = () => {
    startTransition(async () => {
      await actualizarEstadoDocumento(proyectoId, tipoId, estado !== "PRESENTADO");
    });
  };

  const color = colorEstadoDocumento(estado, tareaActiva);
  const descripcionPunto = tareaActiva
    ? `Tarea ${ESTADO_TAREA_LABEL[tareaActiva.estado]}${tareaActiva.aCorregir ? " (a corregir)" : ""}: "${tareaActiva.titulo}"`
    : estado === "PRESENTADO"
      ? `Marcar "${nombre}" como pendiente`
      : `Marcar "${nombre}" como presentado`;

  if (editando) {
    return (
      <div className="rounded-md border">
        <RenombrarFila
          inicial={nombre}
          aviso={
            compartido
              ? "Viene del listado compartido: al renombrarlo queda una copia propia de esta obra y las demás no se enteran."
              : undefined
          }
          onGuardar={(valor) => renombrarTipoDocumento(proyectoId, tipoId, valor)}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border p-2.5 transition-colors",
        estado === "PRESENTADO" && "border-success/30 bg-success-bg"
      )}
    >
      {dragHandle}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{nombre}</p>
        {descripcion && <p className="truncate text-xs text-muted-foreground">{descripcion}</p>}
      </div>
      {/* Mientras el plano tenga una tarea sin completar no se puede crear
          otra: el punto de abajo ya cuenta en qué quedó esa, y una segunda
          dejaría la ambigüedad de cuál manda el color. */}
      {!tareaActiva && (
        <TareaDialog
          proyectoId={proyectoId}
          rubros={rubros}
          usuarios={usuarios}
          tituloInicial={tituloTareaInicial}
          documentoTipoId={tipoId}
          onSaved={(tarea) => toast.success(`Tarea creada: "${tarea.titulo}"`)}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Crear tarea para "${nombre}"`}
            >
              <ListPlus className="h-3.5 w-3.5" />
            </Button>
          }
        />
      )}
      <BotonRenombrar nombre={nombre} onClick={() => setEditando(true)} />
      <DeleteButton
        iconOnly
        action={() => eliminarTipoDocumento(proyectoId, tipoId)}
        confirmMessage={`¿Eliminar "${nombre}" del listado de documentos?`}
      />
      {/* El punto resume el estado real: si hay una tarea vinculada, sigue a
          su color solo (ver colorEstadoDocumento) y no se toca a mano; si no
          hay ninguna, es el tilde de siempre y se clickea para marcar
          presentado/pendiente. */}
      {tareaActiva ? (
        <span
          role="img"
          title={descripcionPunto}
          aria-label={descripcionPunto}
          className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", COLOR_PUNTO[color])}
        />
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          title={descripcionPunto}
          aria-label={descripcionPunto}
          className={cn(
            "inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-opacity disabled:opacity-50",
            COLOR_PUNTO[color]
          )}
        />
      )}
    </div>
  );
}
