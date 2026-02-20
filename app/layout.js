import "./globals.css";

export const metadata = {
  title: "Onramp Compatibility Tester",
  description: "Test Coinbase Onramp payment methods across browsers and devices",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
