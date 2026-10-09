import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let pathname = "/";
let navegou = false; // o guard do onNavigate deixou a navegação seguir?
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: (p: any) => <img alt={p.alt} /> }));
// Link do Next: dispara onNavigate como o router faria, sem navegar de verdade.
vi.mock("next/link", () => ({
  default: ({ href, onNavigate, children, ...rest }: any) => (
    <a
      href={href}
      onClick={(e) => {
        onNavigate?.(e);
        navegou = !e.defaultPrevented;
        e.preventDefault(); // jsdom não navega
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { Header } from "./header";
import { useAppStore } from "@/lib/store";

const perfil = (p: "ADMIN" | "GESTOR" | "CONSULTA") =>
  useAppStore.setState({ userProfile: { id: "u1", nome: "Fulano Teste", email: "f@x.com", perfil: p } as any, navigationBlocked: false });

beforeEach(() => {
  pathname = "/";
  navegou = false;
});
afterEach(() => vi.restoreAllMocks());

describe("Header", () => {
  test("ADMIN vê a engrenagem de Configurações no menu central", () => {
    perfil("ADMIN");
    render(<Header />);
    const link = screen.getByRole("link", { name: "Configurações" });
    expect(link.getAttribute("href")).toBe("/configuracoes");
  });

  test.each(["GESTOR", "CONSULTA"] as const)("%s não vê Configurações", (p: "GESTOR" | "CONSULTA") => {
    perfil(p);
    render(<Header />);
    expect(screen.queryByRole("link", { name: "Configurações" })).toBeNull();
  });

  test("DARF aparece para todos os perfis", () => {
    perfil("CONSULTA");
    render(<Header />);
    expect(screen.getByRole("link", { name: /DARF/ }).getAttribute("href")).toBe("/darf");
  });

  test("com alterações pendentes, cancelar o aviso impede a navegação", () => {
    perfil("ADMIN");
    useAppStore.setState({ navigationBlocked: true });
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Header />);
    fireEvent.click(screen.getByRole("link", { name: "Configurações" }));
    expect(confirmar).toHaveBeenCalledWith("Você tem alterações não salvas. Sair mesmo assim?");
    expect(navegou).toBe(false);
  });

  test("confirmar o aviso deixa a navegação seguir", () => {
    perfil("ADMIN");
    useAppStore.setState({ navigationBlocked: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Header />);
    fireEvent.click(screen.getByRole("link", { name: "Configurações" }));
    expect(navegou).toBe(true);
  });

  test("sem alterações pendentes não pergunta nada", () => {
    perfil("ADMIN");
    const confirmar = vi.spyOn(window, "confirm");
    render(<Header />);
    fireEvent.click(screen.getByRole("link", { name: /DARF/ }));
    expect(confirmar).not.toHaveBeenCalled();
    expect(navegou).toBe(true);
  });
});
