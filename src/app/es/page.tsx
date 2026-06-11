import Link from "next/link";

const highlights = [
  {
    title: "Área de control del profesor",
    description:
      "Crea la sala, edita preguntas y controla la pregunta activa desde una sola pantalla.",
    href: "/es/teacher",
    accent: "from-slate-950 to-slate-700",
  },
  {
    title: "Sala de estudiantes",
    description:
      "Únete con el código, vota sobre la pregunta en vivo y observa los resultados actualizándose al instante.",
    href: "/es/join",
    accent: "from-amber-300 to-orange-400",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fff7e8_0%,_#f2f0ea_40%,_#e8ecf4_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(10,10,10,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-36 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <div className="absolute right-6 top-6">
        <Link
          href="/"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
        >
          English
        </Link>
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center gap-8 px-6 py-10 lg:px-10">
        <div className="max-w-4xl space-y-6 rounded-[2.25rem] border border-white/70 bg-white/75 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
            Aula en vivo
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Una sala de cuestionarios al estilo Kahoot para profesores y
            estudiantes.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
            Los profesores crean cuestionarios y ejecutan la sala desde un panel
            de control dedicado. Los estudiantes se unen con un código, votan
            sobre la pregunta activa y ven resultados en vivo en lugar de una
            revelación de respuesta correcta.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {highlights.map((highlight) => (
              <Link
                key={highlight.title}
                href={highlight.href}
                className="group rounded-[1.75rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.1)]"
              >
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${highlight.accent}`}
                />
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                  {highlight.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {highlight.description}
                </p>
                <span className="mt-5 inline-flex text-sm font-semibold text-slate-950">
                  Abrir área de trabajo
                  <span className="ml-2 transition group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
