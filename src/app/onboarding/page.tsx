'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
}

interface OnboardingStepProps {
  onNext: (data: Record<string, any>) => void;
  onPrevious: () => void;
  stepData: Record<string, any>;
  isLoading: boolean;
}

// Step Components
const CompanyInfoStep: React.FC<OnboardingStepProps> = ({ onNext, stepData, isLoading }) => {
  const [formData, setFormData] = useState({
    companyName: stepData.companyName || '',
    businessType: stepData.businessType || '',
    website: stepData.website || '',
    description: stepData.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Name</label>
        <input
          type="text"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Business Type</label>
        <select
          value={formData.businessType}
          onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Select business type</option>
          <option value="ecommerce">E-commerce</option>
          <option value="saas">SaaS</option>
          <option value="agency">Marketing Agency</option>
          <option value="nonprofit">Non-profit</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Website (Optional)</label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  );
};

const ProfileSetupStep: React.FC<OnboardingStepProps> = ({ onNext, stepData, isLoading }) => {
  const [formData, setFormData] = useState({
    firstName: stepData.firstName || '',
    lastName: stepData.lastName || '',
    phoneNumber: stepData.phoneNumber || '',
    timezone: stepData.timezone || 'UTC',
    language: stepData.language || 'en',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Phone Number</label>
        <input
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Timezone</label>
        <select
          value={formData.timezone}
          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  );
};

const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext, isLoading }) => {
  return (
    <div className="text-center space-y-6">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
        <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-900">Welcome to the Platform!</h3>
        <p className="mt-2 text-sm text-gray-600">
          Your account is now set up and ready to use. You can start exploring the features and capabilities.
        </p>
      </div>
      <button
        onClick={() => onNext({})}
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isLoading ? 'Completing...' : 'Get Started'}
      </button>
    </div>
  );
};

// Main Onboarding Component
export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(3);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const flowType = searchParams.get('flow') || 'USER_REGISTRATION';

  const getStepsForFlow = (flow: string): OnboardingStep[] => {
    switch (flow) {
      case 'ADMIN_SETUP':
        return [
          { id: 'company_info', title: 'Company Information', description: 'Set up your company profile', component: CompanyInfoStep },
          { id: 'profile_setup', title: 'Profile Setup', description: 'Complete your profile', component: ProfileSetupStep },
          { id: 'welcome', title: 'Welcome', description: 'You\'re all set!', component: WelcomeStep },
        ];
      case 'CUSTOMER_PACKAGE':
        return [
          { id: 'profile_setup', title: 'Profile Setup', description: 'Complete your profile', component: ProfileSetupStep },
          { id: 'welcome', title: 'Welcome', description: 'You\'re all set!', component: WelcomeStep },
        ];
      default:
        return [
          { id: 'profile_setup', title: 'Profile Setup', description: 'Complete your profile', component: ProfileSetupStep },
          { id: 'welcome', title: 'Welcome', description: 'You\'re all set!', component: WelcomeStep },
        ];
    }
  };

  const steps = getStepsForFlow(flowType);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    startOnboarding();
  }, [session, status, flowType]);

  const startOnboarding = async () => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowType }),
      });

      if (!response.ok) {
        throw new Error('Failed to start onboarding');
      }

      const data = await response.json();
      setOnboardingId(data.onboardingId);
      setCurrentStep(data.currentStep);
      setTotalSteps(data.totalSteps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding');
    }
  };

  const handleNext = async (data: Record<string, any>) => {
    if (!onboardingId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingId,
          stepData: data,
          moveToNext: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update onboarding step');
      }

      const result = await response.json();
      setStepData({ ...stepData, ...data });
      setCurrentStep(result.currentStep);

      if (result.isCompleted) {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update step');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Onboarding Error</h3>
            <p className="mt-1 text-sm text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep - 1];
  const StepComponent = currentStepData?.component;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{currentStepData?.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{currentStepData?.description}</p>
          </div>

          {StepComponent && (
            <StepComponent
              onNext={handleNext}
              onPrevious={handlePrevious}
              stepData={stepData}
              isLoading={isLoading}
            />
          )}

          {currentStep > 1 && (
            <button
              onClick={handlePrevious}
              disabled={isLoading}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Previous
            </button>
          )}
        </div>
      </div>
    </div>
  );
}