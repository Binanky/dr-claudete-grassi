import { ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, Clock3, LockKeyhole, Mail, MapPin, ShieldCheck, XCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { BrandMark } from "@/components/PublicHeader";
import { trpc } from "@/lib/trpc";
import { formatAppointment } from "@/lib/studioFormat";

const styles = { Pendente: "bg-amber-50 text-amber-800", Confirmado: "bg-emerald-50 text-emerald-800", Cancelado: "bg-red-50 text-red-800", Concluído: "bg-slate-100 text-slate-700" } as const;

export default function TrackAppointment() {
  const [, params] = useRoute("/agendamento/:token");
  const [, setLocation] = useLocation();
  const [tokenInput, setTokenInput] = useState("");
  const token = params?.token;
  const track = trpc.studio.trackAppointment.useQuery({ token: token ?? "invalid" }, { enabled: Boolean(token), retry: false });
  const cancel = trpc.studio.cancelWithToken.useMutation({ onSuccess: () => track.refetch() });

  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = tokenInput.trim();
    if (!raw) return;
    let value = raw;
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/agendamento\/([^/]+)/);
      if (match?.[1]) value = decodeURIComponent(match[1]);
    } catch {
      const match = raw.match(/\/agendamento\/([^/]+)/);
      if (match?.[1]) value = decodeURIComponent(match[1]);
    }
    setLocation(`/agendamento/${value}`);
  }
  const frame = (children: React.ReactNode) => <main className="texture min-h-screen bg-[#fbf8f3] px-5 py-6"><div className="container"><div className="flex items-center justify-between"><BrandMark /><Link href="/" className="focus-ring text-xs font-bold text-[#77665d]">Voltar ao site</Link></div>{children}</div></main>;

  if (!token) return frame(<section className="card-surface mx-auto mt-14 max-w-xl rounded-[30px] p-8 sm:p-10"><span className="grid size-12 place-items-center rounded-full bg-[#f2e0d6] text-[#8b5545]"><Mail size={20} /></span><p className="mt-6 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8b5545]">Acompanhamento de agendamento</p><h1 className="display mt-3 text-4xl">Acesse seu link exclusivo.</h1><p className="mt-3 text-sm leading-7 text-[#75645a]">Cole o código recebido após sua solicitação para visualizar o status do agendamento.</p><form onSubmit={find} className="mt-7"><input value={tokenInput} onChange={event => setTokenInput(event.target.value)} className="field" placeholder="Cole o código de acesso" /><button className="focus-ring mt-3 flex h-11 w-full items-center justify-center rounded-full bg-[#7d493a] text-[11px] font-extrabold uppercase tracking-[.1em] text-white">Acompanhar solicitação</button></form></section>);
  if (track.isLoading) return frame(<section className="card-surface mx-auto mt-14 max-w-xl rounded-[30px] p-10 text-center text-sm text-[#75645a]">Carregando agendamento...</section>);
  if (track.error || !track.data) return frame(<section className="card-surface mx-auto mt-14 max-w-xl rounded-[30px] p-8 text-center sm:p-12"><XCircle className="mx-auto text-[#b4695b]" size={44} /><h1 className="display mt-5 text-4xl">Link não encontrado</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#75645a]">Este acesso pode ter sido substituído. Entre em contato com a profissional para receber um novo link.</p><Link href="/acompanhar" className="focus-ring mt-7 inline-block text-xs font-extrabold text-[#7d493a]">Tentar outro código</Link></section>);

  const data = track.data;
  return frame(<div className="mx-auto mt-10 max-w-4xl"><Link href="/" className="focus-ring inline-flex items-center gap-2 text-xs font-bold text-[#77665d]"><ArrowLeft size={14} /> Voltar ao início</Link><div className="mt-6 grid gap-5 lg:grid-cols-[1.18fr_.82fr]"><section className="card-surface rounded-[30px] p-6 sm:p-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8b5545]">Seu agendamento</p><h1 className="display mt-3 text-4xl">Olá, {data.clientName.split(" ")[0]}.</h1></div><span className={`rounded-full px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.08em] ${styles[data.publicStatus as keyof typeof styles]}`}>{data.publicStatus}</span></div><div className="mt-8 grid gap-3 rounded-[22px] bg-[#f7efe7] p-5 sm:grid-cols-3"><Info icon={CalendarDays} label="Data e hora" value={formatAppointment(data.scheduledAt)} /><Info icon={Clock3} label="Duração" value={`${data.durationMinutes} minutos`} /><Info icon={MapPin} label="Cuidado" value={data.serviceName} /></div>{data.status !== "cancelled" && data.status !== "completed" && <div className="mt-7"><button onClick={() => { if (window.confirm("Deseja cancelar esta solicitação?")) cancel.mutate({ token }); }} disabled={cancel.isPending} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-[#d7b8ae] px-5 text-[11px] font-extrabold uppercase tracking-[.1em] text-[#9a4e46] transition hover:bg-[#fff2f0] disabled:opacity-50"><XCircle size={15} /> {cancel.isPending ? "Cancelando..." : "Cancelar solicitação"}</button>{cancel.error && <p className="mt-3 text-xs text-red-700">{cancel.error.message}</p>}</div>}<p className="mt-7 flex items-center gap-2 text-[10px] text-[#8c7b70]"><LockKeyhole size={12} /> Este link é pessoal e exclusivo. Evite compartilhá-lo.</p></section><aside className="card-surface rounded-[30px] p-6"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#4d664d]"/><h2 className="display text-2xl">Atualizações</h2></div><div className="mt-6 space-y-5">{data.events.slice().reverse().map(event => <div key={`${event.eventType}-${event.createdAt}`} className="relative border-l border-[#e2d4c8] pb-1 pl-5"><span className="absolute -left-1 top-1 size-2 rounded-full bg-[#7d493a]" /><p className="text-xs font-extrabold">{event.description}</p><p className="mt-1 text-[10px] text-[#8a786d]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.createdAt))}</p></div>)}</div></aside></div></div>);
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#7d493a]"><Icon size={15} /></span><div><p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#89776b]">{label}</p><p className="mt-1 text-[11px] font-bold leading-5 text-[#534239]">{value}</p></div></div>; }
