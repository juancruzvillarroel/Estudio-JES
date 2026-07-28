"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Título + subtítulo de una página, donde el subtítulo se ajusta (y salta de
 * línea) para no ocupar más ancho que el título, en vez de estirarse más
 * largo que él. El ancho se mide en el cliente porque depende de la
 * tipografía renderizada; con solo CSS no hay forma de que un texto que
 * puede wrappear (el subtítulo) herede el ancho de otro que no wrappea (el
 * título).
 */
export function PageHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
}) {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [anchoTitulo, setAnchoTitulo] = useState<number>();

  useLayoutEffect(() => {
    const el = tituloRef.current;
    if (!el) return;
    const actualizarAncho = () => setAnchoTitulo(el.offsetWidth);
    actualizarAncho();
    const observer = new ResizeObserver(actualizarAncho);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <h1 ref={tituloRef} className="w-fit text-3xl font-semibold tracking-tight">
        {title}
      </h1>
      <p
        className="text-sm text-muted-foreground"
        style={anchoTitulo ? { maxWidth: anchoTitulo } : undefined}
      >
        {subtitle}
      </p>
    </div>
  );
}
