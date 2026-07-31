/**
 * TryVerse Virtual Try-On Widget
 * Embed on your e-commerce site for AI-powered virtual try-on.
 *
 * Security: UI uses createElement/textContent and validated image URLs only (DOM APIs; no string-to-markup sinks).
 *
 * Usage:
 *   <script src="https://your-domain.com/tryverse-widget.js"></script>
 *   <script>
 *     TryVerse.open({
 *       apiKey: 'YOUR_API_KEY',
 *       productImage: 'https://yoursite.com/product.jpg',
 *       category: 'clothing',
 *       backendUrl: 'https://api.tryverseai.com'  // optional
 *     });
 *   </script>
 */
(function () {
  'use strict';

  var CONFIG = {
    backendUrl: '',
    apiKey: '',
    category: 'clothing',
  };

  function log(msg) {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[TryVerse]', msg);
    }
  }

  function uploadImage(backendUrl, apiKey, file, type) {
    var formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);
    return fetch(backendUrl + '/api/upload', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData,
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          throw new Error(d.error || 'Upload failed');
        });
      }
      return r.json();
    });
  }

  function uploadFromUrl(backendUrl, apiKey, url) {
    return fetch(backendUrl + '/api/upload/from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url: url }),
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          throw new Error(d.error || 'Import failed');
        });
      }
      return r.json();
    });
  }

  /** Hosts the TryVerse API cannot fetch (SSRF block) — browser uploads the bytes instead. */
  function isLocalOrPrivateImageUrl(url) {
    try {
      var u = new URL(url);
      var h = u.hostname.toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
      if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
      if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function uploadProductImage(backendUrl, apiKey, productImageUrl) {
    if (!productImageUrl || typeof productImageUrl !== 'string') {
      return Promise.reject(new Error('Product image required'));
    }
    if (!productImageUrl.startsWith('http')) {
      return Promise.resolve(productImageUrl);
    }
    if (isLocalOrPrivateImageUrl(productImageUrl)) {
      return fetch(productImageUrl)
        .then(function (r) {
          if (!r.ok) throw new Error('Could not load product image from your site');
          return r.blob();
        })
        .then(function (blob) {
          var mime = blob.type || 'image/jpeg';
          var ext = mime.indexOf('png') >= 0 ? 'png' : mime.indexOf('webp') >= 0 ? 'webp' : 'jpg';
          var file = new File([blob], 'product.' + ext, { type: mime });
          return uploadImage(backendUrl, apiKey, file, 'product');
        })
        .then(function (d) {
          return d.filePath;
        });
    }
    return uploadFromUrl(backendUrl, apiKey, productImageUrl).then(function (d) {
      return d.filePath;
    });
  }

  function fetchWidgetConfig(backendUrl, apiKey) {
    return fetch(backendUrl + '/api/widget/config', {
      headers: { 'x-api-key': apiKey },
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          throw new Error(d.error || 'Config failed');
        });
      }
      return r.json();
    });
  }

  function resolveModelPersonPath(backendUrl, apiKey, modelId) {
    return fetch(backendUrl + '/api/models/person-path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ modelId: modelId }),
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          throw new Error(d.error || 'Could not use model');
        });
      }
      return r.json();
    });
  }

  function startTryOn(backendUrl, apiKey, personPath, productPath, category, productDescription) {
    return fetch(backendUrl + '/api/widget/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        personImagePath: personPath,
        productImagePath: productPath,
        category: category,
        productDescription: productDescription || undefined,
      }),
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          var msg = d.error || 'Try-on failed';
          if (r.status === 402 || d.code === 'CREDITS_EXHAUSTED') {
            d.code = 'CREDITS_EXHAUSTED';
            msg =
              d.error ||
              "Virtual try-on isn't available right now. Please try again later or contact the store.";
          }
          var err = new Error(msg);
          err.code = d.code;
          err.status = r.status;
          throw err;
        });
      }
      return r.json();
    });
  }

  function pollStatus(backendUrl, apiKey, tryonId) {
    return fetch(backendUrl + '/api/widget/status/' + tryonId, {
      headers: { 'x-api-key': apiKey },
    }).then(function (r) {
      return r.json();
    });
  }

  function pollUntilComplete(backendUrl, apiKey, tryonId, onProgress) {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      var maxAttempts = 60;

      function poll() {
        attempts++;
        pollStatus(backendUrl, apiKey, tryonId).then(function (data) {
          if (onProgress) onProgress(data.status);
          if (data.status === 'completed' && data.resultUrl) {
            resolve(data.resultUrl);
            return;
          }
          if (data.status === 'failed') {
            reject(new Error(data.error || 'Try-on failed'));
            return;
          }
          if (attempts >= maxAttempts) {
            reject(new Error('Timeout waiting for result'));
            return;
          }
          setTimeout(poll, 2000);
        }).catch(reject);
      }
      poll();
    });
  }

  /** Only https, localhost http, or data:image/*;base64 — avoids javascript: / unexpected schemes in img.src. */
  function isSafeImageDisplayUrl(url) {
    if (url == null || typeof url !== 'string') return false;
    var s = String(url).trim();
    if (s.length === 0 || s.length > 12 * 1024 * 1024) return false;
    if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(s)) return true;
    try {
      var u = new URL(s);
      if (u.protocol === 'https:') return true;
      if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderPreviewImg(container, url) {
    clearEl(container);
    if (!isSafeImageDisplayUrl(url)) return;
    var img = document.createElement('img');
    img.src = url;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    container.appendChild(img);
  }

  function renderResultImg(container, url) {
    clearEl(container);
    if (!isSafeImageDisplayUrl(url)) {
      container.textContent = 'Could not display result.';
      return;
    }
    var img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.border = '1px solid #e5e7eb';
    container.appendChild(img);
  }

  function createModal(backendUrl, apiKey, productImageUrl, category, productDescription, inlineContainer, widgetCfg) {
    var cfg = widgetCfg || { showModels: false, models: [] };
    var showModels = cfg.showModels && cfg.models && cfg.models.length > 0;

    var overlay = document.createElement('div');
    var box = document.createElement('div');
    if (inlineContainer) {
      overlay.id = 'tryverse-inline';
      overlay.style.cssText = 'font-family:system-ui,sans-serif;';
      box.style.cssText = 'padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;';
    } else {
      overlay.id = 'tryverse-overlay';
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:system-ui,sans-serif;';
      box.style.cssText =
        'background:white;border-radius:12px;padding:24px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';
    }

    var h2 = document.createElement('h2');
    h2.style.margin = '0 0 16px';
    h2.style.fontSize = '1.25rem';
    h2.textContent = 'Virtual Try-On';
    box.appendChild(h2);

    var intro = document.createElement('p');
    intro.style.color = '#666';
    intro.style.fontSize = '0.875rem';
    intro.style.marginBottom = '16px';
    intro.textContent =
      'Upload your photo' +
      (showModels ? ', or choose a model below,' : '') +
      ' to see how this item looks.';
    box.appendChild(intro);

    if (showModels) {
      var pickLabel = document.createElement('p');
      pickLabel.style.fontSize = '0.8rem';
      pickLabel.style.color = '#6b7280';
      pickLabel.style.margin = '12px 0 8px';
      pickLabel.textContent = 'Or pick a model';
      box.appendChild(pickLabel);

      var modelsWrap = document.createElement('div');
      modelsWrap.id = 'tryverse-models';
      modelsWrap.style.cssText =
        'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;max-height:140px;overflow-y:auto;';
      for (var mi = 0; mi < cfg.models.length; mi++) {
        var mod = cfg.models[mi];
        var mBtn = document.createElement('button');
        mBtn.type = 'button';
        mBtn.className = 'tryverse-model-btn';
        mBtn.setAttribute('data-model-id', String(mod.id));
        mBtn.style.cssText =
          'padding:0;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;width:52px;height:86px;cursor:pointer;background:#f9fafb;';
        var mImg = document.createElement('img');
        if (isSafeImageDisplayUrl(mod.image_url)) {
          mImg.src = mod.image_url;
        }
        mImg.alt = mod.display_name != null ? String(mod.display_name) : '';
        mImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        mBtn.appendChild(mImg);
        modelsWrap.appendChild(mBtn);
      }
      box.appendChild(modelsWrap);
    }

    var personPreview = document.createElement('div');
    personPreview.id = 'tryverse-person-preview';
    personPreview.style.cssText =
      'width:120px;height:160px;border:2px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;background:#f9fafb;overflow:hidden;';
    var previewPlaceholder = document.createElement('span');
    previewPlaceholder.style.color = '#9ca3af';
    previewPlaceholder.style.fontSize = '0.75rem';
    previewPlaceholder.textContent = 'Your photo';
    personPreview.appendChild(previewPlaceholder);
    box.appendChild(personPreview);

    var personInput = document.createElement('input');
    personInput.type = 'file';
    personInput.id = 'tryverse-person-input';
    personInput.accept = 'image/*';
    personInput.style.marginBottom = '20px';
    personInput.style.fontSize = '0.875rem';
    box.appendChild(personInput);

    var statusEl = document.createElement('div');
    statusEl.id = 'tryverse-status';
    statusEl.style.margin = '16px 0';
    statusEl.style.minHeight = '24px';
    statusEl.style.fontSize = '0.875rem';
    statusEl.style.color = '#6b7280';
    box.appendChild(statusEl);

    var resultEl = document.createElement('div');
    resultEl.id = 'tryverse-result';
    resultEl.style.marginTop = '16px';
    resultEl.style.display = 'none';
    box.appendChild(resultEl);

    var btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '12px';
    btnRow.style.marginTop = '20px';
    var runBtn = document.createElement('button');
    runBtn.id = 'tryverse-run';
    runBtn.style.cssText =
      'flex:1;padding:12px 20px;background:#000;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:500;';
    runBtn.textContent = 'Try It On';
    var closeBtn = document.createElement('button');
    closeBtn.id = 'tryverse-close';
    closeBtn.style.cssText =
      'padding:12px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:1rem;cursor:pointer;';
    closeBtn.textContent = 'Close';
    btnRow.appendChild(runBtn);
    btnRow.appendChild(closeBtn);
    box.appendChild(btnRow);

    overlay.appendChild(box);

    var personFile = null;
    var selectedModelId = null;

    function updateModelButtonsHighlight() {
      var btns = box.querySelectorAll('.tryverse-model-btn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b.getAttribute('data-model-id') === selectedModelId) {
          b.style.borderColor = '#000';
          b.style.boxShadow = '0 0 0 1px #000';
        } else {
          b.style.borderColor = '#e5e7eb';
          b.style.boxShadow = 'none';
        }
      }
    }

    if (showModels) {
      var modelBtns = box.querySelectorAll('.tryverse-model-btn');
      for (var j = 0; j < modelBtns.length; j++) {
        modelBtns[j].addEventListener('click', function (ev) {
          var btn = ev.currentTarget;
          selectedModelId = btn.getAttribute('data-model-id');
          personFile = null;
          personInput.value = '';
          var img = btn.querySelector('img');
          if (img && img.src) {
            renderPreviewImg(personPreview, img.src);
          }
          updateModelButtonsHighlight();
          statusEl.textContent = '';
        });
      }
    }

    personInput.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      selectedModelId = null;
      updateModelButtonsHighlight();
      personFile = f;
      var reader = new FileReader();
      reader.onload = function () {
        renderPreviewImg(personPreview, reader.result);
      };
      reader.readAsDataURL(f);
    });

    runBtn.addEventListener('click', function () {
      if (!personFile && !selectedModelId) {
        statusEl.textContent = 'Please upload your photo or select a model.';
        statusEl.style.color = '#dc2626';
        return;
      }
      runBtn.disabled = true;
      statusEl.textContent = 'Uploading...';
      statusEl.style.color = '#6b7280';

      var productPathPromise = uploadProductImage(backendUrl, apiKey, productImageUrl);

      var personPathPromise;
      if (selectedModelId) {
        personPathPromise = resolveModelPersonPath(backendUrl, apiKey, selectedModelId).then(function (d) {
          return d.filePath;
        });
      } else {
        personPathPromise = uploadImage(backendUrl, apiKey, personFile, 'person').then(function (d) {
          return d.filePath;
        });
      }

      Promise.all([productPathPromise, personPathPromise])
        .then(function (paths) {
          var productPath = paths[0];
          var personPath = paths[1];
          statusEl.textContent = 'Generating try-on...';
          return startTryOn(
            backendUrl,
            apiKey,
            personPath,
            productPath,
            category,
            productDescription
          );
        })
        .then(function (data) {
          if (data.status === 'completed' && data.resultUrl) {
            renderResultImg(resultEl, data.resultUrl);
            resultEl.style.display = 'block';
            statusEl.textContent = 'Done!';
            runBtn.style.display = 'none';
            return;
          }
          statusEl.textContent = 'Processing...';
          return pollUntilComplete(
            backendUrl,
            apiKey,
            data.tryonId,
            function (s) {
              statusEl.textContent = 'Status: ' + s + '...';
            }
          ).then(function (resultUrl) {
            renderResultImg(resultEl, resultUrl);
            resultEl.style.display = 'block';
            statusEl.textContent = 'Done!';
            runBtn.style.display = 'none';
          });
        })
        .catch(function (err) {
          statusEl.textContent = err.message || 'Something went wrong.';
          statusEl.style.color = '#dc2626';
          runBtn.disabled = false;
        });
    });

    closeBtn.addEventListener('click', function () {
      if (inlineContainer) {
        inlineContainer.removeChild(overlay);
      } else {
        document.body.removeChild(overlay);
      }
    });
    if (!inlineContainer) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) document.body.removeChild(overlay);
      });
    }

    if (inlineContainer) {
      clearEl(inlineContainer);
      inlineContainer.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }
  }

  function open(opts) {
    var backendUrl = (opts.backendUrl || CONFIG.backendUrl || '').replace(/\/$/, '');
    var apiKey = opts.apiKey || CONFIG.apiKey;
    var productImage = opts.productImage || opts.productImageUrl;
    var category = opts.category || opts.productType || 'clothing';
    var productDescription = opts.productDescription || '';

    if (!backendUrl || !apiKey) {
      log('TryVerse.open() requires backendUrl and apiKey');
      return;
    }
    if (!productImage) {
      log('TryVerse.open() requires productImage (URL or storage path)');
      return;
    }
    if (!['clothing', 'bags', 'glasses'].includes(category)) {
      category = 'clothing';
    }

    fetchWidgetConfig(backendUrl, apiKey)
      .then(function (cfg) {
        createModal(backendUrl, apiKey, productImage, category, productDescription, null, cfg);
      })
      .catch(function () {
        createModal(backendUrl, apiKey, productImage, category, productDescription, null, {
          showModels: false,
          models: [],
        });
      });
  }

  function embed(opts) {
    var containerId = opts.container || 'tryverse-embed';
    var container = document.getElementById(containerId);
    if (!container) {
      log('TryVerse.embed() container not found: ' + containerId);
      return;
    }
    var backendUrl = (opts.backendUrl || CONFIG.backendUrl || '').replace(/\/$/, '');
    var apiKey = opts.apiKey || CONFIG.apiKey;
    var productImage = opts.productImage || opts.productImageUrl;
    var category = opts.category || opts.productType || 'clothing';
    if (!backendUrl || !apiKey || !productImage) {
      log('TryVerse.embed() requires backendUrl, apiKey, and productImage');
      return;
    }
    if (!['clothing', 'bags', 'glasses'].includes(category)) category = 'clothing';

    fetchWidgetConfig(backendUrl, apiKey)
      .then(function (cfg) {
        createModal(backendUrl, apiKey, productImage, category, opts.productDescription || '', container, cfg);
      })
      .catch(function () {
        createModal(backendUrl, apiKey, productImage, category, opts.productDescription || '', container, {
          showModels: false,
          models: [],
        });
      });
  }

  window.TryVerse = {
    open: open,
    embed: embed,
    config: function (c) {
      CONFIG = Object.assign({}, CONFIG, c);
    },
  };
})();
