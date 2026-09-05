import { cn } from "@/lib";

/**
 * صفحه اسکلت برای مسیرهایی که در فازهای ۲ تا ۱۰ کامل می‌شوند.
 * طراحی مطابق EmptyState کیت meetinghub — بدون 404.
 */
export function PlaceholderPage({
  title,
  subtitle,
  phase,
  icon,
}: {
  title: string;
  subtitle: string;
  phase: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p>
      </div>
      <div className="rounded-md border border-line bg-white">
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
          <div className="mb-1 text-ink-faint">
            {icon ?? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M12 12v9M12 12 4 7.5M12 12l8-4.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </div>
          <p className="text-[14px] font-medium">این بخش در فاز {phase} کامل می‌شود</p>
          <p className="max-w-sm text-[12px] text-ink-soft">{subtitle}</p>
          <span className={cn("badge badge-gray mt-2")}>فاز {phase}</span>
        </div>
      </div>
    </div>
  );
}
