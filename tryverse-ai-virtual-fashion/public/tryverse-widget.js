/**
 * TryVerse Virtual Try-On Widget
 * Embed on your e-commerce site for AI-powered virtual try-on.
 *
 * Usage:
 *   <script src="https://your-domain.com/tryverse-widget.js"></script>
 *   <script>
 *     TryVerse.open({
 *       apiKey: 'YOUR_API_KEY',
 *       productImage: 'https://yoursite.com/product.jpg',
 *       category: 'clothing',
 *       backendUrl: 'https://api.tryverse.ai'  // optional
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
          throw new Error(d.error || 'Try-on failed');
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

  function createModal(backendUrl, apiKey, productImageUrl, category, productDescription, inlineContainer) {
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

    var html =
      '<h2 style="margin:0 0 16px;font-size:1.25rem;">Virtual Try-On</h2>' +
      '<p style="color:#666;font-size:0.875rem;margin-bottom:20px;">Upload your photo to see how this item looks on you.</p>' +
      '<div id="tryverse-person-preview" style="width:120px;height:160px;border:2px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;background:#f9fafb;overflow:hidden;">' +
      '<span style="color:#9ca3af;font-size:0.75rem;">Your photo</span></div>' +
      '<input type="file" id="tryverse-person-input" accept="image/*" style="margin-bottom:20px;font-size:0.875rem;" />' +
      '<div id="tryverse-status" style="margin:16px 0;min-height:24px;font-size:0.875rem;color:#6b7280;"></div>' +
      '<div id="tryverse-result" style="margin-top:16px;display:none;"></div>' +
      '<div style="display:flex;gap:12px;margin-top:20px;">' +
      '<button id="tryverse-run" style="flex:1;padding:12px 20px;background:#000;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:500;">Try It On</button>' +
      '<button id="tryverse-close" style="padding:12px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Close</button>' +
      '</div>';

    box.innerHTML = html;
    overlay.appendChild(box);

    var personPreview = box.querySelector('#tryverse-person-preview');
    var personInput = box.querySelector('#tryverse-person-input');
    var statusEl = box.querySelector('#tryverse-status');
    var resultEl = box.querySelector('#tryverse-result');
    var runBtn = box.querySelector('#tryverse-run');
    var closeBtn = box.querySelector('#tryverse-close');

    var personFile = null;

    personInput.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      personFile = f;
      var reader = new FileReader();
      reader.onload = function () {
        personPreview.innerHTML = '<img src="' + reader.result + '" style="width:100%;height:100%;object-fit:cover;" />';
      };
      reader.readAsDataURL(f);
    });

    runBtn.addEventListener('click', function () {
      if (!personFile) {
        statusEl.textContent = 'Please upload your photo first.';
        statusEl.style.color = '#dc2626';
        return;
      }
      runBtn.disabled = true;
      statusEl.textContent = 'Uploading...';
      statusEl.style.color = '#6b7280';

      var productPathPromise = productImageUrl.startsWith('http')
        ? uploadFromUrl(backendUrl, apiKey, productImageUrl).then(function (d) {
            return d.filePath;
          })
        : Promise.resolve(productImageUrl);

      productPathPromise
        .then(function (productPath) {
          statusEl.textContent = 'Uploading your photo...';
          return uploadImage(backendUrl, apiKey, personFile, 'person').then(function (d) {
            return { personPath: d.filePath, productPath: productPath };
          });
        })
        .then(function (paths) {
          statusEl.textContent = 'Generating try-on...';
          return startTryOn(
            backendUrl,
            apiKey,
            paths.personPath,
            paths.productPath,
            category,
            productDescription
          );
        })
        .then(function (data) {
          if (data.status === 'completed' && data.resultUrl) {
            resultEl.innerHTML =
              '<img src="' +
              data.resultUrl +
              '" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;" />';
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
            resultEl.innerHTML =
              '<img src="' +
              resultUrl +
              '" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;" />';
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
      inlineContainer.innerHTML = '';
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

    createModal(backendUrl, apiKey, productImage, category, productDescription);
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
    createModal(backendUrl, apiKey, productImage, category, opts.productDescription || '', container);
  }

  window.TryVerse = {
    open: open,
    embed: embed,
    config: function (c) {
      CONFIG = Object.assign({}, CONFIG, c);
    },
  };
})();
