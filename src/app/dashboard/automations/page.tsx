'use client';

import { Metadata } from 'next';
import { useRouter } from 'next/navigation';

export default function AutomationsPage() {
  const router = useRouter();

  const handleCreateAutomation = () => {
    // Navigate to automation creation page
    router.push('/dashboard/automations/create');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-gray-600">Create and manage automated email workflows</p>
        </div>
        <button 
          onClick={handleCreateAutomation}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Automation
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Your Automations</h2>
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No automations yet</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first automation workflow</p>
            <button 
              onClick={handleCreateAutomation}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Automation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}