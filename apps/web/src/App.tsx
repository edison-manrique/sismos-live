import Header from './components/Header';
import MapPanel from './components/MapPanel';
import Sidebar from './components/Sidebar';
import Toasts from './components/Toasts';
import { AppProvider } from './state';
import styles from './App.module.css';

export default function App() {
  return (
    <AppProvider>
      <div class={styles.app}>
        <Header />
        <main class={styles.main}>
          <MapPanel />
          <Sidebar />
        </main>
        <Toasts />
      </div>
    </AppProvider>
  );
}
