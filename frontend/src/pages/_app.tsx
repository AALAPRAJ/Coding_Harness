import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Navbar } from '../components/Navbar';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Coding Harness - Autonomous AI Developer & Sandbox</title>
        <meta
          name="description"
          content="Autonomous software engineering platform that inspects code, plans edits, runs sandboxed commands, and generates tested Git diffs."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-dark-200 text-gray-100 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
