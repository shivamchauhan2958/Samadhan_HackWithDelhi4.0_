import type { Metadata, Viewport } from "next";
import { Yantramanav } from "next/font/google";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { LangProvider } from "@/components/lang-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// One family for Latin and Devanagari: a signage-grade grotesque with a Hindi companion.
const sans = Yantramanav({
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-yantra",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Samadhan | समाधान: Fix your street",
  description:
    "Samadhan is a civic issue reporting and resolution tracker for Ward 14. Report a pothole, garbage pile, dead light or water leak, watch it get assigned, tracked and fixed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint so the saved theme is already on <html>. Explicit choices set
// data-theme; System clears it and lets prefers-color-scheme drive the tokens.
const THEME_BOOT = `(function(){try{
var K='samadhan.theme.v2';var r=localStorage.getItem(K);
var c=(r==='light'||r==='dark'||r==='system')?r:'system';
var d=c==='dark'||(c==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var h=document.documentElement;
if(c==='light'||c==='dark'){h.setAttribute('data-theme',c);}else{h.removeAttribute('data-theme');}
h.style.colorScheme=d?'dark':'light';
var m=document.querySelector('meta[name="theme-color"]');
if(m){m.setAttribute('content',d?'#0d151c':'#eaeff3');}
}catch(e){}})();`;

// Arms the opening before the first paint, so a returning visitor in the same
// session never sees a flash of it.
const INTRO_BOOT = `(function(){try{
var K='samadhan.intro.seen.v3';
if(sessionStorage.getItem(K)==='1'){return;}
sessionStorage.setItem(K,'1');
document.documentElement.classList.add('intro-on');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--paper)] font-sans text-[var(--ink)] antialiased">
        <meta name="theme-color" content="#eaeff3" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT }} />
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>{children}</AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
