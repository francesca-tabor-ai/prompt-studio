import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import PromptLibrary from './pages/PromptLibrary';
import PromptGenerator from './pages/PromptGenerator';
import TestingSandbox from './pages/TestingSandbox';
import Enterprise from './pages/Enterprise';
import Collaborate from './pages/Collaborate';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import Navigation, { PageType } from './components/Navigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-light-sea-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <ProtectedRoute requiredPermission="analytics.read">
            <Dashboard />
          </ProtectedRoute>
        );
      case 'library':
        return (
          <ProtectedRoute requiredPermission="library.access">
            <PromptLibrary />
          </ProtectedRoute>
        );
      case 'generator':
        return (
          <ProtectedRoute requiredPermission="prompts.create">
            <PromptGenerator />
          </ProtectedRoute>
        );
      case 'sandbox':
        return (
          <ProtectedRoute requiredPermission="sandbox.access">
            <TestingSandbox />
          </ProtectedRoute>
        );
      case 'enterprise':
        return (
          <ProtectedRoute requiredPermission="enterprise.access">
            <Enterprise />
          </ProtectedRoute>
        );
      case 'collaborate':
        return (
          <ProtectedRoute requiredPermission="collaborate.submit">
            <Collaborate />
          </ProtectedRoute>
        );
      case 'admin':
        return (
          <ProtectedRoute requiredPermission="roles.manage">
            <Admin />
          </ProtectedRoute>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="ml-64 flex-1">
        {renderPage()}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
