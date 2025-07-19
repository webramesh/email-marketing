'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
// Modal import removed as it's not used in this component;
import { Badge } from '@/components/ui/Badge';

// A/B Test interfaces
interface ABTestResults {
  testId: string;
  isComplete: boolean;
  hasWinner: boolean;
  winner?: {
    variantId: string;
    variantName: string;
    metric: number;
    improvement: number;
  };
  variants: Array<{
    variantId: string;
    variantName: string;
    totalSent: number;
    opens: number;
    clicks: number;
    conversions: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  }>;
  statisticalSignificance: {
    isSignificant: boolean;
    pValue: number;
    confidenceLevel: number;
    zScore: number;
  };
  recommendations: string[];
}

// Form validation schema
const abTestSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  variants: z
    .array(
      z.object({
        name: z.string().min(1, 'Variant name is required'),
        subject: z.string().min(1, 'Subject is required'),
        preheader: z.string().optional(),
        content: z.string().min(1, 'Content is required'),
        percentage: z.number().min(1).max(100),
      })
    )
    .min(2, 'At least 2 variants are required'),
  testDuration: z.number().min(1).optional(),
  winnerCriteria: z.enum(['open_rate', 'click_rate', 'conversion_rate']),
  confidenceLevel: z.number().min(0.8).max(0.99),
  minimumSampleSize: z.number().min(50).optional(),
});

type ABTestFormData = z.infer<typeof abTestSchema>;

interface ABTestManagerProps {
  campaignId: string;
  onClose?: () => void;
  onTestCreated?: (testId: string) => void;
}

