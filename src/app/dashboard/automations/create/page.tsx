'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateAutomationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'subscriber_joins',
    status: 'draft'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement automation creation logic
    console.log('Creating automation:', formData);
    // For now, just navigate back to automations page
    router.push('/dashboard/automations');
  };

  const handleCancel = () => {
    router.push('/dashboard/automations');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Automation</h1>
          <p className="text-gray-600">Set up automated email workflows for your subscribers</p>
        </div>
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Automation Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter automation name"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe what this automation does"
            />
          </div>

          <div>
            <label htmlFor="trigger" className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Event
            </label>
            <select
              id="trigger"
              name="trigger"
              value={formData.trigger}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="subscriber_joins">When subscriber joins list</option>
              <option value="subscriber_clicks">When subscriber clicks link</option>
              <option value="subscriber_opens">When subscriber opens email</option>
              <option value="date_based">Date-based trigger</option>
              <option value="tag_added">When tag is added</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Automation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}