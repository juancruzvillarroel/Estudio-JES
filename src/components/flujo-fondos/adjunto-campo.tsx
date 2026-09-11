"use client";

import { useRef } from "react";
import { Camera, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Un campo para adjuntar un papel: elegir archivo o sacarle una foto.
 *
 * Existe porque el gasto guarda dos papeles distintos —el comprobante de pago y
 * la factura— y el bloque completo (los dos botones, los dos inputs ocultos, la
 * fila del archivo elegido y la del que ya estaba guardado) son unas cuarenta
 * líneas que no vale la pena tener duplicadas.
 *
 * El estado vive afuera: acá solo se avisa qué archivo se eligió y si se pidió
 * quitar el que había. Lo único propio son los dos inputs ocultos, que se
 * limpian solos apenas se lee el archivo; así elegir dos veces el mismo archivo
 * vuelve a disparar el evento y nadie de afuera tiene que resetearlos.
 */
export function AdjuntoCampo({
  label,
  textoActual,
  archivo,
  onArchivo,
  urlActual,
  quitado,
  onQuitar,
  className,
}: {
  label: string;
  /** Qué dice el link del archivo ya guardado, p. ej. "Ver comprobante actual". */
  textoActual: string;
  /** El archivo recién elegido, todavía sin subir. */
  archivo: File | null;
  onArchivo: (archivo: File | null) => void;
  /** El que ya está guardado, si lo hay. */
  urlActual?: string | null;
  quitado?: boolean;
  onQuitar: () => void;
  className?: string;
}) {
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    onArchivo(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const minuscula = label.toLowerCase();

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Adjuntar archivo de ${minuscula}`}
            onClick={() => inputArchivoRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Sacar foto ${minuscula === "factura" ? "de la" : "del"} ${minuscula}`}
            onClick={() => inputCamaraRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
          </Button>
          <input
            ref={inputArchivoRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={elegir}
          />
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={elegir}
          />
        </div>

        {archivo ? (
          <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <span className="truncate">{archivo.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar el archivo de ${minuscula}`}
              onClick={() => onArchivo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : urlActual && !quitado ? (
          <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <a
              href={urlActual}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate underline"
            >
              {textoActual}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar el archivo de ${minuscula}`}
              onClick={onQuitar}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
