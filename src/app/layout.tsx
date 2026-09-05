import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ima Yoga Playlist Builder",
  description:
    "Design the energy of a class first, then build a coherent musical sequence around that arc.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("ima-yoga-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text">
        {children}
      </body>
    </html>
  );
}
