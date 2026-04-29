/**
 * Bewerbungsformular Handler
 */

const form = document.getElementById('applicationForm');
const formFeedback = document.getElementById('formFeedback');
const successMessage = document.getElementById('successMessage');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnLoader = document.getElementById('submitBtnLoader');
const formProgressBar = document.getElementById('formProgressBar');
const formProgressValue = document.getElementById('formProgressValue');
const draftStatusText = document.getElementById('draftStatusText');
const clearDraftBtn = document.getElementById('clearDraftBtn');
const DRAFT_STORAGE_KEY = 'remindApplicationDraft';

const fieldCounters = {
    name: document.getElementById('nameCounter'),
    discord: document.getElementById('discordCounter'),
    age: document.getElementById('ageCounter'),
    experience: document.getElementById('experienceCounter'),
    motivation: document.getElementById('motivationCounter')
};

const fieldLimits = {
    name: 100,
    discord: 100,
    age: 3,
    experience: 500,
    motivation: 2000
};

// Form Feld Elemente
const formInputs = {
    name: document.getElementById('name'),
    discord: document.getElementById('discord'),
    age: document.getElementById('age'),
    experience: document.getElementById('experience'),
    motivation: document.getElementById('motivation')
};

// Error Elementen
const errorElements = {
    name: document.getElementById('nameError'),
    discord: document.getElementById('discordError'),
    age: document.getElementById('ageError'),
    experience: document.getElementById('experienceError'),
    motivation: document.getElementById('motivationError')
};

/**
 * Validiere ein einzelnes Feld
 */
function validateField(fieldName, value) {
    const errors = [];

    switch (fieldName) {
        case 'name':
            if (!value || value.trim().length < 2) {
                errors.push('Name muss mindestens 2 Zeichen lang sein');
            }
            if (value && value.length > 100) {
                errors.push('Name darf maximal 100 Zeichen lang sein');
            }
            break;

        case 'discord':
            if (!value || value.trim().length < 3) {
                errors.push('Discord Tag muss mindestens 3 Zeichen lang sein');
            } else if (!isValidDiscord(value)) {
                errors.push('Bitte gib einen gültigen Discord-Namen oder Tag ein');
            }
            break;

        case 'age':
            const ageNum = parseInt(value, 10);
            if (!value || isNaN(ageNum)) {
                errors.push('Bitte gib dein Alter ein');
            }
            if (ageNum < 13) {
                errors.push('Du musst mindestens 13 Jahre alt sein');
            }
            if (ageNum > 120) {
                errors.push('Bitte gib ein realistisches Alter ein');
            }
            break;

        case 'experience':
            if (!value || value.trim().length < 10) {
                errors.push('Erfahrung muss mindestens 10 Zeichen lang sein');
            }
            if (value && value.length > 500) {
                errors.push('Erfahrung darf maximal 500 Zeichen lang sein');
            }
            break;

        case 'motivation':
            if (!value || value.trim().length < 20) {
                errors.push('Motivation muss mindestens 20 Zeichen lang sein');
            }
            if (value && value.length > 2000) {
                errors.push('Motivation darf maximal 2000 Zeichen lang sein');
            }
            break;
    }

    return errors;
}

function isValidDiscord(value) {
    const normalizedValue = String(value || '').trim();
    const modernUsernamePattern = /^[a-z0-9._]{2,32}$/i;
    const legacyTagPattern = /^.{2,32}#\d{4}$/;
    return modernUsernamePattern.test(normalizedValue) || legacyTagPattern.test(normalizedValue);
}

/**
 * Zeige Fehler für Feld
 */
function showFieldError(fieldName, errors) {
    const errorElement = errorElements[fieldName];
    if (!errorElement) return;

    if (errors.length > 0) {
        errorElement.textContent = errors[0];
        errorElement.style.display = 'block';
        formInputs[fieldName].style.borderColor = 'var(--danger-color)';
    } else {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        formInputs[fieldName].style.borderColor = 'var(--border-color)';
    }
}

function updateCounter(fieldName, value) {
    const counter = fieldCounters[fieldName];
    if (!counter) return;

    const currentLength = String(value || '').length;
    const limit = fieldLimits[fieldName];
    counter.textContent = `${currentLength}/${limit}`;
    counter.style.color = currentLength > limit ? 'var(--danger-color)' : 'var(--text-muted)';
}

function updateFormProgress() {
    const totalFields = Object.keys(formInputs).length;
    const completedFields = Object.entries(formInputs).filter(([, inputElement]) => {
        const value = inputElement.value?.trim() || '';
        return value.length > 0;
    }).length;

    const progress = Math.round((completedFields / totalFields) * 100);

    if (formProgressBar) {
        formProgressBar.style.width = `${progress}%`;
    }

    if (formProgressValue) {
        formProgressValue.textContent = `${progress}%`;
    }
}

function serializeDraft() {
    return {
        name: formInputs.name.value,
        discord: formInputs.discord.value,
        age: formInputs.age.value,
        experience: formInputs.experience.value,
        motivation: formInputs.motivation.value,
        savedAt: new Date().toISOString()
    };
}

