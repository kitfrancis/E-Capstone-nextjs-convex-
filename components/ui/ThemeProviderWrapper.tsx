  "use client";

  import { ThemeProvider as NextThemesProvider } from "next-themes";
  import { ReactNode } from "react";

  export default function ThemeProviderWrapper({ children }: { children: ReactNode }) {
    return (
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange  nonce="">
        {children}
      </NextThemesProvider>
    );
  }