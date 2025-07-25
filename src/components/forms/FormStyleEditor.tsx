'use client';

import React from 'react';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormStyling } from '@/services/form.service';

interface FormStyleEditorProps {
  styling: FormStyling;
  onUpdate: (styling: FormStyling) => void;
}

export function FormStyleEditor({ styling, onUpdate }: FormStyleEditorProps) {
  const handleChange = (key: keyof FormStyling, value: any) => {
    onUpdate({ ...styling, [key]: value });
  };

  const handleButtonStyleChange = (key: string, value: any) => {
    onUpdate({
      ...styling,
      buttonStyle: { ...styling.buttonStyle, [key]: value },
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'light', label: 'Light', preview: 'bg-white border-secondary-200' },
              { id: 'dark', label: 'Dark', preview: 'bg-secondary-900 border-secondary-700' },
              { id: 'custom', label: 'Custom', preview: 'bg-gradient-to-r from-primary to-accent' },
            ].map(theme => (
              <button
                key={theme.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  styling.theme === theme.id
                    ? 'border-primary bg-primary-50'
                    : 'border-secondary-200 hover:border-secondary-300'
                }`}
                onClick={() => handleChange('theme', theme.id)}
              >
                <div className={`h-8 rounded mb-2 ${theme.preview}`}></div>
                <div className="text-sm font-medium">{theme.label}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Primary Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styling.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded border border-secondary-300"
                />
                <Input
                  value={styling.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  placeholder="#1E40AF"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Background Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styling.backgroundColor}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                  className="w-10 h-10 rounded border border-secondary-300"
                />
                <Input
                  value={styling.backgroundColor}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Text Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styling.textColor}
                  onChange={(e) => handleChange('textColor', e.target.value)}
                  className="w-10 h-10 rounded border border-secondary-300"
                />
                <Input
                  value={styling.textColor}
                  onChange={(e) => handleChange('textColor', e.target.value)}
                  placeholder="#374151"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Border Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styling.borderColor}
                  onChange={(e) => handleChange('borderColor', e.target.value)}
                  className="w-10 h-10 rounded border border-secondary-300"
                />
                <Input
                  value={styling.borderColor}
                  onChange={(e) => handleChange('borderColor', e.target.value)}
                  placeholder="#D1D5DB"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Font Family
              </label>
              <select
                value={styling.fontFamily}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
                className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Open Sans, sans-serif">Open Sans</option>
                <option value="Lato, sans-serif">Lato</option>
                <option value="Montserrat, sans-serif">Montserrat</option>
                <option value="Poppins, sans-serif">Poppins</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Times New Roman, serif">Times New Roman</option>
              </select>
            </div>

            <Input
              label="Font Size (px)"
              type="number"
              value={styling.fontSize}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              placeholder="14"
              min="10"
              max="24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            label="Border Radius (px)"
            type="number"
            value={styling.borderRadius}
            onChange={(e) => handleChange('borderRadius', parseInt(e.target.value))}
            placeholder="6"
            min="0"
            max="20"
          />
        </CardContent>
      </Card>

      {/* Button Style */}
      <Card>
        <CardHeader>
          <CardTitle>Button Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Button Background
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styling.buttonStyle.backgroundColor}
                  onChange={(e) => handleButtonStyleChange('backgroundColor', e.target.value)}
                  className="w-10 h-10 rounded border border-secondary-300"
                />
                <Input
                  value={styling.buttonStyle.backgroundColor}
                  onChange={(e) => handleButtonStyleChange('backgroundColor', e.target.value)}
                  placeholder="#1E40AF"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-secondary-700 mb-1 block">
                Button Text Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={styling.buttonStyle.textColor}
                  onChange={(e) => handleButtonStyleChange('textColor', e.target.value)}
                  className="w-10 h-10 rounded border border-secondary-300"
                />
                <Input
                  value={styling.buttonStyle.textColor}
                  onChange={(e) => handleButtonStyleChange('textColor', e.target.value)}
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            <Input
              label="Button Border Radius (px)"
              type="number"
              value={styling.buttonStyle.borderRadius}
              onChange={(e) => handleButtonStyleChange('borderRadius', parseInt(e.target.value))}
              placeholder="6"
              min="0"
              max="20"
            />

            <Input
              label="Button Padding"
              value={styling.buttonStyle.padding}
              onChange={(e) => handleButtonStyleChange('padding', e.target.value)}
              placeholder="12px 24px"
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom CSS */}
      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="text-sm font-medium text-secondary-700 mb-1 block">
              Additional CSS
            </label>
            <textarea
              value={styling.customCss || ''}
              onChange={(e) => handleChange('customCss', e.target.value)}
              placeholder="/* Add your custom CSS here */"
              className="w-full h-32 px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            />
            <p className="text-xs text-secondary-500 mt-1">
              Add custom CSS to further customize your form appearance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}