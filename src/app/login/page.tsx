import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-soft px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M20.5 7.5 12 12 3.5 7.5M12 12v9M20.5 7.5v9L12 21l-8.5-4.5v-9L12 3l8.5 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">سامانه مدیریت دارایی</h1>
            <p className="mt-1 text-[12px] text-ink-soft">ورود به حساب کاربری</p>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-[11px] text-ink-faint">
          سامانه مدیریت دارایی سازمانی · نسخه ۱.۰
        </p>
      </div>
    </div>
  );
}
