import type { Metadata } from "next";
import "./globals.css";
import { THEME_STORAGE_KEY } from "@/lib/theme";

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
    const storedTheme = localStorage.getItem("${THEME_STORAGE_KEY}");
    document.documentElement.classList.toggle("dark", storedTheme !== "light");
  } catch (error) {
    document.documentElement.classList.add("dark");
  }`;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
