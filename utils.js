/**
 * Utilities - Common helper functions for the Remind Server
 */

const AppUtils = {
    /**
     * Safe localStorage access with error handling
     */
    storage: {
        get: function(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn(`Failed to get localStorage key "${key}":`, error);
                return defaultValue;
            }
        },

        set: function(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error(`Failed to set localStorage key "${key}":`, error);
                return false;
            }
        },

        remove: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn(`Failed to remove localStorage key "${key}":`, error);
                return false;
            }
        },

        clear: function() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('Failed to clear localStorage:', error);
                return false;
            }
        }
    },

    /**
     * Debounce function for performance optimization
     */
    debounce: function(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function for repeated events
     */
    throttle: function(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Query DOM safely
     */
    query: {
        one: function(selector) {
            try {
                return document.querySelector(selector);
            } catch (error) {
                console.error(`Invalid selector "${selector}":`, error);
                return null;
            }
        },

        all: function(selector) {
            try {
                return Array.from(document.querySelectorAll(selector));
            } catch (error) {
                console.error(`Invalid selector "${selector}":`, error);
                return [];
            }
        }
    },

    /**
     * HTTP request helper with error handling
     */
    http: {
        get: async function(url, timeout = 10000) {
            return this.request(url, { method: 'GET' }, timeout);
        },

        post: async function(url, data, timeout = 10000) {
            return this.request(url, {
                method: 'POST',
                body: typeof data === 'string' ? data : JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' }
            }, timeout);
        },

        request: async function(url, options = {}, timeout = 10000) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    return { ok: true, data: await response.json() };
                } else {
                    return { ok: true, data: await response.text() };
                }
            } catch (error) {
                clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                    return { ok: false, error: 'Request timeout', code: 'TIMEOUT' };
                }

                return {
                    ok: false,
                    error: error.message || 'Unknown error',
                    code: error.code || 'ERROR'
                };
            }
        }
    },

    /**
     * Format date helper
     */
    date: {
        format: function(date, format = 'de-DE') {
            try {
                return new Date(date).toLocaleString(format);
            } catch (error) {
                console.error('Failed to format date:', error);
                return String(date);
            }
        },

        now: function() {
            return new Date().toLocaleString('de-DE');
        }
    },

    /**
     * DOM manipulation helpers
     */
    dom: {
        addClass: function(element, className) {
            if (element && typeof element.classList !== 'undefined') {
                element.classList.add(className);
            }
        },

        removeClass: function(element, className) {
            if (element && typeof element.classList !== 'undefined') {
                element.classList.remove(className);
            }
        },

        toggleClass: function(element, className) {
            if (element && typeof element.classList !== 'undefined') {
                element.classList.toggle(className);
            }
        },

        hasClass: function(element, className) {
            return element && element.classList.contains(className);
        },

        show: function(element) {
            if (element) element.style.display = '';
        },

        hide: function(element) {
            if (element) element.style.display = 'none';
        }
    },

    /**
     * Validation helpers
     */
    validate: {
        email: function(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        url: function(url) {
            try {
                new URL(url);
                return true;
            } catch (error) {
                return false;
            }
        },

        number: function(value) {
            return !isNaN(value) && isFinite(value);
        },

        isEmpty: function(value) {
            return !value || (typeof value === 'string' && value.trim() === '');
        }
    },

    /**
     * Log helper for better debugging
     */
    log: {
        debug: function(...args) {
            if (window.__DEBUG_MODE__) {
                console.log('[DEBUG]', ...args);
            }
        },

        info: function(...args) {
            console.log('[INFO]', ...args);
        },

        warn: function(...args) {
            console.warn('[WARN]', ...args);
        },

        error: function(...args) {
            console.error('[ERROR]', ...args);
        }
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppUtils;
}
