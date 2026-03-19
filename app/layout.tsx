import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design System",
  description: "A clean, minimal design system with shadcn/ui and Central Control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeScript = `try {
    const storedPreference = localStorage.getItem("theme-preference");
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const shouldUseDark =
      storedPreference === "dark" ||
      (storedPreference !== "light" && storedPreference !== "system" && mediaQuery.matches) ||
      (storedPreference === "system" && mediaQuery.matches);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  } catch (error) {
    document.documentElement.classList.remove("dark");
  }`;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        {process.env.NODE_ENV === "development" && (
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" />
        )}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
