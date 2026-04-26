import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import AuthGate from '@/components/AuthGate';
import Login from '@/pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import Ponds from './pages/Ponds';
import Logs from './pages/Logs';
import Reports from './pages/Reports';
import Agencies from './pages/Agencies';
import Households from './pages/Households';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AuthGate />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/ponds" element={<Ponds />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/agencies" element={<Agencies />} />
                <Route path="/households" element={<Households />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
