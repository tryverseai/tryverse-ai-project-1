/**
 * TryVerse AI Model Personalization Widget v1.0
 *
 * Lets shoppers upload a single photo and see themselves replacing the models
 * across a brand's product catalogue. Clothing, pose, lighting, and background
 * remain identical — only the model identity changes.
 *
 * BRAND INTEGRATION:
 * ------------------
 * 1. Add the script tag to your storefront:
 *
 *    <script src="https://tryverseai.com/tryverse-personalize.js"></script>
 *
 * 2. Initialise once per page (e.g. in your theme JS):
 *
 *    TryVersePersonalize.init({
 *      apiKey:     'YOUR_TRYVERSE_API_KEY',
 *      backendUrl: 'https://api.tryverseai.com', // optional
 *    });
 *
 * 3. Mark product images that should be personalized:
 *
 *    <img src="product.jpg"
 *         data-tv-personalize="true"
 *         data-tv-product-id="sku-123" />
 *
 *    // Or trigger programmatically for specific URLs:
 *    TryVersePersonalize.register(imageEl, { productId: 'sku-123' });
 *
 * SECURITY:
 * ---------
 * - All AI generation happens server-side; no API keys are exposed client-side
 * - Reference photos are stored server-side for 7 days then auto-deleted
 * - Sessions are anonymous — no shopper account required
 */
