/**
 * Admin Login Handler
 */

const loginForm = document.getElementById('loginForm');
const loginFeedback = document.getElementById('loginFeedback');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginBtnLoader = document.getElementById('loginBtnLoader');
const passwordToggle = document.getElementById('passwordToggle');
const loginStatusPill = document.getElementById('loginStatusPill');
const loginHealthLabel = document.getElementById('loginHealthLabel');

// Form Inputs
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// Error Elements
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

/**
 * Zeige Fehler für Feld
 */
function showFieldError(fieldName, message) {
    const errorElement = fieldName === 'username' ? usernameError : passwordError;
    const inputElement = fieldName === 'username' ? usernameInput : passwordInput;

    if (message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        inputElement.style.borderColor = 'var(--danger-color)';
    } else {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        inputElement.style.borderColor = 'var(--border-color)';
    }
}

/**
 * Clear Fehler beim Input
 */
usernameInput.addEventListener('input', () => showFieldError('username', ''));
passwordInput.addEventListener('input', () => showFieldError('password', ''));

passwordToggle?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    passwordToggle.textContent = isPassword ? 'Verbergen' : 'Anzeigen';
    passwordToggle.setAttribute('aria-label', isPassword ? 'Passwort verbergen' : 'Passwort anzeigen');
});

/**
 * Zeige Feedback Nachricht
 */
function showFeedback(message, type = 'info') {
    loginFeedback.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[&<>"']/g, (char) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return map[char] || char;
    });
}

/**
 * Setze Button Loading State
 */
function setButtonLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtnText.style.display = isLoading ? 'none' : 'inline';
    loginBtnLoader.style.display = isLoading ? 'inline-block' : 'none';
}

/**
 * Redirect zu Dashboard
 */
function goToDashboard() {
    // Kleine Verzögerung für besseres UX
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 500);
}

/**
 * Prüfe ob bereits angemeldet
 */
if (api.isAuthenticated()) {
    goToDashboard();
}

/**
 * Form Submit Handler
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Validiere
    let hasErrors = false;

    if (!username || username.length < 3) {
        showFieldError('username', 'Username muss mindestens 3 Zeichen lang sein');
        hasErrors = true;
    } else {
        showFieldError('username', '');
    }

    if (!password || password.length < 6) {
        showFieldError('password', 'Passwort muss mindestens 6 Zeichen lang sein');
        hasErrors = true;
    } else {
        showFieldError('password', '');
    }

    if (hasErrors) return;

    // Login versuchen
    try {
        setButtonLoading(true);
        showFeedback('Melde dich an...', 'info');

        const response = await api.login(username, password);

        if (response.success) {
            showFeedback('✅ Login erfolgreich! Weiterleitend...', 'success');
            goToDashboard();
        } else {
            const message = response.message || 'Login fehlgeschlagen';
            showFeedback(message, 'danger');
            setButtonLoading(false);
        }
    } catch (error) {
        console.error('Login Fehler:', error);

        let errorMsg = 'Fehler beim Login';
        if (error.message) {
            errorMsg = error.message;
        }

        showFeedback(errorMsg, 'danger');
        setButtonLoading(false);
    }
});

/**
 * Prüfe API Verfügbarkeit
 */
window.addEventListener('load', async () => {
    try {
        const isHealthy = await api.checkHealth();
        if (!isHealthy) {
            if (loginStatusPill) {
                loginStatusPill.textContent = 'Offline';
                loginStatusPill.classList.remove('online');
            }
            if (loginHealthLabel) {
                loginHealthLabel.textContent = 'Backend nicht erreichbar. Bitte Server prüfen.';
            }
            showFeedback(
                '⚠️ Der Server antwortet nicht. Stelle sicher, dass der Backend Server läuft.',
                'danger'
            );
            loginBtn.disabled = true;
            return;
        }

        if (loginStatusPill) {
            loginStatusPill.textContent = 'Online';
            loginStatusPill.classList.add('online');
        }
        if (loginHealthLabel) {
            loginHealthLabel.textContent = 'Backend erreichbar. Login und Dashboard sind bereit.';
        }
    } catch (error) {
        console.error('API Check Fehler:', error);
        if (loginStatusPill) {
            loginStatusPill.textContent = 'Offline';
            loginStatusPill.classList.remove('online');
        }
        if (loginHealthLabel) {
            loginHealthLabel.textContent = 'Backend nicht erreichbar. Bitte Server prüfen.';
        }
        showFeedback(
            '⚠️ Der Server antwortet nicht. Stelle sicher, dass der Backend Server läuft.',
            'danger'
        );
        loginBtn.disabled = true;
    }
});
