import { Component, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AtlasPage } from './routes/index';
import { TietoPage } from './routes/tieto';
import './styles.css';
class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="p-10"><h1>Aineistoa ei saatu ladattua</h1><p>Tarkista verkkoyhteys ja lataa sivu uudelleen.</p><button onClick={() => location.reload()}>Yritä uudelleen</button></main>;
    return this.props.children;
  }
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
// The same bundle serves both readers: the built copy at /tieto/index.html mounts the
// article visualization, everything else keeps the atlas.
const Reader = location.pathname.replace(/\/+$/, '').endsWith('/tieto') ? TietoPage : AtlasPage;
createRoot(document.getElementById('root')!).render(
  <LoadBoundary><QueryClientProvider client={queryClient}><Suspense fallback={<p className="p-10" role="status">Ladataan Atlas-aineistoa…</p>}><Reader /></Suspense></QueryClientProvider></LoadBoundary>,
);
