import { Header } from './components/Header';
import { Workspace } from './pages/Workspace';
import { LayoutProvider } from './context/LayoutContext';

export function App() {
  return (
    <LayoutProvider>
      <div className="min-h-screen bg-[#F6F7F8] font-sans text-[#0B0B0C]">
        <Header />
        <main>
          <Workspace />
        </main>
      </div>
    </LayoutProvider>
  );
}