(function (global) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  var DEFAULT_BACKEND = 'https://api.tryverseai.com';
  var SESSION_KEY = 'tv_personalize_session';
  var MAX_FILE_MB = 8;

  var LOADING_MESSAGES = [
    'Creating your personalized storefront',
    'Matching products to your profile',
    'Building your custom shopping experience',
    'Preparing your personalized fashion preview',
    'Generating your model replacement',
    'Tailoring the collection to you',
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  var config = { apiKey: '', backendUrl: '' };
  var sessionId = null;
  var sessionExpiresAt = null;
  var personalizedImages = {}; // productId|url → resultUrl
  var registeredElements = []; // { el, productImageUrl, productId }
  var isPersonalized = false;
  var isOverlayOpen = false;
  var uploadEl = null;
  var overlayEl = null;
  var toggleBarEl = null;

  // ── Utilities ──────────────────────────────────────────────────────────────
  function log(msg) {
    if (global.console && console.log) console.log('[TryVerse]', msg);
  }

  function randomMsg() {
    return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
  }

  function apiUrl(path) {
    return (config.backendUrl || DEFAULT_BACKEND) + path;
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && s.sessionId && s.expiresAt && Date.now() < s.expiresAt) {
        sessionId = s.sessionId;
        sessionExpiresAt = s.expiresAt;
        if (s.images) personalizedImages = s.images;
        log('Session resumed: ' + sessionId.slice(0, 8) + '…');
      }
    } catch (e) { /* ignore */ }
  }

  function saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId: sessionId,
        expiresAt: sessionExpiresAt,
        images: personalizedImages,
      }));
    } catch (e) { /* ignore */ }
  }

  function clearSession() {
    sessionId = null;
    sessionExpiresAt = null;
    personalizedImages = {};
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────
  function createElement(tag, attrs, styles) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'textContent') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    if (styles) Object.keys(styles).forEach(function (k) { el.style[k] = styles[k]; });
    return el;
  }

  function appendStyles(css) {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Core CSS ───────────────────────────────────────────────────────────────
  function injectStyles() {
    appendStyles([
      /* Launcher button */
      '.tv-personalize-btn{position:fixed;bottom:24px;right:24px;z-index:2147483640;',
      'display:flex;align-items:center;gap:8px;padding:12px 20px;',
      'background:#000;color:#fff;border:none;border-radius:100px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'font-size:14px;font-weight:600;letter-spacing:-0.01em;',
      'cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.28);',
      'transition:transform .15s,box-shadow .15s,background .15s;}',
      '.tv-personalize-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.36);}',
      '.tv-personalize-btn.tv-active{background:#fff;color:#000;border:2px solid #000;}',
      '.tv-personalize-btn .tv-icon{width:20px;height:20px;flex-shrink:0;}',

      /* Overlay backdrop */
      '.tv-overlay{position:fixed;inset:0;z-index:2147483645;',
      'background:rgba(0,0,0,.72);backdrop-filter:blur(6px);',
      'display:flex;align-items:center;justify-content:center;',
      'opacity:0;pointer-events:none;transition:opacity .2s;}',
      '.tv-overlay.tv-visible{opacity:1;pointer-events:all;}',

      /* Upload card */
      '.tv-card{background:#fff;border-radius:20px;width:100%;max-width:420px;',
      'padding:32px;margin:16px;box-shadow:0 24px 80px rgba(0,0,0,.36);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'transform:translateY(16px);transition:transform .25s;}',
      '.tv-overlay.tv-visible .tv-card{transform:translateY(0);}',
      '.tv-card h2{font-size:20px;font-weight:700;margin:0 0 6px;color:#000;}',
      '.tv-card p{font-size:14px;color:#666;margin:0 0 24px;line-height:1.5;}',

      /* Drop zone */
      '.tv-dropzone{border:2px dashed #ddd;border-radius:12px;',
      'padding:32px 16px;text-align:center;cursor:pointer;',
      'transition:border-color .15s,background .15s;}',
      '.tv-dropzone:hover,.tv-dropzone.tv-drag{border-color:#000;background:#fafafa;}',
      '.tv-dropzone .tv-dz-icon{font-size:32px;margin-bottom:10px;}',
      '.tv-dropzone p{font-size:13px;color:#888;margin:0;}',
      '.tv-dropzone strong{color:#000;}',

      /* Preview */
      '.tv-preview{position:relative;border-radius:12px;overflow:hidden;',
      'background:#f5f5f5;aspect-ratio:1;margin-bottom:16px;}',
      '.tv-preview img{width:100%;height:100%;object-fit:cover;display:block;}',
      '.tv-preview-reset{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);',
      'color:#fff;border:none;border-radius:50%;width:28px;height:28px;',
      'font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',

      /* Progress bar */
      '.tv-progress{height:4px;background:#eee;border-radius:99px;overflow:hidden;margin-bottom:16px;}',
      '.tv-progress-bar{height:100%;background:#000;width:0%;transition:width .4s;}',

      /* Status text */
      '.tv-status-text{font-size:13px;color:#888;text-align:center;min-height:20px;',
      'margin-bottom:16px;transition:opacity .3s;}',

      /* Buttons */
      '.tv-btn{width:100%;padding:14px;border:none;border-radius:12px;',
      'font-size:15px;font-weight:600;cursor:pointer;transition:background .15s,opacity .15s;}',
      '.tv-btn-primary{background:#000;color:#fff;}',
      '.tv-btn-primary:hover{background:#222;}',
      '.tv-btn-primary:disabled{opacity:.45;cursor:not-allowed;}',
      '.tv-btn-secondary{background:#f0f0f0;color:#000;margin-top:8px;}',
      '.tv-btn-secondary:hover{background:#e5e5e5;}',

      /* Toggle bar */
      '.tv-toggle-bar{position:fixed;top:0;left:0;right:0;z-index:2147483641;',
      'background:#000;color:#fff;padding:10px 20px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      'font-size:13px;display:flex;align-items:center;justify-content:space-between;',
      'transform:translateY(-100%);transition:transform .25s;}',
      '.tv-toggle-bar.tv-visible{transform:translateY(0);}',
      '.tv-toggle-bar-left{display:flex;align-items:center;gap:10px;}',
      '.tv-avatar{width:28px;height:28px;border-radius:50%;',
      'object-fit:cover;border:2px solid rgba(255,255,255,.4);}',

      /* Toggle switch */
      '.tv-switch{display:flex;align-items:center;gap:8px;cursor:pointer;}',
      '.tv-switch-track{width:42px;height:24px;background:#444;border-radius:99px;',
      'position:relative;transition:background .2s;}',
      '.tv-switch-track.tv-on{background:#22c55e;}',
      '.tv-switch-thumb{width:18px;height:18px;background:#fff;border-radius:50%;',
      'position:absolute;top:3px;left:3px;transition:transform .2s;}',
      '.tv-switch-track.tv-on .tv-switch-thumb{transform:translateX(18px);}',
      '.tv-switch-label{font-size:12px;font-weight:500;}',

      /* Image loading overlay */
      '.tv-img-loading{position:absolute;inset:0;background:rgba(255,255,255,.9);',
      'display:flex;align-items:center;justify-content:center;border-radius:inherit;}',
      '.tv-img-loading .tv-spinner{width:28px;height:28px;border:3px solid #eee;',
      'border-top-color:#000;border-radius:50%;animation:tv-spin .7s linear infinite;}',
      '@keyframes tv-spin{to{transform:rotate(360deg)}}',

      /* Close button */
      '.tv-close{position:absolute;top:16px;right:16px;background:none;border:none;',
      'font-size:20px;cursor:pointer;color:#999;line-height:1;}',
      '.tv-close:hover{color:#000}',
    ].join(''));
  }

  // ── Upload overlay ─────────────────────────────────────────────────────────
  function buildOverlay() {
    if (overlayEl) return;
    overlayEl = createElement('div', { class: 'tv-overlay', role: 'dialog', 'aria-modal': 'true' });

    var card = createElement('div', { class: 'tv-card' });
    var closeBtn = createElement('button', { class: 'tv-close', 'aria-label': 'Close' }, null);
    closeBtn.textContent = '×';
    closeBtn.onclick = closeOverlay;

    var heading = createElement('h2', null, null);
    heading.textContent = 'See yourself as the model';
    var sub = createElement('p', null, null);
    sub.textContent = 'Upload a photo of yourself and we'll replace the models across this collection — same clothing, same styling, your face.';

    // Drop zone
    var dropzone = createElement('div', { class: 'tv-dropzone', tabindex: '0' });
    var dzIcon = createElement('div', { class: 'tv-dz-icon' });
    dzIcon.textContent = '🤳';
    var dzPrimary = createElement('p', null, null);
    dzPrimary.innerHTML = '<strong>Upload a selfie</strong> or drag & drop';
    var dzSub = createElement('p', null, null);
    dzSub.textContent = 'Portrait photo • front-facing • up to ' + MAX_FILE_MB + ' MB';
    dropzone.appendChild(dzIcon);
    dropzone.appendChild(dzPrimary);
    dropzone.appendChild(dzSub);

    // Hidden file input
    uploadEl = createElement('input', { type: 'file', accept: 'image/*', 'aria-label': 'Upload your photo' });
    uploadEl.style.display = 'none';

    // Preview container (hidden initially)
    var previewWrap = createElement('div', { class: 'tv-preview' });
    previewWrap.style.display = 'none';
    var previewImg = createElement('img', { alt: 'Your reference photo' });
    var resetBtn = createElement('button', { class: 'tv-preview-reset', 'aria-label': 'Remove photo' });
    resetBtn.textContent = '✕';
    previewWrap.appendChild(previewImg);
    previewWrap.appendChild(resetBtn);

    // Progress bar
    var progressWrap = createElement('div', { class: 'tv-progress' });
    var progressBar = createElement('div', { class: 'tv-progress-bar' });
    progressWrap.appendChild(progressBar);
    progressWrap.style.display = 'none';

    // Status text
    var statusText = createElement('div', { class: 'tv-status-text' });
    statusText.style.display = 'none';

    // CTA button
    var ctaBtn = createElement('button', { class: 'tv-btn tv-btn-primary', disabled: '' });
    ctaBtn.textContent = 'Personalize store';

    // Secondary — cancel
    var cancelBtn = createElement('button', { class: 'tv-btn tv-btn-secondary' });
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = closeOverlay;

    // Wire file selection
    function onFileSelected(file) {
      if (!file) return;
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert('Photo is too large. Please use an image under ' + MAX_FILE_MB + 'MB.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        previewImg.src = e.target.result;
        previewWrap.style.display = '';
        dropzone.style.display = 'none';
        ctaBtn.removeAttribute('disabled');
        ctaBtn._selectedFile = file;
      };
      reader.readAsDataURL(file);
    }

    dropzone.onclick = function () { uploadEl.click(); };
    dropzone.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') uploadEl.click(); };
    uploadEl.onchange = function (e) { onFileSelected(e.target.files[0]); };

    // Drag & drop
    dropzone.ondragover = function (e) { e.preventDefault(); dropzone.classList.add('tv-drag'); };
    dropzone.ondragleave = function () { dropzone.classList.remove('tv-drag'); };
    dropzone.ondrop = function (e) {
      e.preventDefault();
      dropzone.classList.remove('tv-drag');
      onFileSelected(e.dataTransfer.files[0]);
    };

    resetBtn.onclick = function () {
      previewWrap.style.display = 'none';
      dropzone.style.display = '';
      ctaBtn.setAttribute('disabled', '');
      ctaBtn._selectedFile = null;
      uploadEl.value = '';
    };

    // Submit
    ctaBtn.onclick = function () {
      var file = ctaBtn._selectedFile;
      if (!file) return;
      startPersonalization(file, {
        progressBar: progressBar,
        progressWrap: progressWrap,
        statusText: statusText,
        ctaBtn: ctaBtn,
        cancelBtn: cancelBtn,
      });
    };

    card.appendChild(closeBtn);
    card.appendChild(heading);
    card.appendChild(sub);
    card.appendChild(uploadEl);
    card.appendChild(dropzone);
    card.appendChild(previewWrap);
    card.appendChild(progressWrap);
    card.appendChild(statusText);
    card.appendChild(ctaBtn);
    card.appendChild(cancelBtn);
    overlayEl.appendChild(card);
    document.body.appendChild(overlayEl);

    // Close on backdrop click
    overlayEl.onclick = function (e) { if (e.target === overlayEl) closeOverlay(); };
  }

  function openOverlay() {
    if (!overlayEl) buildOverlay();
    overlayEl.classList.add('tv-visible');
    isOverlayOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    if (overlayEl) overlayEl.classList.remove('tv-visible');
    isOverlayOpen = false;
    document.body.style.overflow = '';
  }

  // ── Toggle bar ─────────────────────────────────────────────────────────────
  function buildToggleBar(referencePreviewUrl) {
    if (toggleBarEl) {
      toggleBarEl.remove();
      toggleBarEl = null;
    }
    toggleBarEl = createElement('div', { class: 'tv-toggle-bar', role: 'status' });

    var left = createElement('div', { class: 'tv-toggle-bar-left' });
    if (referencePreviewUrl) {
      var avatar = createElement('img', { src: referencePreviewUrl, class: 'tv-avatar', alt: 'You' });
      left.appendChild(avatar);
    }
    var label = createElement('span', null, null);
    label.textContent = 'Personalized for you';
    left.appendChild(label);

    // Switch
    var switchEl = createElement('label', { class: 'tv-switch', 'aria-label': 'Toggle personalization' });
    var track = createElement('div', { class: 'tv-switch-track tv-on' });
    var thumb = createElement('div', { class: 'tv-switch-thumb' });
    var switchLabel = createElement('span', { class: 'tv-switch-label' });
    switchLabel.textContent = 'You';
    track.appendChild(thumb);
    switchEl.appendChild(track);
    switchEl.appendChild(switchLabel);
    switchEl.onclick = function () { togglePersonalization(!isPersonalized); };

    // Change photo button
    var changeBtn = createElement('button', null, {
      background: 'none', border: '1px solid rgba(255,255,255,.35)',
      color: '#fff', borderRadius: '6px', padding: '4px 10px',
      fontSize: '12px', cursor: 'pointer', marginLeft: '12px',
    });
    changeBtn.textContent = 'Change photo';
    changeBtn.onclick = openOverlay;

    // Remove button
    var removeBtn = createElement('button', null, {
      background: 'none', border: 'none',
      color: 'rgba(255,255,255,.55)', fontSize: '12px', cursor: 'pointer', marginLeft: '8px',
    });
    removeBtn.textContent = '✕ Remove';
    removeBtn.onclick = resetSession;

    toggleBarEl.appendChild(left);
    var right = createElement('div', { style: 'display:flex;align-items:center;' });
    right.appendChild(switchEl);
    right.appendChild(changeBtn);
    right.appendChild(removeBtn);
    toggleBarEl.appendChild(right);

    document.body.prepend(toggleBarEl);
    // Shift page content to avoid overlap
    document.documentElement.style.marginTop = '48px';

    requestAnimationFrame(function () {
      toggleBarEl.classList.add('tv-visible');
    });
  }

  function removeToggleBar() {
    if (toggleBarEl) {
      toggleBarEl.remove();
      toggleBarEl = null;
    }
    document.documentElement.style.marginTop = '';
  }

  // ── Launcher button ────────────────────────────────────────────────────────
  function buildLauncherButton() {
    var btn = createElement('button', { class: 'tv-personalize-btn', 'aria-label': 'Personalize store' });
    var svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('class', 'tv-icon');
    svgIcon.setAttribute('viewBox', '0 0 24 24');
    svgIcon.setAttribute('fill', 'currentColor');
    svgIcon.innerHTML = '<path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z"/>';
    var text = document.createTextNode('See yourself as the model');
    btn.appendChild(svgIcon);
    btn.appendChild(text);
    btn.onclick = function () {
      if (sessionId) {
        // Already has a session — open toggle instead
        openOverlay();
      } else {
        openOverlay();
      }
    };
    document.body.appendChild(btn);
    return btn;
  }

  // ── Personalization flow ───────────────────────────────────────────────────
  function startPersonalization(file, ui) {
    ui.ctaBtn.setAttribute('disabled', '');
    ui.progressWrap.style.display = '';
    ui.statusText.style.display = '';
    ui.progressBar.style.width = '10%';

    var msgInterval = setInterval(function () {
      ui.statusText.textContent = randomMsg() + '…';
    }, 2200);
    ui.statusText.textContent = randomMsg() + '…';

    function finish(ok) {
      clearInterval(msgInterval);
      ui.progressBar.style.width = ok ? '100%' : '0%';
      setTimeout(function () {
        ui.progressWrap.style.display = 'none';
        ui.statusText.style.display = 'none';
      }, 600);
    }

    // 1. Upload reference photo
    var formData = new FormData();
    formData.append('reference', file);

    ui.progressBar.style.width = '25%';

    fetch(apiUrl('/api/personalize/session'), {
      method: 'POST',
      headers: { 'x-api-key': config.apiKey },
      body: formData,
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Upload failed'); });
        return r.json();
      })
      .then(function (data) {
        sessionId = data.sessionId;
        sessionExpiresAt = data.expiresAt;
        saveSession();
        ui.progressBar.style.width = '55%';

        // Get a local preview URL for the toggle bar avatar
        var previewUrl = URL.createObjectURL(file);

        // 2. Start replacing visible product images
        return personalizeVisibleImages(ui.progressBar).then(function () {
          finish(true);
          isPersonalized = true;
          closeOverlay();
          buildToggleBar(previewUrl);

          // Update launcher button state
          var launcherBtn = document.querySelector('.tv-personalize-btn');
          if (launcherBtn) launcherBtn.classList.add('tv-active');
        });
      })
      .catch(function (err) {
        log('Personalization error: ' + err.message);
        finish(false);
        ui.ctaBtn.removeAttribute('disabled');
        ui.statusText.style.display = '';
        ui.statusText.textContent = 'Something went wrong. Please try again.';
      });
  }

  /** Iterate all registered elements in the viewport first, then the rest. */
  function personalizeVisibleImages(progressBar) {
    if (!registeredElements.length) return Promise.resolve();

    var viewportEl = registeredElements.filter(function (item) {
      var rect = item.el.getBoundingClientRect();
      return rect.top < window.innerHeight * 2;
    });

    var queue = viewportEl.length ? viewportEl : registeredElements.slice(0, 4);
    var done = 0;
    var total = queue.length;

    return queue.reduce(function (promise, item) {
      return promise.then(function () {
        return personalizeImage(item).then(function () {
          done++;
          var pct = 55 + Math.round((done / total) * 40);
          if (progressBar) progressBar.style.width = pct + '%';
        }).catch(function (err) {
          log('Failed to personalize image: ' + err.message);
        });
      });
    }, Promise.resolve());
  }

  function personalizeImage(item) {
    var cacheKey = item.productId || item.productImageUrl;
    if (personalizedImages[cacheKey]) {
      swapImage(item.el, personalizedImages[cacheKey]);
      return Promise.resolve();
    }

    // Show loading spinner over the image
    showImageLoadingState(item.el);

    return fetch(apiUrl('/api/personalize/generate'), {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionId,
        productImageUrl: item.productImageUrl,
        productId: item.productId || null,
      }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Generation failed'); });
        return r.json();
      })
      .then(function (data) {
        if (data.resultUrl) {
          personalizedImages[cacheKey] = data.resultUrl;
          saveSession();
          swapImage(item.el, data.resultUrl);
        }
        hideImageLoadingState(item.el);
      })
      .catch(function (err) {
        hideImageLoadingState(item.el);
        throw err;
      });
  }

  function swapImage(imgEl, newSrc) {
    if (!imgEl) return;
    imgEl.setAttribute('data-tv-original-src', imgEl.getAttribute('data-tv-original-src') || imgEl.src);
    imgEl.src = newSrc;
    imgEl.setAttribute('data-tv-personalized', 'true');
  }

  function restoreImage(imgEl) {
    var original = imgEl.getAttribute('data-tv-original-src');
    if (original) {
      imgEl.src = original;
      imgEl.removeAttribute('data-tv-personalized');
    }
  }

  // Loading spinner overlay on a specific image
  function showImageLoadingState(imgEl) {
    var parent = imgEl.parentElement;
    if (!parent || parent.querySelector('.tv-img-loading')) return;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    var overlay = createElement('div', { class: 'tv-img-loading' });
    var spinner = createElement('div', { class: 'tv-spinner' });
    overlay.appendChild(spinner);
    parent.appendChild(overlay);
  }

  function hideImageLoadingState(imgEl) {
    var parent = imgEl.parentElement;
    if (!parent) return;
    var overlay = parent.querySelector('.tv-img-loading');
    if (overlay) overlay.remove();
  }

  // ── Toggle personalization on/off ──────────────────────────────────────────
  function togglePersonalization(on) {
    isPersonalized = on;
    registeredElements.forEach(function (item) {
      if (on) {
        var cacheKey = item.productId || item.productImageUrl;
        var cached = personalizedImages[cacheKey];
        if (cached) {
          swapImage(item.el, cached);
        } else if (sessionId) {
          personalizeImage(item).catch(function (err) { log('Toggle personalize error: ' + err.message); });
        }
      } else {
        restoreImage(item.el);
      }
    });

    // Update toggle bar switch
    var track = toggleBarEl && toggleBarEl.querySelector('.tv-switch-track');
    var label = toggleBarEl && toggleBarEl.querySelector('.tv-switch-label');
    if (track) {
      if (on) track.classList.add('tv-on');
      else track.classList.remove('tv-on');
    }
    if (label) label.textContent = on ? 'You' : 'Original';
  }

  function resetSession() {
    if (sessionId) {
      // Fire and forget — revoke session server-side
      fetch(apiUrl('/api/personalize/session/' + sessionId), {
        method: 'DELETE',
        headers: { 'x-api-key': config.apiKey },
      }).catch(function () { /* non-critical */ });
    }

    // Restore all original images
    registeredElements.forEach(function (item) { restoreImage(item.el); });

    clearSession();
    removeToggleBar();
    isPersonalized = false;

    var launcherBtn = document.querySelector('.tv-personalize-btn');
    if (launcherBtn) launcherBtn.classList.remove('tv-active');

    log('Session reset');
  }

  // ── Auto-discovery of marked images ───────────────────────────────────────
  function discoverImages() {
    var images = document.querySelectorAll('[data-tv-personalize="true"]');
    images.forEach(function (imgEl) {
      if (imgEl.tagName !== 'IMG') return;
      var productId = imgEl.getAttribute('data-tv-product-id') || null;
      var alreadyRegistered = registeredElements.some(function (i) { return i.el === imgEl; });
      if (!alreadyRegistered) {
        registeredElements.push({
          el: imgEl,
          productImageUrl: imgEl.src || imgEl.getAttribute('data-src') || '',
          productId: productId,
        });
      }
    });
  }

  // Re-run discovery when DOM changes (SPAs)
  function watchDom() {
    if (typeof MutationObserver === 'undefined') return;
    var observer = new MutationObserver(function () {
      discoverImages();
      // If personalized, auto-swap newly added images
      if (isPersonalized && sessionId) {
        registeredElements.forEach(function (item) {
          if (!item.el.getAttribute('data-tv-personalized')) {
            var cacheKey = item.productId || item.productImageUrl;
            if (personalizedImages[cacheKey]) {
              swapImage(item.el, personalizedImages[cacheKey]);
            } else {
              personalizeImage(item).catch(function () { /* non-critical */ });
            }
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Intersection observer — on-demand generation ──────────────────────────
  function watchViewport() {
    if (typeof IntersectionObserver === 'undefined') return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || !isPersonalized || !sessionId) return;
        var imgEl = entry.target;
        if (imgEl.getAttribute('data-tv-personalized')) return;
        var item = registeredElements.find(function (i) { return i.el === imgEl; });
        if (item) {
          personalizeImage(item).catch(function () { /* non-critical */ });
        }
      });
    }, { rootMargin: '200px' });

    function registerObserved() {
      registeredElements.forEach(function (item) {
        io.observe(item.el);
      });
    }
    registerObserved();
    // Re-register when new images are added
    var origDiscover = discoverImages;
    discoverImages = function () { origDiscover(); registerObserved(); };
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  var TryVersePersonalize = {
    /**
     * Initialize the personalization widget.
     * Must be called once with your API key.
     */
    init: function (options) {
      if (!options || !options.apiKey) {
        log('init() requires apiKey');
        return;
      }
      config.apiKey = options.apiKey;
      config.backendUrl = (options.backendUrl || DEFAULT_BACKEND).replace(/\/$/, '');

      injectStyles();
      loadSession();
      discoverImages();
      watchDom();
      watchViewport();
      buildLauncherButton();

      // If we have a valid session, restore personalized state
      if (sessionId) {
        buildToggleBar(null);
        isPersonalized = true;
        registeredElements.forEach(function (item) {
          var cacheKey = item.productId || item.productImageUrl;
          var cached = personalizedImages[cacheKey];
          if (cached) swapImage(item.el, cached);
          else personalizeImage(item).catch(function () { /* non-critical */ });
        });
      }

      log('Initialized for ' + registeredElements.length + ' product image(s)');
    },

    /**
     * Programmatically register an image element for personalization.
     */
    register: function (imgEl, options) {
      if (!imgEl) return;
      options = options || {};
      registeredElements.push({
        el: imgEl,
        productImageUrl: options.productImageUrl || imgEl.src || '',
        productId: options.productId || null,
      });
    },

    /** Open the upload modal. */
    open: openOverlay,

    /** Toggle between original and personalized. */
    toggle: togglePersonalization,

    /** Remove session and restore original images. */
    reset: resetSession,

    /** Current session ID (null if not personalized). */
    getSessionId: function () { return sessionId; },
  };

  global.TryVersePersonalize = TryVersePersonalize;
})(typeof window !== 'undefined' ? window : this);
