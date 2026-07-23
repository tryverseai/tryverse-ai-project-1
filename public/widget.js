/**
 * TryVerse Widget (iframe preview)
 * Embeddable AI try-on widget for e-commerce websites
 * Version 1.0.0
 *
 * The iframe loads your TryVerse app’s /widget-preview route (same UI as the hosted app).
 * Configure where that app is hosted:
 *   - Set window.TRYVERSE_APP_ORIGIN = 'https://tryverseai.com' before this script, or
 *   - Pass appOrigin in open({ ... }) / embed({ ... }), or
 *   - Host this script from the same origin as the app (uses script URL origin).
 * Default for local dev: http://localhost:8080
 */

(function() {
  'use strict';

  function resolveAppOrigin(config) {
    if (config && config.appOrigin) {
      return String(config.appOrigin).replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.TRYVERSE_APP_ORIGIN) {
      return String(window.TRYVERSE_APP_ORIGIN).replace(/\/$/, '');
    }
    try {
      var cur = document.currentScript;
      if (cur && cur.src) {
        return new URL(cur.src).origin;
      }
    } catch (e) { /* ignore */ }
    return 'http://localhost:8080';
  }

  const TryVerse = {
    config: {},
    
    /**
     * Open popup widget
     * @param {Object} options - Configuration options
     * @param {string} options.apiKey - TryVerse API key
     * @param {string} options.productImage - Product image URL
     * @param {string} options.productType - Product category (clothing/jewelry/glasses)
     */
    open: function(options) {
      if (!options.apiKey) {
        console.error('TryVerse: API key is required');
        return;
      }
      
      if (!options.productImage) {
        console.error('TryVerse: Product image is required');
        return;
      }
      
      this.config = options;
      this._createPopup();
    },
    
    /**
     * Embed widget in container
     * @param {Object} options - Configuration options
     * @param {string} options.container - Container element ID
     * @param {string} [options.appOrigin] - TryVerse app origin for the iframe (see open())
     */
    embed: function(options) {
      if (!options.apiKey) {
        console.error('TryVerse: API key is required');
        return;
      }
      
      if (!options.productImage) {
        console.error('TryVerse: Product image is required');
        return;
      }
      
      if (!options.container) {
        console.error('TryVerse: Container ID is required');
        return;
      }
      
      this.config = options;
      this._createEmbed();
    },
    
    _createPopup: function() {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'tryverse-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      `;
      
      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 0;
        max-width: 900px;
        width: 90%;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      `;
      
      // Create iframe
      const iframe = this._createIframe();
      iframe.style.cssText = `
        width: 100%;
        height: 600px;
        border: none;
        display: block;
      `;
      
      modal.appendChild(iframe);
      overlay.appendChild(modal);
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this._close();
        }
      });
      
      // Add CSS animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
    },
    
    _createEmbed: function() {
      const container = document.getElementById(this.config.container);
      if (!container) {
        console.error('TryVerse: Container not found');
        return;
      }
      
      const iframe = this._createIframe();
      iframe.style.cssText = `
        width: 100%;
        height: 600px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        display: block;
      `;
      
      container.innerHTML = '';
      container.appendChild(iframe);
    },
    
    _createIframe: function() {
      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({
        apiKey: this.config.apiKey,
        productImage: this.config.productImage,
        productType: this.config.productType || 'clothing',
        mode: 'widget'
      });
      var base = resolveAppOrigin(this.config);
      iframe.src = base + '/widget-preview?' + params.toString();
      iframe.allow = 'camera; microphone';
      
      return iframe;
    },
    
    _close: function() {
      const overlay = document.getElementById('tryverse-overlay');
      if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
          overlay.remove();
          document.body.style.overflow = '';
        }, 300);
      }
    }
  };
  
  // Expose to global scope
  window.TryVerse = TryVerse;
  
  // Auto-detect and enhance "Try It On" buttons
  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-tryverse]');
    buttons.forEach(button => {
      const apiKey = button.dataset.tryverseApiKey;
      const productImage = button.dataset.tryverseImage;
      const productType = button.dataset.tryverseType || 'clothing';
      
      if (apiKey && productImage) {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          TryVerse.open({ apiKey, productImage, productType });
        });
      }
    });
  });
  
})();
