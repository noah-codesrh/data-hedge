import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { Nav } from "./components/Nav";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/logo-mark.svg", type: "image/svg+xml" },
  {
    rel: "preload",
    href: "/logo-full.png",
    as: "image",
  },
  {
    rel: "preload",
    href: "/assets/Font/Onest/Onest-VariableFont_wght.ttf",
    as: "font",
    type: "font/ttf",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Nav />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Error";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-sm">
      <h1 className="text-3xl font-bold text-white">{message}</h1>
      <p className="mt-2 text-muted">{details}</p>
      {stack ? (
        <pre className="mt-6 overflow-x-auto text-[11px] text-muted">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