export function ABTestManager({ campaignId, onClose, onTestCreated }: ABTestManagerProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'results'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ABTestResults | null>(null);

  const form = useForm<ABTestFormData>({
    resolver: zodResolver(abTestSchema),
    defaultValues: {
      testName: 'Subject Line Test',
      variants: [
        {
          name: 'Variant A',
          subject: '',
          preheader: '',
          content: '',
          percentage: 50,
        },
        {
          name: 'Variant B',
          subject: '',
          preheader: '',
          content: '',
          percentage: 50,
        },
      ],
      testDuration: 24,
      winnerCriteria: 'open_rate',
      confidenceLevel: 0.95,
      minimumSampleSize: 100,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'variants',
  });

  // Load existing test results if available
  useEffect(() => {
    loadTestResults();
  }, [campaignId]);

  const loadTestResults = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/ab-test`);
      const result = await response.json();

      if (result.success) {
        setTestResults(result.data);
        setActiveTab('results');
      }
    } catch (err) {
      // No existing test, stay on create tab
      console.log('No existing A/B test found');
    }
  };

  // Handle form submission
  const onSubmit = async (data: ABTestFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Validate percentages add up to 100
      const totalPercentage = data.variants.reduce((sum, variant) => sum + variant.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        setError('Variant percentages must add up to 100%');
        return;
      }

      const response = await fetch(`/api/campaigns/${campaignId}/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        onTestCreated?.(campaignId);
        await loadTestResults(); // Reload to show results
      } else {
        setError(result.error || 'Failed to create A/B test');
      }
    } catch (err) {
      setError('Failed to create A/B test');
      console.error('Error creating A/B test:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add new variant
  const addVariant = () => {
    const currentVariants = form.getValues('variants');
    const newPercentage = Math.floor(100 / (currentVariants.length + 1));

    // Adjust existing percentages
    const adjustedVariants = currentVariants.map(variant => ({
      ...variant,
      percentage: newPercentage,
    }));

    form.setValue('variants', adjustedVariants);

    append({
      name: `Variant ${String.fromCharCode(65 + currentVariants.length)}`,
      subject: '',
      preheader: '',
      content: '',
      percentage: newPercentage,
    });
  };

  // Remove variant
  const removeVariant = (index: number) => {
    if (fields.length <= 2) return; // Minimum 2 variants

    remove(index);

    // Redistribute percentages
    const remainingVariants = form.getValues('variants').filter((_, i) => i !== index);
    const newPercentage = Math.floor(100 / remainingVariants.length);

    remainingVariants.forEach((_, i) => {
      form.setValue(`variants.${i}.percentage`, newPercentage);
    });
  };

  // Auto-balance percentages
  const balancePercentages = () => {
    const variants = form.getValues('variants');
    const equalPercentage = Math.floor(100 / variants.length);
    const remainder = 100 - equalPercentage * variants.length;

    variants.forEach((_, index) => {
      const percentage = index === 0 ? equalPercentage + remainder : equalPercentage;
      form.setValue(`variants.${index}.percentage`, percentage);
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">A/B Test Manager</h2>
          <p className="text-gray-600">Create and manage A/B tests for your campaign</p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'create'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Create Test
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'results'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          disabled={!testResults}
        >
          Results{' '}
          {testResults && (
            <Badge variant="primary" className="ml-2">
              Live
            </Badge>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
          <Button variant="secondary" size="sm" onClick={() => setError(null)} className="mt-2">
            Dismiss
          </Button>
        </div>
      )}

      {/* Create Test Tab */}
      {activeTab === 'create' && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Test Configuration */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Test Name"
                {...form.register('testName')}
                error={form.formState.errors.testName?.message}
                placeholder="e.g., Subject Line Test"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Winner Criteria
                </label>
                <select
                  {...form.register('winnerCriteria')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open_rate">Open Rate</option>
                  <option value="click_rate">Click Rate</option>
                  <option value="conversion_rate">Conversion Rate</option>
                </select>
              </div>
              <Input
                label="Test Duration (hours)"
                type="number"
                {...form.register('testDuration', { valueAsNumber: true })}
                error={form.formState.errors.testDuration?.message}
                placeholder="24"
              />
              <Input
                label="Confidence Level"
                type="number"
                step="0.01"
                min="0.8"
                max="0.99"
                {...form.register('confidenceLevel', { valueAsNumber: true })}
                error={form.formState.errors.confidenceLevel?.message}
                placeholder="0.95"
              />
              <Input
                label="Minimum Sample Size"
                type="number"
                {...form.register('minimumSampleSize', { valueAsNumber: true })}
                error={form.formState.errors.minimumSampleSize?.message}
                placeholder="100"
              />
            </div>
          </Card>

          {/* Variants */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Test Variants</h3>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={balancePercentages}>
                  Balance %
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addVariant}
                  disabled={fields.length >= 5}
                >
                  Add Variant
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium text-gray-900">
                      {form.watch(`variants.${index}.name`)}
                    </h4>
                    {fields.length > 2 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => removeVariant(index)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Variant Name"
                      {...form.register(`variants.${index}.name`)}
                      error={form.formState.errors.variants?.[index]?.name?.message}
                    />
                    <Input
                      label="Traffic Percentage"
                      type="number"
                      min="1"
                      max="100"
                      {...form.register(`variants.${index}.percentage`, { valueAsNumber: true })}
                      error={form.formState.errors.variants?.[index]?.percentage?.message}
                    />
                    <Input
                      label="Subject Line"
                      {...form.register(`variants.${index}.subject`)}
                      error={form.formState.errors.variants?.[index]?.subject?.message}
                      className="md:col-span-2"
                    />
                    <Input
                      label="Preheader Text"
                      {...form.register(`variants.${index}.preheader`)}
                      error={form.formState.errors.variants?.[index]?.preheader?.message}
                      className="md:col-span-2"
                    />
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Content
                      </label>
                      <textarea
                        {...form.register(`variants.${index}.content`)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter email content for this variant..."
                      />
                      {form.formState.errors.variants?.[index]?.content && (
                        <p className="text-red-600 text-sm mt-1">
                          {form.formState.errors.variants[index]?.content?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Percentage Summary */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <div className="text-sm text-gray-600">
                Total Traffic:{' '}
                {form
                  .watch('variants')
                  .reduce((sum, variant) => sum + (variant.percentage || 0), 0)}
                %
              </div>
            </div>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Creating Test...' : 'Create A/B Test'}
            </Button>
          </div>
        </form>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && testResults && (
        <div className="space-y-6">
          {/* Test Status */}
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Test Status</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={testResults.isComplete ? 'success' : 'warning'}>
                    {testResults.isComplete ? 'Complete' : 'Running'}
                  </Badge>
                  {testResults.hasWinner && <Badge variant="success">Winner Declared</Badge>}
                </div>
              </div>
              {testResults.hasWinner && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">Winner</div>
                  <div className="font-semibold text-green-600">
                    {testResults.winner?.variantName}
                  </div>
                  <div className="text-sm text-gray-600">
                    +{testResults.winner?.improvement.toFixed(1)}% improvement
                  </div>
                </div>
              )}
            </div>

            {/* Statistical Significance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Statistical Significance:</span>
                <div
                  className={
                    testResults.statisticalSignificance.isSignificant
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }
                >
                  {testResults.statisticalSignificance.isSignificant
                    ? 'Significant'
                    : 'Not Significant'}
                </div>
              </div>
              <div>
                <span className="font-medium">P-Value:</span>
                <div>{testResults.statisticalSignificance.pValue.toFixed(4)}</div>
              </div>
              <div>
                <span className="font-medium">Confidence Level:</span>
                <div>{(testResults.statisticalSignificance.confidenceLevel * 100).toFixed(0)}%</div>
              </div>
            </div>
          </Card>

          {/* Variant Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testResults.variants.map((variant, index) => (
              <Card key={variant.variantId} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-semibold text-gray-900">{variant.variantName}</h4>
                  {testResults.winner?.variantId === variant.variantId && (
                    <Badge variant="success">Winner</Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Sent:</span>
                    <span className="font-medium">{variant.totalSent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Opens:</span>
                    <span className="font-medium">
                      {variant.opens.toLocaleString()} ({variant.openRate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Clicks:</span>
                    <span className="font-medium">
                      {variant.clicks.toLocaleString()} ({variant.clickRate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">
                      {variant.conversions?.toLocaleString() || 0} (
                      {variant.conversionRate.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Recommendations */}
          {testResults.recommendations.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
              <ul className="space-y-2">
                {testResults.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-gray-700">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
