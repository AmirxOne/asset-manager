"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const refresh = useAuth((s) => s.refresh);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", json: { identifier, password } });
      await refresh();
      router.replace(params.get("next") || "/dashboard");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "خطا در ورود";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-line bg-white p-6 shadow-sm">
      <label className="block text-[12px] font-medium" htmlFor="identifier">
        ایمیل یا شماره تماس
      </label>
           <input
        id="identifier"
        dir="ltr"
        autoComplete="username"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-left text-[13px] outline-none transition-colors focus:border-ink focus:shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
        placeholder="admin@ams.local"
      />

      <label className="mt-4 block text-[12px] font-medium" htmlFor="password">
        رمز عبور
      </label>
      <input
        id="password"
        dir="ltr"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-left text-[13px] outline-none transition-colors focus:border-ink focus:shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
        placeholder="••••••••"
      />

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>
      )}

      <Button type="submit" loading={loading} className="mt-5 h-11 w-full">
        ورود
      </Button>
    </form>
  );
}
