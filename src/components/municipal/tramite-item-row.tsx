"use client";

import { useState, useTransition } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  actualizarNotasTramite,
  eliminarArchivoTramite,
  eliminarTipoTramite,
  subirArchivoTramite,
} from "@/actions/municipal";

const EXTENSIONES_IMAGEN = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function obtenerExtension(nombre: string) {
  const partes = nombre.split(".");
  return partes.length > 1 ? partes[partes.length - 1].toLowerCase() : "";
}

export function TramiteItemRow({
  proyectoId,
  tipoId,
  nombre,
  descripcion,
  estado,
  notas,
  archivoNombre,
  archivoUrl,
  vista = "grid",
}: {
  proyectoId: string;
  tipoId: string;
  nombre: string;
  descripcion: string | null;
  estado: "PENDIENTE" | "PRESENTADO";
  notas: string | null;
  archivoNombre: string | null;
  archivoUrl: string | null;
  vista?: "grid" | "lista";
}) {
  const [pending, startTransition] = useTransition();
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notasValue, setNotasValue] = useState(notas ?? "");

  const extension = archivoNombre ? obtenerExtension(archivoNombre) : "";
  const esImagen = EXTENSIONES_IMAGEN.includes(extension);
  const esPdf = extension === "pdf";

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    startTransition(async () => {
      await subirArchivoTramite(proyectoId, tipoId, archivo);
    });
  };

  const handleEliminarArchivo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await eliminarArchivoTramite(proyectoId, tipoId);
    });
  };

  const handleGuardarNotas = () => {
    startTransition(async () => {
      await actualizarNotasTramite(proyectoId, tipoId, notasValue);
      setEditandoNotas(false);
    });
  };

  const badge = (
    <Badge variant={estado === "PRESENTADO" ? "success" : "warning"} className="shrink-0">
      {estado === "PRESENTADO" ? "Presentado" : "Pendiente"}
    </Badge>
  );

  const botonAdjuntar = (
    <label
      className={
        vista === "grid"
          ? "inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          : "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      }
    >
      <Paperclip className="h-3 w-3" />
      {archivoUrl ? "Reemplazar" : "Adjuntar"}
      <input type="file" className="hidden" onChange={handleArchivo} disabled={pending} />
    </label>
  );

  const botonEliminarTipo = (
    <DeleteButton
      iconOnly
      action={() => eliminarTipoTramite(proyectoId, tipoId)}
      confirmMessage={`¿Eliminar "${nombre}" del listado de trámites?`}
    />
  );

  const notasSection =
    editandoNotas ? (
      <div className="flex flex-col gap-2">
        <Textarea
          value={notasValue}
          onChange={(e) => setNotasValue(e.target.value)}
          rows={2}
          placeholder="Notas..."
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={handleGuardarNotas}>
            Guardar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setNotasValue(notas ?? "");
              setEditandoNotas(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        className="text-left text-xs text-muted-foreground hover:underline"
        onClick={() => setEditandoNotas(true)}
      >
        {notas ? notas : "+ Agregar nota"}
      </button>
    );

  if (vista === "lista") {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{nombre}</p>
            {descripcion && (
              <p className="truncate text-xs text-muted-foreground">{descripcion}</p>
            )}
          </div>
          {botonAdjuntar}
          {archivoUrl && (
            <a
              href={archivoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[10rem] truncate text-xs text-muted-foreground hover:underline"
            >
              {archivoNombre}
            </a>
          )}
          {archivoUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={handleEliminarArchivo}
              aria-label="Quitar archivo"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {botonEliminarTipo}
          <div className="ml-auto shrink-0">{badge}</div>
        </div>
        {notasSection}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{nombre}</p>
          {descripcion && (
            <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {badge}
          {botonEliminarTipo}
        </div>
      </div>

      <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/20">
        {archivoUrl ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={handleEliminarArchivo}
              aria-label="Quitar archivo"
              className="absolute right-1.5 top-1.5 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <a
              href={archivoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center"
            >
              {esImagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={archivoUrl}
                  alt={archivoNombre ?? "archivo"}
                  className="h-full w-full object-cover"
                />
              ) : esPdf ? (
                <iframe
                  src={archivoUrl}
                  title={archivoNombre ?? "archivo"}
                  className="pointer-events-none h-full w-full"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 p-2 text-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="w-full truncate text-xs">{archivoNombre}</span>
                </div>
              )}
            </a>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sin archivo</p>
        )}
      </div>

      {botonAdjuntar}

      {notasSection}
    </div>
  );
}
