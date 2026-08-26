/**
 * Contenedor de sección del resumen de flujo de fondos: un solo rectángulo por
 * bloque temático, con el título sobre la barra oscura.
 *
 * Vive en su propio archivo (y no dentro del resumen) porque lo comparten el
 * resumen y el panel de honorarios; tenerlo en uno e importarlo desde el otro
 * armaba un ciclo de imports.
 */
export function Panel({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-neutral-800 px-4 py-3">
        <h4 className="text-sm font-semibold text-white">{titulo}</h4>
        {descripcion && <p className="text-xs text-neutral-300">{descripcion}</p>}
      </header>
      {children}
    </section>
  );
}
