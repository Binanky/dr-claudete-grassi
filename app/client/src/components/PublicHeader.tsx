import { CalendarDays, Menu, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export function BrandMark({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`focus-ring inline-flex items-center gap-3 rounded-lg ${light ? "text-white" : "text-[#34251f]"}`}>
    <span className={`grid size-10 place-items-center rounded-full border ${light ? "border-white/30 bg-white/10" : "border-[#b78b78]/40 bg-[#f5e7db]"}`}><Sparkles size={16} /></span>
    <span className="leading-none"><span className="display block text-xl tracking-[-.04em]">Dr. Claudete Grassi</span><span className={`mt-1 block text-[8px] font-extrabold uppercase tracking-[.2em] ${light ? "text-white/55" : "text-[#886757]"}`}>Psicóloga · CRP 08/22767</span></span>
  </Link>;
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const items = [
    ["Sobre", "#sobre"],
    ["Especialidades", "#especialidades"],
    ["Como funciona", "#como-funciona"],
    ["Acompanhar", "/acompanhar"],
  ];

  return <header className="sticky top-0 z-40 border-b border-[#e9dfd3]/70 bg-[#fbf8f3]/90 backdrop-blur-xl">
    <div className="container flex h-[76px] items-center justify-between">
      <BrandMark />
      <nav className="hidden items-center gap-7 lg:flex">{items.map(([label, href]) => <a key={label} href={href} className="focus-ring rounded px-1 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#74635a] transition hover:text-[#7d493a]">{label}</a>)}</nav>
      <div className="hidden lg:block"><Link href="/agendar" className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-[#7d493a] px-5 text-[11px] font-extrabold uppercase tracking-[.1em] text-[#fffaf4] transition hover:bg-[#68392e] active:scale-[.97]"><CalendarDays size={15} /> Agendar</Link></div>
      <button onClick={() => setOpen(value => !value)} className="focus-ring grid size-10 place-items-center rounded-full border border-[#ddcfc1] lg:hidden" aria-label="Abrir navegação"><Menu size={18} /></button>
    </div>
    {open && <nav className="container flex flex-col gap-1 border-t border-[#e9dfd3] py-4 lg:hidden">{items.map(([label, href]) => <a key={label} onClick={() => setOpen(false)} href={href} className="rounded-xl px-3 py-3 text-sm font-bold text-[#57463e] hover:bg-[#f2e9df]">{label}</a>)}<Link href="/agendar" onClick={() => setOpen(false)} className="mt-1 rounded-xl bg-[#7d493a] px-3 py-3 text-sm font-bold text-[#fffaf4]">Agendar horário</Link></nav>}
  </header>;
}
