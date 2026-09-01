import { APP } from "../lib/links";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 min-w-0 max-w-[1180px] items-center justify-between gap-3 px-5 sm:h-16 sm:px-8 lg:px-10">
        <a href="/" className="shrink-0">
          <img
            src="/logo-full.png"
            alt="Hedge"
            width={160}
            height={32}
            className="h-7 w-auto sm:h-8"
          />
        </a>
        <a
          href={APP}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:brightness-105 sm:px-5 sm:py-2 sm:text-sm"
        >
          Go to app
        </a>
      </div>
    </header>
  );
}
