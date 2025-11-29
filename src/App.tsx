import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import PromptLibrary from './pages/PromptLibrary';
import PromptGenerator from './pages/PromptGenerator';
import TestingSandbox from './pages/TestingSandbox';
import Enterprise from './pages/Enterprise';
import Collaborate from './pages/Collaborate';
import Navigation, { PageType } from './components/Navigation';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'library':
        return <PromptLibrary />;
      case 'generator':
        return <PromptGenerator />;
      case 'sandbox':
        return <TestingSandbox />;
      case 'enterprise':
        return <Enterprise />;
      case 'collaborate':
        return <Collaborate />;
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

export default App;
