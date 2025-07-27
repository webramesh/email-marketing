(function() {
  'use strict';

  // JetMail Form Widget
  window.JetMailForm = window.JetMailForm || {};

  const API_BASE = window.location.origin;
  const WIDGET_VERSION = '1.0.0';

  // Default configuration
  const DEFAULT_CONFIG = {
    theme: 'light',
    width: '100%',
    height: 'auto',
    borderRadius: '8px',
    showPoweredBy: true,
    loadingText: 'Loading form...',
    successMessage: 'Thank you for subscribing!',
    errorMessage: 'Something went wrong. Please try again.',
    submitText: 'Subscribe',
    animation: 'fade',
    position: 'inline',
  };

  // CSS styles for the widget
  const WIDGET_STYLES = `
    .jetmail-form-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #374151;
      box-sizing: border-box;
    }
    
    .jetmail-form-container *, 
    .jetmail-form-container *::before, 
    .jetmail-form-container *::after {
      box-sizing: border-box;
    }
    
    .jetmail-form {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }
    
    .jetmail-form.loading {
      opacity: 0.6;
      pointer-events: none;
    }
    
    .jetmail-form-field {
      margin-bottom: 16px;
    }
    
    .jetmail-form-label {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
      color: #374151;
    }
    
    .jetmail-form-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    
    .jetmail-form-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .jetmail-form-input.error {
      border-color: #ef4444;
    }
    
    .jetmail-form-textarea {
      resize: vertical;
      min-height: 80px;
    }
    
    .jetmail-form-select {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 16px;
      padding-right: 40px;
    }
    
    .jetmail-form-checkbox-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    
    .jetmail-form-checkbox {
      width: 16px;
      height: 16px;
      margin: 0;
      flex-shrink: 0;
    }
    
    .jetmail-form-radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .jetmail-form-radio-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .jetmail-form-radio {
      width: 16px;
      height: 16px;
      margin: 0;
    }
    
    .jetmail-form-button {
      width: 100%;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    
    .jetmail-form-button:hover {
      background: #2563eb;
    }
    
    .jetmail-form-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    
    .jetmail-form-error {
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
    }
    
    .jetmail-form-success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      padding: 16px;
      border-radius: 6px;
      text-align: center;
    }
    
    .jetmail-form-powered-by {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: #6b7280;
    }
    
    .jetmail-form-powered-by a {
      color: #3b82f6;
      text-decoration: none;
    }
    
    .jetmail-form-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #6b7280;
    }
    
    .jetmail-form-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e5e7eb;
      border-top: 2px solid #3b82f6;
      border-radius: 50%;
      animation: jetmail-spin 1s linear infinite;
      margin-right: 8px;
    }
    
    @keyframes jetmail-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .jetmail-form-fade-in {
      animation: jetmail-fade-in 0.3s ease-in;
    }
    
    @keyframes jetmail-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  // Utility functions
  function createElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function validateField(field, value) {
    if (field.required && (!value || value.trim() === '')) {
      return `${field.label} is required`;
    }

    if (field.type === 'email' && value && !validateEmail(value)) {
      return 'Please enter a valid email address';
    }

    if (field.validation) {
      if (field.validation.minLength && value.length < field.validation.minLength) {
        return `${field.label} must be at least ${field.validation.minLength} characters`;
      }
      if (field.validation.maxLength && value.length > field.validation.maxLength) {
        return `${field.label} must be no more than ${field.validation.maxLength} characters`;
      }
      if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
        return `${field.label} format is invalid`;
      }
    }

    return null;
  }

  // Form Widget Class
  class FormWidget {
    constructor(containerId, formId, config = {}) {
      this.containerId = containerId;
      this.formId = formId;
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.container = null;
      this.formData = null;
      this.isSubmitting = false;
      
      this.init();
    }

    async init() {
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        console.error(`JetMail Form: Container with ID "${this.containerId}" not found`);
        return;
      }

      // Add styles
      this.addStyles();
      
      // Show loading state
      this.showLoading();
      
      try {
        // Fetch form configuration
        await this.fetchFormData();
        
        // Track form view
        this.trackEvent('view');
        
        // Render form
        this.render();
      } catch (error) {
        console.error('JetMail Form: Failed to load form', error);
        this.showError(this.config.errorMessage);
      }
    }

    addStyles() {
      if (!document.getElementById('jetmail-form-styles')) {
        const style = createElement('style');
        style.id = 'jetmail-form-styles';
        style.textContent = WIDGET_STYLES;
        document.head.appendChild(style);
      }
    }

    async fetchFormData() {
      const response = await fetch(`${API_BASE}/api/forms/${this.formId}/public`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.formData = await response.json();
    }

    showLoading() {
      this.container.innerHTML = `
        <div class="jetmail-form-container">
          <div class="jetmail-form-loading">
            <div class="jetmail-form-spinner"></div>
            ${this.config.loadingText}
          </div>
        </div>
      `;
    }

    showError(message) {
      this.container.innerHTML = `
        <div class="jetmail-form-container">
          <div class="jetmail-form-error" style="padding: 20px; text-align: center;">
            ${message}
          </div>
        </div>
      `;
    }

    showSuccess(message) {
      const successHtml = `
        <div class="jetmail-form-container">
          <div class="jetmail-form-success jetmail-form-fade-in">
            ${message || this.formData.settings?.thankYouMessage || this.config.successMessage}
          </div>
          ${this.config.showPoweredBy ? this.getPoweredByHtml() : ''}
        </div>
      `;
      this.container.innerHTML = successHtml;
    }

    render() {
      const styling = this.formData.styling || {};
      const settings = this.formData.settings || {};
      
      // Apply custom styling
      const formStyle = `
        background-color: ${styling.backgroundColor || '#ffffff'};
        color: ${styling.textColor || '#374151'};
        border-radius: ${styling.borderRadius || 8}px;
        font-family: ${styling.fontFamily || 'inherit'};
        font-size: ${styling.fontSize || 14}px;
      `;

      const buttonStyle = `
        background-color: ${styling.buttonStyle?.backgroundColor || '#3b82f6'};
        color: ${styling.buttonStyle?.textColor || '#ffffff'};
        border-radius: ${styling.buttonStyle?.borderRadius || 6}px;
        padding: ${styling.buttonStyle?.padding || '12px 24px'};
      `;

      let formHtml = `
        <div class="jetmail-form-container">
          <form class="jetmail-form jetmail-form-fade-in" style="${formStyle}" id="jetmail-form-${this.formId}">
            ${this.renderFields()}
            <button type="submit" class="jetmail-form-button" style="${buttonStyle}">
              ${this.config.submitText}
            </button>
          </form>
          ${this.config.showPoweredBy ? this.getPoweredByHtml() : ''}
        </div>
      `;

      // Add custom CSS if provided
      if (styling.customCss) {
        formHtml += `<style>${styling.customCss}</style>`;
      }

      this.container.innerHTML = formHtml;
      this.attachEventListeners();
    }

    renderFields() {
      return this.formData.fields.map(field => {
        switch (field.type) {
          case 'email':
          case 'text':
            return this.renderTextInput(field);
          case 'textarea':
            return this.renderTextarea(field);
          case 'select':
            return this.renderSelect(field);
          case 'checkbox':
            return this.renderCheckbox(field);
          case 'radio':
            return this.renderRadio(field);
          default:
            return '';
        }
      }).join('');
    }

    renderTextInput(field) {
      return `
        <div class="jetmail-form-field">
          <label class="jetmail-form-label" for="${field.id}">
            ${field.label}${field.required ? ' *' : ''}
          </label>
          <input
            type="${field.type}"
            id="${field.id}"
            name="${field.id}"
            class="jetmail-form-input"
            placeholder="${field.placeholder || ''}"
            ${field.required ? 'required' : ''}
            ${field.defaultValue ? `value="${field.defaultValue}"` : ''}
          />
          <div class="jetmail-form-error" id="error-${field.id}"></div>
        </div>
      `;
    }

    renderTextarea(field) {
      return `
        <div class="jetmail-form-field">
          <label class="jetmail-form-label" for="${field.id}">
            ${field.label}${field.required ? ' *' : ''}
          </label>
          <textarea
            id="${field.id}"
            name="${field.id}"
            class="jetmail-form-input jetmail-form-textarea"
            placeholder="${field.placeholder || ''}"
            ${field.required ? 'required' : ''}
          >${field.defaultValue || ''}</textarea>
          <div class="jetmail-form-error" id="error-${field.id}"></div>
        </div>
      `;
    }

    renderSelect(field) {
      const options = field.options || [];
      return `
        <div class="jetmail-form-field">
          <label class="jetmail-form-label" for="${field.id}">
            ${field.label}${field.required ? ' *' : ''}
          </label>
          <select
            id="${field.id}"
            name="${field.id}"
            class="jetmail-form-input jetmail-form-select"
            ${field.required ? 'required' : ''}
          >
            <option value="">${field.placeholder || 'Select an option'}</option>
            ${options.map(option => `<option value="${option}">${option}</option>`).join('')}
          </select>
          <div class="jetmail-form-error" id="error-${field.id}"></div>
        </div>
      `;
    }

    renderCheckbox(field) {
      return `
        <div class="jetmail-form-field">
          <div class="jetmail-form-checkbox-wrapper">
            <input
              type="checkbox"
              id="${field.id}"
              name="${field.id}"
              class="jetmail-form-checkbox"
              ${field.required ? 'required' : ''}
              ${field.defaultValue ? 'checked' : ''}
            />
            <label class="jetmail-form-label" for="${field.id}">
              ${field.label}${field.required ? ' *' : ''}
            </label>
          </div>
          <div class="jetmail-form-error" id="error-${field.id}"></div>
        </div>
      `;
    }

    renderRadio(field) {
      const options = field.options || [];
      return `
        <div class="jetmail-form-field">
          <div class="jetmail-form-label">
            ${field.label}${field.required ? ' *' : ''}
          </div>
          <div class="jetmail-form-radio-group">
            ${options.map((option, index) => `
              <div class="jetmail-form-radio-wrapper">
                <input
                  type="radio"
                  id="${field.id}-${index}"
                  name="${field.id}"
                  value="${option}"
                  class="jetmail-form-radio"
                  ${field.required ? 'required' : ''}
                  ${field.defaultValue === option ? 'checked' : ''}
                />
                <label for="${field.id}-${index}">${option}</label>
              </div>
            `).join('')}
          </div>
          <div class="jetmail-form-error" id="error-${field.id}"></div>
        </div>
      `;
    }

    attachEventListeners() {
      const form = document.getElementById(`jetmail-form-${this.formId}`);
      if (form) {
        form.addEventListener('submit', this.handleSubmit.bind(this));
      }
    }

    async handleSubmit(event) {
      event.preventDefault();
      
      if (this.isSubmitting) return;
      
      const form = event.target;
      const formData = new FormData(form);
      const data = {};
      
      // Clear previous errors
      this.clearErrors();
      
      // Validate and collect form data
      let hasErrors = false;
      for (const field of this.formData.fields) {
        const value = formData.get(field.id);
        const error = validateField(field, value);
        
        if (error) {
          this.showFieldError(field.id, error);
          hasErrors = true;
        } else {
          data[field.id] = value;
          
          // Map to standard fields
          if (field.type === 'email') {
            data.email = value;
          } else if (field.customField) {
            data.customFields = data.customFields || {};
            data.customFields[field.customField] = value;
          }
        }
      }
      
      if (hasErrors) return;
      
      // Submit form
      this.isSubmitting = true;
      form.classList.add('loading');
      
      try {
        await this.submitForm(data);
        this.trackEvent('submission', { email: data.email });
        
        // Handle redirect or show success message
        if (this.formData.settings?.redirectUrl) {
          window.location.href = this.formData.settings.redirectUrl;
        } else {
          this.showSuccess();
        }
      } catch (error) {
        console.error('JetMail Form: Submission failed', error);
        this.showFieldError('submit', error.message || this.config.errorMessage);
      } finally {
        this.isSubmitting = false;
        form.classList.remove('loading');
      }
    }

    async submitForm(data) {
      const response = await fetch(`${API_BASE}/api/forms/${this.formId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ipAddress: await this.getClientIP(),
          userAgent: navigator.userAgent,
          referrer: document.referrer,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Submission failed');
      }

      return response.json();
    }

    async getClientIP() {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
      } catch {
        return null;
      }
    }

    trackEvent(event, data = {}) {
      fetch(`${API_BASE}/api/forms/${this.formId}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          data: {
            ...data,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch(() => {
        // Ignore tracking errors
      });
    }

    clearErrors() {
      const errors = this.container.querySelectorAll('.jetmail-form-error');
      errors.forEach(error => error.textContent = '');
      
      const inputs = this.container.querySelectorAll('.jetmail-form-input');
      inputs.forEach(input => input.classList.remove('error'));
    }

    showFieldError(fieldId, message) {
      const errorElement = document.getElementById(`error-${fieldId}`);
      const inputElement = document.getElementById(fieldId);
      
      if (errorElement) {
        errorElement.textContent = message;
      }
      
      if (inputElement) {
        inputElement.classList.add('error');
      }
    }

    getPoweredByHtml() {
      return `
        <div class="jetmail-form-powered-by">
          Powered by <a href="https://jetmail.io" target="_blank">JetMail</a>
        </div>
      `;
    }
  }

  // Auto-initialize forms
  function initializeForms() {
    const formElements = document.querySelectorAll('[data-jetmail-form]');
    formElements.forEach(element => {
      const formId = element.getAttribute('data-jetmail-form');
      const config = {};
      
      // Parse configuration from data attributes
      Object.keys(element.dataset).forEach(key => {
        if (key.startsWith('jetmail')) {
          const configKey = key.replace('jetmail', '').toLowerCase();
          config[configKey] = element.dataset[key];
        }
      });
      
      new FormWidget(element.id, formId, config);
    });
  }

  // Public API
  window.JetMailForm = {
    version: WIDGET_VERSION,
    create: function(containerId, formId, config) {
      return new FormWidget(containerId, formId, config);
    },
    init: initializeForms,
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeForms);
  } else {
    initializeForms();
  }

})();