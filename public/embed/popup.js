(function() {
  'use strict';

  // JetMail Popup Form Widget
  window.JetMailPopup = window.JetMailPopup || {};

  const API_BASE = window.location.origin;
  const WIDGET_VERSION = '1.0.0';

  // Default configuration
  const DEFAULT_CONFIG = {
    trigger: 'time_delay',
    delay: 5000, // 5 seconds
    scrollPercentage: 50,
    frequency: 'once_per_session',
    deviceTargeting: 'all',
    showOnPages: [],
    hideOnPages: [],
    animation: 'fade',
    position: 'center',
    overlay: true,
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    closeButton: true,
    escapeKey: true,
    clickOutside: true,
    width: '400px',
    maxWidth: '90vw',
    borderRadius: '12px',
    zIndex: 10000,
  };

  // CSS styles for the popup
  const POPUP_STYLES = `
    .jetmail-popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    
    .jetmail-popup-overlay.show {
      opacity: 1;
      visibility: visible;
    }
    
    .jetmail-popup-container {
      position: relative;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
      transform: scale(0.9) translateY(20px);
      transition: transform 0.3s ease;
    }
    
    .jetmail-popup-overlay.show .jetmail-popup-container {
      transform: scale(1) translateY(0);
    }
    
    .jetmail-popup-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      transition: background-color 0.2s ease;
    }
    
    .jetmail-popup-close:hover {
      background: rgba(0, 0, 0, 0.2);
    }
    
    .jetmail-popup-close svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
    }
    
    .jetmail-popup-content {
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #374151;
    }
    
    .jetmail-popup-form {
      background: transparent;
      border: none;
      padding: 0;
      box-shadow: none;
    }
    
    .jetmail-popup-field {
      margin-bottom: 16px;
    }
    
    .jetmail-popup-label {
      display: block;
      font-weight: 500;
      margin-bottom: 4px;
      color: #374151;
    }
    
    .jetmail-popup-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    
    .jetmail-popup-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .jetmail-popup-input.error {
      border-color: #ef4444;
    }
    
    .jetmail-popup-button {
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
    
    .jetmail-popup-button:hover {
      background: #2563eb;
    }
    
    .jetmail-popup-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    
    .jetmail-popup-error {
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
    }
    
    .jetmail-popup-success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      padding: 16px;
      border-radius: 6px;
      text-align: center;
    }
    
    @media (max-width: 640px) {
      .jetmail-popup-container {
        margin: 16px;
        max-width: calc(100vw - 32px);
      }
      
      .jetmail-popup-content {
        padding: 20px;
      }
    }
    
    .jetmail-popup-fade-in {
      animation: jetmail-popup-fade-in 0.3s ease-in;
    }
    
    @keyframes jetmail-popup-fade-in {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `;

  // Utility functions
  function createElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
  }

  function getStorageKey(formId, type) {
    return `jetmail_popup_${formId}_${type}`;
  }

  function shouldShowPopup(formId, frequency) {
    const now = Date.now();
    
    switch (frequency) {
      case 'once_per_visitor':
        return !localStorage.getItem(getStorageKey(formId, 'shown'));
      
      case 'once_per_session':
        return !sessionStorage.getItem(getStorageKey(formId, 'shown'));
      
      case 'always':
      default:
        return true;
    }
  }

  function markPopupShown(formId, frequency) {
    const key = getStorageKey(formId, 'shown');
    const value = Date.now().toString();
    
    switch (frequency) {
      case 'once_per_visitor':
        localStorage.setItem(key, value);
        break;
      
      case 'once_per_session':
        sessionStorage.setItem(key, value);
        break;
    }
  }

  function matchesDevice(deviceTargeting) {
    if (deviceTargeting === 'all') return true;
    
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    
    switch (deviceTargeting) {
      case 'mobile':
        return isMobile && !isTablet;
      case 'tablet':
        return isTablet;
      case 'desktop':
        return !isMobile && !isTablet;
      default:
        return true;
    }
  }

  function matchesPage(showOnPages, hideOnPages) {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;
    
    // Check hide patterns first
    if (hideOnPages && hideOnPages.length > 0) {
      for (const pattern of hideOnPages) {
        if (currentPath.includes(pattern) || currentUrl.includes(pattern)) {
          return false;
        }
      }
    }
    
    // Check show patterns
    if (showOnPages && showOnPages.length > 0) {
      for (const pattern of showOnPages) {
        if (currentPath.includes(pattern) || currentUrl.includes(pattern)) {
          return true;
        }
      }
      return false; // If show patterns exist but none match
    }
    
    return true; // No restrictions
  }

  // Popup Widget Class
  class PopupWidget {
    constructor(formId, config = {}) {
      this.formId = formId;
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.popup = null;
      this.formData = null;
      this.isVisible = false;
      this.isSubmitting = false;
      this.triggers = [];
      
      this.init();
    }

    async init() {
      // Check if popup should be shown
      if (!shouldShowPopup(this.formId, this.config.frequency)) {
        return;
      }

      if (!matchesDevice(this.config.deviceTargeting)) {
        return;
      }

      if (!matchesPage(this.config.showOnPages, this.config.hideOnPages)) {
        return;
      }

      try {
        // Add styles
        this.addStyles();
        
        // Fetch form configuration
        await this.fetchFormData();
        
        // Set up triggers
        this.setupTriggers();
      } catch (error) {
        console.error('JetMail Popup: Failed to initialize', error);
      }
    }

    addStyles() {
      if (!document.getElementById('jetmail-popup-styles')) {
        const style = createElement('style');
        style.id = 'jetmail-popup-styles';
        style.textContent = POPUP_STYLES;
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

    setupTriggers() {
      const displayRules = this.formData.displayRules || this.config;
      
      switch (displayRules.trigger) {
        case 'immediate':
          this.showPopup();
          break;
          
        case 'time_delay':
          setTimeout(() => this.showPopup(), displayRules.delay || this.config.delay);
          break;
          
        case 'scroll':
          this.setupScrollTrigger(displayRules.scrollPercentage || this.config.scrollPercentage);
          break;
          
        case 'exit_intent':
          this.setupExitIntentTrigger();
          break;
      }
    }

    setupScrollTrigger(percentage) {
      const trigger = () => {
        const scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (scrolled >= percentage) {
          this.showPopup();
          window.removeEventListener('scroll', trigger);
        }
      };
      
      window.addEventListener('scroll', trigger);
      this.triggers.push(() => window.removeEventListener('scroll', trigger));
    }

    setupExitIntentTrigger() {
      let hasTriggered = false;
      
      const trigger = (e) => {
        if (hasTriggered) return;
        
        if (e.clientY <= 0) {
          hasTriggered = true;
          this.showPopup();
          document.removeEventListener('mouseleave', trigger);
        }
      };
      
      document.addEventListener('mouseleave', trigger);
      this.triggers.push(() => document.removeEventListener('mouseleave', trigger));
    }

    showPopup() {
      if (this.isVisible || !this.formData) return;
      
      this.createPopup();
      this.isVisible = true;
      
      // Track popup view
      this.trackEvent('view');
      
      // Mark as shown
      markPopupShown(this.formId, this.config.frequency);
      
      // Clean up triggers
      this.triggers.forEach(cleanup => cleanup());
      this.triggers = [];
    }

    createPopup() {
      const styling = this.formData.styling || {};
      
      // Create overlay
      const overlay = createElement('div', 'jetmail-popup-overlay');
      overlay.style.backgroundColor = this.config.overlayColor;
      overlay.style.zIndex = this.config.zIndex;
      
      // Create container
      const container = createElement('div', 'jetmail-popup-container');
      container.style.width = this.config.width;
      container.style.maxWidth = this.config.maxWidth;
      container.style.borderRadius = this.config.borderRadius;
      container.style.backgroundColor = styling.backgroundColor || '#ffffff';
      
      // Create close button
      if (this.config.closeButton) {
        const closeButton = createElement('button', 'jetmail-popup-close');
        closeButton.innerHTML = `
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        `;
        closeButton.addEventListener('click', () => this.hidePopup());
        container.appendChild(closeButton);
      }
      
      // Create content
      const content = createElement('div', 'jetmail-popup-content');
      content.innerHTML = this.renderForm();
      container.appendChild(content);
      
      overlay.appendChild(container);
      document.body.appendChild(overlay);
      
      this.popup = overlay;
      
      // Show with animation
      requestAnimationFrame(() => {
        overlay.classList.add('show');
      });
      
      // Set up event listeners
      this.setupEventListeners();
    }

    renderForm() {
      const styling = this.formData.styling || {};
      const settings = this.formData.settings || {};
      
      const formStyle = `
        color: ${styling.textColor || '#374151'};
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
        <form class="jetmail-popup-form" style="${formStyle}" id="jetmail-popup-form-${this.formId}">
          ${this.renderFields()}
          <button type="submit" class="jetmail-popup-button" style="${buttonStyle}">
            Subscribe
          </button>
        </form>
      `;

      // Add custom CSS if provided
      if (styling.customCss) {
        formHtml += `<style>${styling.customCss}</style>`;
      }

      return formHtml;
    }

    renderFields() {
      return this.formData.fields.map(field => {
        switch (field.type) {
          case 'email':
          case 'text':
            return `
              <div class="jetmail-popup-field">
                <label class="jetmail-popup-label" for="popup-${field.id}">
                  ${field.label}${field.required ? ' *' : ''}
                </label>
                <input
                  type="${field.type}"
                  id="popup-${field.id}"
                  name="${field.id}"
                  class="jetmail-popup-input"
                  placeholder="${field.placeholder || ''}"
                  ${field.required ? 'required' : ''}
                  ${field.defaultValue ? `value="${field.defaultValue}"` : ''}
                />
                <div class="jetmail-popup-error" id="popup-error-${field.id}"></div>
              </div>
            `;
          case 'checkbox':
            return `
              <div class="jetmail-popup-field">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                  <input
                    type="checkbox"
                    id="popup-${field.id}"
                    name="${field.id}"
                    ${field.required ? 'required' : ''}
                    ${field.defaultValue ? 'checked' : ''}
                    style="margin-top: 2px;"
                  />
                  <label class="jetmail-popup-label" for="popup-${field.id}" style="margin-bottom: 0;">
                    ${field.label}${field.required ? ' *' : ''}
                  </label>
                </div>
                <div class="jetmail-popup-error" id="popup-error-${field.id}"></div>
              </div>
            `;
          default:
            return '';
        }
      }).join('');
    }

    setupEventListeners() {
      const form = document.getElementById(`jetmail-popup-form-${this.formId}`);
      if (form) {
        form.addEventListener('submit', this.handleSubmit.bind(this));
      }
      
      // Close on escape key
      if (this.config.escapeKey) {
        document.addEventListener('keydown', this.handleKeydown.bind(this));
      }
      
      // Close on outside click
      if (this.config.clickOutside) {
        this.popup.addEventListener('click', this.handleOverlayClick.bind(this));
      }
    }

    handleKeydown(e) {
      if (e.key === 'Escape' && this.isVisible) {
        this.hidePopup();
      }
    }

    handleOverlayClick(e) {
      if (e.target === this.popup) {
        this.hidePopup();
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
        const error = this.validateField(field, value);
        
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
        console.error('JetMail Popup: Submission failed', error);
        this.showFieldError('submit', error.message || 'Something went wrong. Please try again.');
      } finally {
        this.isSubmitting = false;
      }
    }

    validateField(field, value) {
      if (field.required && (!value || value.trim() === '')) {
        return `${field.label} is required`;
      }

      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Please enter a valid email address';
      }

      return null;
    }

    async submitForm(data) {
      const response = await fetch(`${API_BASE}/api/forms/${this.formId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
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

    showSuccess() {
      const content = this.popup.querySelector('.jetmail-popup-content');
      const message = this.formData.settings?.thankYouMessage || 'Thank you for subscribing!';
      
      content.innerHTML = `
        <div class="jetmail-popup-success jetmail-popup-fade-in">
          <div style="margin-bottom: 16px;">
            <svg style="width: 48px; height: 48px; color: #10b981; margin: 0 auto; display: block;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; text-align: center;">Success!</h3>
          <p style="text-align: center;">${message}</p>
        </div>
      `;
      
      // Auto-close after 3 seconds
      setTimeout(() => this.hidePopup(), 3000);
    }

    clearErrors() {
      const errors = this.popup.querySelectorAll('.jetmail-popup-error');
      errors.forEach(error => error.textContent = '');
      
      const inputs = this.popup.querySelectorAll('.jetmail-popup-input');
      inputs.forEach(input => input.classList.remove('error'));
    }

    showFieldError(fieldId, message) {
      const errorElement = document.getElementById(`popup-error-${fieldId}`);
      const inputElement = document.getElementById(`popup-${fieldId}`);
      
      if (errorElement) {
        errorElement.textContent = message;
      }
      
      if (inputElement) {
        inputElement.classList.add('error');
      }
    }

    hidePopup() {
      if (!this.isVisible || !this.popup) return;
      
      this.popup.classList.remove('show');
      
      setTimeout(() => {
        if (this.popup && this.popup.parentNode) {
          this.popup.parentNode.removeChild(this.popup);
        }
        this.popup = null;
        this.isVisible = false;
      }, 300);
      
      // Remove event listeners
      document.removeEventListener('keydown', this.handleKeydown.bind(this));
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
  }

  // Auto-initialize popup from script tag
  function initializeFromScript() {
    const scripts = document.querySelectorAll('script[data-form-id]');
    scripts.forEach(script => {
      const formId = script.getAttribute('data-form-id');
      if (formId) {
        const config = {};
        
        // Parse configuration from data attributes
        Object.keys(script.dataset).forEach(key => {
          if (key !== 'formId') {
            config[key] = script.dataset[key];
          }
        });
        
        new PopupWidget(formId, config);
      }
    });
  }

  // Public API
  window.JetMailPopup = {
    version: WIDGET_VERSION,
    create: function(formId, config) {
      return new PopupWidget(formId, config);
    },
    init: initializeFromScript,
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFromScript);
  } else {
    initializeFromScript();
  }

})();