/**
 * Bewerbungsformular Handler
 */

const form = document.getElementById('applicationForm');
const formFeedback = document.getElementById('formFeedback');
const successMessage = document.getElementById('successMessage');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnLoader = document.getElementById('submitBtnLoader');

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
            }
            break;

        case 'age':
            const ageNum = parseInt(value);
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
    });
});

/**
 * Zeige Feedback Nachricht
 */
function showFeedback(message, type = 'info') {
    formFeedback.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        age: parseInt(formInputs.age.value),
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
