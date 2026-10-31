import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CreateDrawPage } from './pages/CreateDrawPage';
import { DrawDetailPage } from './pages/DrawDetailPage';
import { PublicDrawPage } from './pages/PublicDrawPage';
import { LoginPage } from './pages/LoginPage';
import { Header } from './components/Header';
import { useDrawStore } from './store/drawStore';

function App() {
  const { checkAuth, isAuthenticated } = useDrawStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateDrawPage />} />
            <Route path="/draw/:id" element={<DrawDetailPage />} />
            <Route path="/public/:id" element={<PublicDrawPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
