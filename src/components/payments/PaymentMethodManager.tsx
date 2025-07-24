'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Form } from '@/components/ui/Form';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { Badge } from '@/components/ui/Badge';
import { 
  PaymentMethodData, 
  PaymentProviderType, 
  PaymentProviderConfig,
  PaymentProviderCapabilities
} from '@/types/payment';

interface PaymentMethodManagerProps {
  customerId: string;
  onPaymentMethodChange?: (paymentMethod: PaymentMethodData) => void;
}

export function PaymentMethodManager({ 
  customerId, 
  onPaymentMethodChange 
}: PaymentMethodManagerProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [providers, setProviders] = useState<PaymentProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>();
  const [providerCapabilities, setProviderCapabilities] = useState<PaymentProviderCapabilities | null>(null);
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadPaymentMethods();
    loadProviders();
  }, [customerId]);

  useEffect(() => {
    if (selectedProvider) {
      loadProviderCapabilities();
    }
  }, [selectedProvider]);

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch(`/api/payments?action=billing_profile&customerId=${customerId}`);
      const data = await response.json();
      
      if (response.ok && data.billingProfile) {
        setPaymentMethods(data.billingProfile.paymentMethods || []);
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      setError('Failed to load payment methods');
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/payments?action=providers');
      const data = await response.json();
      
      if (response.ok) {
        setProviders(data.providers);
        if (data.providers.length > 0) {
          setSelectedProvider(data.providers[0].type);
        }
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProviderCapabilities = async () => {
    if (!selectedProvider) return;
    
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_provider_capabilities',
          provider: selectedProvider
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProviderCapabilities(data.capabilities);
      }
    } catch (error) {
      console.error('Failed to load provider capabilities:', error);
    }
  };

  const validatePaymentMethodForm = (formData: any): string[] => {
    const errors: string[] = [];
    
    // Card number validation
    const cardNumber = formData.cardNumber?.replace(/\D/g, '');
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
      errors.push('Card number must be between 13 and 19 digits');
    }
    
    // Luhn algorithm check
    if (cardNumber && !isValidCardNumber(cardNumber)) {
      errors.push('Invalid card number');
    }
    
    // Expiry validation
    const month = parseInt(formData.expiryMonth);
    const year = parseInt(formData.expiryYear);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (month < 1 || month > 12) {
      errors.push('Invalid expiry month');
    }
    
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      errors.push('Card has expired');
    }
    
    // CVV validation
    const cvv = formData.cvv?.replace(/\D/g, '');
    if (!cvv || cvv.length < 3 || cvv.length > 4) {
      errors.push('CVV must be 3 or 4 digits');
    }
    
    // Cardholder name validation
    if (!formData.cardholderName || formData.cardholderName.trim().length < 2) {
      errors.push('Cardholder name is required');
    }
    
    return errors;
  };

  const isValidCardNumber = (cardNumber: string): boolean => {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  const getCardBrand = (cardNumber: string): string => {
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.match(/^4/)) return 'visa';
    if (digits.match(/^5[1-5]/) || digits.match(/^2[2-7]/)) return 'mastercard';
    if (digits.match(/^3[47]/)) return 'amex';
    if (digits.match(/^6(?:011|5)/)) return 'discover';
    if (digits.match(/^3[0689]/)) return 'diners';
    if (digits.match(/^35/)) return 'jcb';
    
    return 'unknown';
  };

  const handleAddPaymentMethod = async (formData: any) => {
    try {
      setLoading(true);
      setValidationErrors([]);
      setError(null);
      
      // Validate form data
      const errors = validatePaymentMethodForm(formData);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setLoading(false);
        return;
      }
      
      const cardNumber = formData.cardNumber?.replace(/\D/g, '');
      const brand = getCardBrand(cardNumber);
      
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_payment_method',
          customerId,
          provider: selectedProvider,
          paymentMethod: {
            type: 'card',
            last4: cardNumber?.slice(-4),
            brand,
            expiryMonth: parseInt(formData.expiryMonth),
            expiryYear: parseInt(formData.expiryYear),
            isDefault: paymentMethods.length === 0 // First method is default
          }
        })
      });

      const result = await response.json();

      if (response.ok) {
        await loadPaymentMethods();
        setIsAddingMethod(false);
        setValidationErrors([]);
        if (onPaymentMethodChange) {
          onPaymentMethodChange(result.paymentMethod);
        }
      } else {
        setError(result.error || 'Failed to add payment method');
      }
    } catch (error) {
      console.error('Failed to add payment method:', error);
      setError('Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_payment_method',
          paymentMethodId,
          provider: selectedProvider
        })
      });

      if (response.ok) {
        await loadPaymentMethods();
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to remove payment method');
      }
    } catch (error) {
      console.error('Failed to remove payment method:', error);
      setError('Failed to remove payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_default_payment_method',
          customerId,
          paymentMethodId,
          provider: selectedProvider
        })
      });

      if (response.ok) {
        await loadPaymentMethods();
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to set default payment method');
      }
    } catch (error) {
      console.error('Failed to set default payment method:', error);
      setError('Failed to set default payment method');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Payment Methods</h3>
          <Button onClick={() => setIsAddingMethod(true)}>
            Add Payment Method
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No payment methods added yet.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setIsAddingMethod(true)}
            >
              Add Your First Payment Method
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {method.brand?.toUpperCase() || method.type.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">
                      •••• •••• •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-500">
                      {method.expiryMonth}/{method.expiryYear}
                    </p>
                  </div>
                  {method.isDefault && (
                    <Badge variant="success">Default</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!method.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      Set Default
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemovePaymentMethod(method.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isAddingMethod}
        onClose={() => setIsAddingMethod(false)}
        title="Add Payment Method"
      >
        <Form
          onSubmit={handleAddPaymentMethod}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Payment Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as PaymentProviderType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {providers.map(provider => (
                <option key={provider.type} value={provider.type}>
                  {provider.name}
                </option>
              ))}
            </select>
            
            {providerCapabilities && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Provider Information</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>Supported currencies: {providerCapabilities.supportedCurrencies.join(', ')}</p>
                  <p>Processing fee: {providerCapabilities.processingFees.percentage}% + {providerCapabilities.processingFees.currency} {providerCapabilities.processingFees.fixed}</p>
                  <p>Amount limits: {providerCapabilities.minimumAmount} - {providerCapabilities.maximumAmount} {providerCapabilities.processingFees.currency}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {providerCapabilities.supportsSubscriptions && (
                      <Badge variant="success" className="text-xs">Subscriptions</Badge>
                    )}
                    {providerCapabilities.supportsRefunds && (
                      <Badge variant="success" className="text-xs">Refunds</Badge>
                    )}
                    {providerCapabilities.supportsDisputes && (
                      <Badge variant="success" className="text-xs">Disputes</Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Input
            label="Card Number"
            name="cardNumber"
            placeholder="1234 5678 9012 3456"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Expiry Month"
              name="expiryMonth"
              placeholder="MM"
              maxLength={2}
              required
            />
            <Input
              label="Expiry Year"
              name="expiryYear"
              placeholder="YYYY"
              maxLength={4}
              required
            />
          </div>

          <Input
            label="CVV"
            name="cvv"
            placeholder="123"
            maxLength={4}
            required
          />

          <Input
            label="Cardholder Name"
            name="cardholderName"
            placeholder="John Doe"
            required
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddingMethod(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Payment Method'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}