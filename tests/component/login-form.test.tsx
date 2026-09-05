import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/app/login/login-form";

const apiMock = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth-store", () => ({
  useAuth: (sel: (s: { refresh: () => Promise<void> }) => unknown) =>
    sel({ refresh: async () => {} }),
}));
vi.mock("@/lib/api", () => apiMock);

describe("<LoginForm />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("فیلدها و دکمه ورود رندر می‌شوند", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("ایمیل یا شماره تماس")).toBeInTheDocument();
    expect(screen.getByLabelText("رمز عبور")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ورود" })).toBeInTheDocument();
  });

  it("خطای سرور (401) نمایش داده و payload درست ارسال می‌شود", async () => {
    apiMock.api.mockRejectedValue(
      Object.assign(new Error("شناسه یا رمز عبور اشتباه است"), { status: 401 }),
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("ایمیل یا شماره تماس"), {
      target: { value: "admin@ams.local" },
    });
    fireEvent.change(screen.getByLabelText("رمز عبور"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ورود" }));

    await waitFor(() => {
      expect(screen.getByText("شناسه یا رمز عبور اشتباه است")).toBeInTheDocument();
    });
    expect(apiMock.api).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      json: { identifier: "admin@ams.local", password: "wrong" },
    });
  });
});
