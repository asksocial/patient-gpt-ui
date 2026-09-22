import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "AskSocial",
  description: "From conversation to decision-ready healthcare intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
