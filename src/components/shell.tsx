"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { ROLE_LABELS, type StaffRole } from "@/lib/models";
import { useStaff } from "./auth-provider";
import { EmptyState } from "./ui";

type NavItem = { href: string; label: string; roles: StaffRole[] };

const NAV: { section: string; items: NavItem[] }[] = [
  { section: "", items: [{ href: "/", label: "Visão geral", roles: ["ADM", "MKT"] }] },
  {
    section: "Comunidade",
    items: [
      { href: "/denuncias", label: "Denúncias", roles: ["ADM"] },
      { href: "/skaters", label: "Skaters", roles: ["ADM"] },
    ],
  },
  {
    section: "Anúncios",
    items: [
      { href: "/anuncios", label: "Campanhas", roles: ["ADM", "MKT"] },
      { href: "/clientes", label: "Clientes", roles: ["ADM", "MKT"] },
      { href: "/posicoes", label: "Posições no app", roles: ["ADM"] },
    ],
  },
  {
    section: "Administração",
    items: [
      { href: "/equipe", label: "Equipe", roles: ["ADM"] },
      { href: "/chaves", label: "Chaves do app", roles: ["ADM"] },
      { href: "/atividade", label: "Atividade", roles: ["ADM"] },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const { staff } = useStaff();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-5" aria-label="Menu do painel">
      {NAV.map(({ section, items }) => {
        const visible = items.filter((item) => item.roles.includes(staff.rule));
        if (visible.length === 0) return null;
        return (
          <div key={section || "home"} className="flex flex-col gap-0.5">
            {section && <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{section}</p>}
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
      <div className="px-3">
        <p className="truncate font-semibold">{staff.name || staff.email}</p>
        <p className="text-xs text-muted">{ROLE_LABELS[staff.rule]}</p>
      </div>
      <Link href="/conta" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink">
        Minha conta
      </Link>
      <button onClick={() => signOut(auth)} className="rounded-lg px-3 py-2 text-left text-muted hover:bg-surface-2 hover:text-ink">
        Sair
      </button>
    </div>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2 px-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="size-8" />
      <span className="font-display text-xl">SkateGo</span>
      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted uppercase">painel</span>
    </Link>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between gap-6 overflow-y-auto border-r border-line bg-surface py-5 lg:flex">
        <div className="flex flex-col gap-6">
          {brand}
          <div className="px-2">{nav}</div>
        </div>
        <div className="px-2">{account}</div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        {brand}
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className="rounded-lg border border-line px-3 py-1.5 text-sm"
        >
          {menuOpen ? "Fechar" : "Menu"}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 top-[57px] bottom-0 z-20 flex flex-col justify-between gap-6 overflow-y-auto bg-surface p-4 lg:hidden">
          {nav}
          {account}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

/** Esconde a tela de quem não tem o papel (a API também confere). */
export function RequireRole({ roles, children }: { roles: StaffRole[]; children: ReactNode }) {
  const { can } = useStaff();
  if (!can(...roles)) {
    return <EmptyState title="Sem permissão" description="Essa área é só para administradores." />;
  }
  return children;
}
