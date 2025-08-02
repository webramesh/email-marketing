'use client';

import { useState } from 'react';

interface PackageAnalyticsProps {
  packageId: string;
  onClose: () => void;
}

export function PackageAnalytics({ packageId, onClose }: PackageAnalyticsProps) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Package Analytics</h2>
      <p className="text-gray-600 mb-4">Analytics for package: {packageId}</p>
      <p className="text-sm text-gray-500 mb-4">
        Detailed analytics coming soon. This feature is currently being developed.
      </p>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Close
      </button>
    </div>
  );
}