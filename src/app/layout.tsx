// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import "./globals.css";
// import { Toaster } from "@/components/ui/sonner";
// import { TRPCReactProvider } from "@/trpc/client";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; // 1. Import

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"]
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"]
// });

// export const metadata: Metadata = {
//   title: "Vibe",
//   description: "Build your next project with AI Agents"
// };

// export default function RootLayout({
//   children
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <TRPCReactProvider>
//       <html lang="en">
//         <body
//           className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//         >
//           <Toaster />
//           {children}
//           <ReactQueryDevtools initialIsOpen={false} /> {/* 2. Add component */}
//         </body>
//       </html>
//     </TRPCReactProvider>
//   );
// }

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Vibe",
  description: "Code Generation Agent"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* The provider MUST be inside the <body> tag */}
        <TRPCReactProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster />
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import "./globals.css";
// import { TRPCReactProvider } from "@/trpc/client";
// import { Toaster } from "@/components/ui/sonner";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"]
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"]
// });

// export const metadata: Metadata = {
//   title: "Vibe", // You can customize this
//   description: "Generated with Vibe"
// };

// export default function RootLayout({
//   children
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body
//         className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         {/* FIX: The provider MUST be inside the <body> tag */}
//         <TRPCReactProvider>
//           <Toaster />
//           {children}
//         </TRPCReactProvider>
//       </body>
//     </html>
//   );
// }
