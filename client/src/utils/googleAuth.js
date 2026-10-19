/**
 * Shared Google Identity Services initialization and button rendering utility.
 * Guarantees that google.accounts.id.initialize() is called strictly once across
 * the application lifecycle, avoiding duplicate initialization console errors.
 */

let isInitialized = false;
let activeCallback = null;

export function initGoogleIdentityServices(clientId, onCredentialResponse) {
  if (!clientId || !window.google?.accounts?.id) return false;

  activeCallback = onCredentialResponse;

  if (!isInitialized) {
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (typeof activeCallback === 'function') {
            activeCallback(response);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      isInitialized = true;
    } catch (err) {
      console.warn('[GSI Init Error]:', err);
      return false;
    }
  }

  return true;
}

export function renderGoogleButton(containerElement, options = {}) {
  if (!containerElement || !window.google?.accounts?.id || !isInitialized) return false;
  try {
    containerElement.innerHTML = '';
    window.google.accounts.id.renderButton(containerElement, {
      theme: 'outline',
      size: 'large',
      width: 348,
      text: 'continue_with',
      shape: 'pill',
      ...options,
    });
    return true;
  } catch (err) {
    console.warn('[GSI Render Error]:', err);
    return false;
  }
}

export function promptGoogleOneTap(onNotification) {
  const gsi = window.google?.accounts?.id;
  if (!gsi || !isInitialized) return;
  try {
    gsi['prompt'](onNotification);
  } catch (err) {
    console.warn('[GSI Prompt Error]:', err);
  }
}
