'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormType } from '@/generated/prisma';

interface FormEmbedCodeProps {
  formId: string;
  formType: FormType;
  embedCode: string;
}

export function FormEmbedCode({ formId, formType, embedCode }: FormEmbedCodeProps) {
  const [activeTab, setActiveTab] = useState<'javascript' | 'iframe' | 'html'>('javascript');
  const [copied, setCopied] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  
  const embedCodes = {
    javascript: embedCode.replace(/\{\{FORM_ID\}\}/g, formId),
    iframe: `<iframe 
  src="${baseUrl}/forms/${formId}" 
  width="100%" 
  height="500" 
  frameborder="0"
  style="border: none; border-radius: 8px;">
</iframe>`,
    html: `<div id="jetmail-form-${formId}" data-jetmail-form="${formId}"></div>
<script src="${baseUrl}/embed/form.js"></script>`,
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getInstructions = () => {
    switch (activeTab) {
      case 'javascript':
        return {
          title: 'JavaScript Widget',
          description: 'Advanced embedding with full customization options',
          steps: [
            'Copy the code below and paste it into your website\'s HTML',
            'The form will automatically load and be styled according to your settings',
            'Customize appearance using data attributes or CSS',
            'The widget handles form submission and validation automatically',
          ],
          features: [
            'Responsive design',
            'Custom styling support',
            'Real-time validation',
            'Analytics tracking',
            'GDPR compliant',
          ],
        };
      case 'iframe':
        return {
          title: 'iFrame Embed',
          description: 'Simple embedding that works on any website',
          steps: [
            'Copy the iframe code below',
            'Paste it into your website where you want the form to appear',
            'Adjust width and height as needed',
            'The form will load in a secure iframe',
          ],
          features: [
            'Works on any platform',
            'Secure and isolated',
            'No JavaScript required',
            'Easy to implement',
          ],
        };
      case 'html':
        return {
          title: 'HTML Embed',
          description: 'Lightweight embedding with automatic initialization',
          steps: [
            'Add the HTML div element where you want the form',
            'Include the JavaScript file before closing </body> tag',
            'The form will automatically initialize on page load',
            'Customize using data attributes',
          ],
          features: [
            'Automatic initialization',
            'Minimal code required',
            'Fast loading',
            'SEO friendly',
          ],
        };
    }
  };

  const instructions = getInstructions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">Embed Your Form</h3>
        <p className="text-secondary-600">
          Choose an embedding method and copy the code to add this form to your website.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-secondary-100 p-1 rounded-lg">
        {[
          { id: 'javascript', label: 'JavaScript', icon: '⚡' },
          { id: 'iframe', label: 'iFrame', icon: '🖼️' },
          { id: 'html', label: 'HTML', icon: '📄' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-secondary-900 shadow-sm'
                : 'text-secondary-600 hover:text-secondary-900'
            }`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{instructions.title}</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(embedCodes[activeTab])}
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Code
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-600 mb-4">{instructions.description}</p>
            <div className="relative">
              <pre className="bg-secondary-900 text-secondary-100 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{embedCodes[activeTab]}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-secondary-900 mb-2">Steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-secondary-600">
                {instructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-secondary-900 mb-2">Features:</h4>
              <ul className="space-y-1">
                {instructions.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-secondary-600">
                    <svg className="h-4 w-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Options */}
      {activeTab === 'javascript' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advanced Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-secondary-900 mb-2">Customization Options:</h4>
                <div className="bg-secondary-50 p-4 rounded-lg">
                  <pre className="text-sm text-secondary-700">
{`<div 
  id="jetmail-form-${formId}" 
  data-jetmail-form="${formId}"
  data-jetmail-theme="light"
  data-jetmail-width="100%"
  data-jetmail-border-radius="8px"
  data-jetmail-show-powered-by="true">
</div>`}
                  </pre>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-secondary-900 mb-2">Available Data Attributes:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <code className="bg-secondary-100 px-2 py-1 rounded">data-jetmail-theme</code>
                    <p className="text-secondary-600 mt-1">Theme: light, dark, custom</p>
                  </div>
                  <div>
                    <code className="bg-secondary-100 px-2 py-1 rounded">data-jetmail-width</code>
                    <p className="text-secondary-600 mt-1">Form width: 100%, 400px, etc.</p>
                  </div>
                  <div>
                    <code className="bg-secondary-100 px-2 py-1 rounded">data-jetmail-border-radius</code>
                    <p className="text-secondary-600 mt-1">Border radius in pixels</p>
                  </div>
                  <div>
                    <code className="bg-secondary-100 px-2 py-1 rounded">data-jetmail-show-powered-by</code>
                    <p className="text-secondary-600 mt-1">Show/hide powered by link</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Your Form</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-secondary-600 mb-2">
                Preview your form as it will appear on your website
              </p>
              <p className="text-xs text-secondary-500">
                Direct link: {baseUrl}/forms/{formId}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(`${baseUrl}/forms/${formId}`, '_blank')}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform-Specific Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-secondary-200 rounded-lg">
              <h4 className="font-medium text-secondary-900 mb-2">WordPress</h4>
              <p className="text-sm text-secondary-600 mb-2">
                Add to any post or page using the HTML block
              </p>
              <p className="text-xs text-secondary-500">
                Recommended: JavaScript or HTML embed
              </p>
            </div>
            <div className="p-4 border border-secondary-200 rounded-lg">
              <h4 className="font-medium text-secondary-900 mb-2">Shopify</h4>
              <p className="text-sm text-secondary-600 mb-2">
                Add to product pages or theme templates
              </p>
              <p className="text-xs text-secondary-500">
                Recommended: iFrame embed
              </p>
            </div>
            <div className="p-4 border border-secondary-200 rounded-lg">
              <h4 className="font-medium text-secondary-900 mb-2">Custom HTML</h4>
              <p className="text-sm text-secondary-600 mb-2">
                Works with any website or landing page
              </p>
              <p className="text-xs text-secondary-500">
                Recommended: JavaScript embed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}