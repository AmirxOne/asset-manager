import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-center">
      <p className="text-6xl font-black text-paper-deep">۴۰۴</p>
      <p className="text-[14px] font-medium">صفحه مورد نظر پیدا نشد</p>
      <p className="text-[12px] text-ink-soft">آدرس را بررسی کنید یا به داشبورد برگردید</p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-10 items-center rounded-md bg-ink px-5 text-[13px] font-medium text-white hover:bg-[#2a2a2e]"
      >
        بازگشت به داشبورد
      </Link>
    </div>
  );
}