function updateDraftStatus(message) {
    if (draftStatusText) {
        draftStatusText.textContent = message;
    }
}

function saveDraft() {
    const hasAnyValue = Object.values(formInputs).some((inputElement) => String(inputElement.value || '').trim().length > 0);

    if (!hasAnyValue) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        updateDraftStatus('Noch kein Entwurf gespeichert');
        return;
    }

    const draft = serializeDraft();
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const savedDate = new Date(draft.savedAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });
    updateDraftStatus(`Automatisch gespeichert um ${savedDate}`);
}

function restoreDraft() {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) {
        updateDraftStatus('Noch kein Entwurf gespeichert');
        return;
    }

    try {
        const draft = JSON.parse(rawDraft);
        Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
            inputElement.value = draft[fieldName] || '';
            updateCounter(fieldName, inputElement.value);
        });
        updateFormProgress();

        const savedAt = draft.savedAt
            ? new Date(draft.savedAt).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'unbekannt';
        updateDraftStatus(`Entwurf geladen · zuletzt gespeichert ${savedAt}`);
    } catch (error) {
        console.error('Draft konnte nicht geladen werden:', error);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        updateDraftStatus('Entwurf war fehlerhaft und wurde zurückgesetzt');
    }
}

function clearDraft() {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    updateDraftStatus('Entwurf gelöscht');
}

/**
 * Real-time Validierung bei Input
 */
Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
    inputElement.addEventListener('blur', () => {
        const value = inputElement.value;
        const errors = validateField(fieldName, value);
        showFieldError(fieldName, errors);
    });

    // Clearer Fehler beim Tippen
    inputElement.addEventListener('input', () => {
        const errors = validateField(fieldName, inputElement.value);
        showFieldError(fieldName, errors);
        updateCounter(fieldName, inputElement.value);
        updateFormProgress();
        saveDraft();
    });

    updateCounter(fieldName, inputElement.value);
});

updateFormProgress();
restoreDraft();

clearDraftBtn?.addEventListener('click', () => {
    Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
        inputElement.value = '';
        updateCounter(fieldName, inputElement.value);
        showFieldError(fieldName, []);
    });
    updateFormProgress();
    clearDraft();
});

/**
 * Zeige Feedback Nachricht
 */
function showFeedback(message, type = 'info') {
    formFeedback.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    submitBtn.disabled = isLoading;
    submitBtnText.style.display = isLoading ? 'none' : 'inline';
    submitBtnLoader.style.display = isLoading ? 'inline-block' : 'none';
}

/**
 * Form Submit Handler
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validiere alle Felder
    let hasErrors = false;
    Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
        const errors = validateField(fieldName, inputElement.value);
        showFieldError(fieldName, errors);
        if (errors.length > 0) hasErrors = true;
    });

    if (hasErrors) {
        showFeedback('Bitte überprüfe deine Eingaben', 'danger');
        return;
    }

    // Sammle Form Daten
    const formData = {
        name: formInputs.name.value.trim(),
        discord: formInputs.discord.value.trim(),
        age: parseInt(formInputs.age.value, 10),
        experience: formInputs.experience.value.trim(),
        motivation: formInputs.motivation.value.trim()
    };

    // Sende Bewerbung
    try {
        setButtonLoading(true);
        showFeedback('Bewerbung wird eingereicht...', 'info');

        const response = await api.submitApplication(formData);

        if (response.success) {
            // Verstecke Form, zeige Success Nachricht
            form.style.display = 'none';
            formFeedback.innerHTML = '';
            successMessage.style.display = 'block';
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            updateDraftStatus('Entwurf erfolgreich abgeschlossen');

            // Scrolle zu Success Nachricht
            successMessage.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Zeige Server Error
            const errorMsg = response.message || 'Fehler beim Einreichen der Bewerbung';
            showFeedback(errorMsg, 'danger');
            setButtonLoading(false);
        }
    } catch (error) {
        console.error('Submission Fehler:', error);

        let errorMsg = 'Fehler beim Einreichen der Bewerbung';

        // Behandle API Fehler
        if (error.message) {
            errorMsg = error.message;
        } else if (error.errors && Array.isArray(error.errors)) {
            errorMsg = error.errors.join(', ');
        }

        showFeedback(errorMsg, 'danger');
        setButtonLoading(false);
    }
});

/**
 * Prüfe API Verfügbarkeit beim Laden
 */
window.addEventListener('load', async () => {
    try {
        const isHealthy = await api.checkHealth();
        if (!isHealthy) {
            console.warn('API nicht verfügbar');
            showFeedback(
                '⚠️ Der Server antwortet nicht. Stelle sicher, dass der Backend Server läuft.',
                'danger'
            );
            submitBtn.disabled = true;
        }
    } catch (error) {
        console.error('API Check Fehler:', error);
        showFeedback(
            '⚠️ Der Server antwortet nicht. Stelle sicher, dass der Backend Server läuft.',
            'danger'
        );
        submitBtn.disabled = true;
    }
});
