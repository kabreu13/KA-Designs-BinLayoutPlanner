import { Header } from './components/Header';
import { Workspace } from './pages/Workspace';
import { LayoutProvider } from './context/LayoutContext';
import styles from './App.module.css';

export function App() {
  return (
    <LayoutProvider>
      <div className={styles.appRoot}>
        <Header />
        <main>
          <Workspace />
        </main>
      </div>
    </LayoutProvider>
  );
}
