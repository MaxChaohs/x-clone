import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '@/styles/globals.css';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  return (
    <SessionProvider session={session}>
      <Head>
        <title>VAS - 社群網站</title>
        <meta name="description" content="VAS 社群網站" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}

