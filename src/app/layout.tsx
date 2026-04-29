import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ChatWidget } from "@/components/chat/ChatWidget";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Avero GovTool — Government Proposal Intelligence",
  description: "AI-powered government proposal writing and intelligence for serious contractors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F5F5F7] text-gray-900">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
        <ChatWidget
          accentColor="#FF1A1A"
          title="Avero Assistant"
          subtitle="Ask about features, the workflow, or getting started"
          emptyText="Ask me anything about Avero GovTool — how it works, the free trial, or writing proposals."
        />
      </body>
    </html>
  );
}
