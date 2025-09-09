
import '@/app/globals.css';


export default function HomepageV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Carrot - Sign In</title>
        <meta name="description" content="Sign in to Carrot to continue" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" sizes="48x48" type="image/png" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
