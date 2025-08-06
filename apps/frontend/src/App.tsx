import React from 'react';
import MetricsDashboard from './components/MetricsDashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                MaaS Platform - Policy Metrics
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Kuadrant Policy Enforcement Dashboard
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <MetricsDashboard />
      </main>
    </div>
  );
}

export default App;