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
const autosaveStatusText = document.getElementById('autosaveStatusText');
const clearDraftBtn = document.getElementById('clearDraftBtn');
const wizardStepTitle = document.getElementById('wizardStepTitle');
const wizardStepHint = document.getElementById('wizardStepHint');
const wizardPrevBtn = document.getElementById('wizardPrevBtn');
const wizardNextBtn = document.getElementById('wizardNextBtn');
const wizardReviewBox = document.getElementById('wizardReviewBox');
const evidenceInput = document.getElementById('evidence');
const DRAFT_STORAGE_KEY = 'remindApplicationDraft';

const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

let autosaveTimer = null;
let currentWizardStep = 1;
const totalWizardSteps = 3;

const wizardCopy = {
    1: {
        title: 'Schritt 1 von 3: Basisdaten',
        hint: 'Starte mit deinen Grundangaben. Danach folgen RP-Erfahrung und Motivation.'
    },
    2: {
        title: 'Schritt 2 von 3: RP Profil',
        hint: 'Beschreibe Erfahrung und Motivation. Optional kannst du einen Nachweis hochladen.'
    },
    3: {
        title: 'Schritt 3 von 3: Review',
        hint: 'Prüfe deine Angaben vor dem finalen Absenden.'
    }
};

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

const formInputs = {
    name: document.getElementById('name'),
    discord: document.getElementById('discord'),
    age: document.getElementById('age'),
    experience: document.getElementById('experience'),
    motivation: document.getElementById('motivation')
};

const errorElements = {
    name: document.getElementById('nameError'),
    discord: document.getElementById('discordError'),
    age: document.getElementById('ageError'),
    experience: document.getElementById('experienceError'),
    motivation: document.getElementById('motivationError'),
    evidence: document.getElementById('evidenceError')
};

const wizardStepFields = {
    1: ['name', 'discord', 'age'],
    2: ['experience', 'motivation', 'evidence'],
    3: []
};

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

        case 'age': {
            const ageNum = Number.parseInt(value, 10);
            if (!value || Number.isNaN(ageNum)) {
                errors.push('Bitte gib dein Alter ein');
            }
            if (ageNum < 13) {
                errors.push('Du musst mindestens 13 Jahre alt sein');
            }
            if (ageNum > 120) {
                errors.push('Bitte gib ein realistisches Alter ein');
            }
            break;
        }

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

        case 'evidence':
            return validateEvidenceFile(value);

        default:
            break;
    }

    return errors;
}

function validateEvidenceFile(file) {
    const errors = [];
    if (!file) return errors;

    if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
        errors.push('Nachweis muss PDF, PNG, JPG oder WEBP sein');
    }

    if (file.size <= 0 || file.size > MAX_EVIDENCE_SIZE) {
        errors.push('Nachweis darf maximal 5 MB groß sein');
    }

    return errors;
}

function isValidDiscord(value) {
    const normalizedValue = String(value || '').trim();
    const modernUsernamePattern = /^[a-z0-9._]{2,32}$/i;
    const legacyTagPattern = /^.{2,32}#\d{4}$/;
    return modernUsernamePattern.test(normalizedValue) || legacyTagPattern.test(normalizedValue);
}

function showFieldError(fieldName, errors) {
    const errorElement = errorElements[fieldName];
    if (!errorElement) return;

    if (errors.length > 0) {
        errorElement.textContent = errors[0];
        errorElement.style.display = 'block';

        if (fieldName === 'evidence') {
            evidenceInput.style.borderColor = 'var(--danger-color)';
        } else {
            formInputs[fieldName].style.borderColor = 'var(--danger-color)';
        }
    } else {
        errorElement.textContent = '';
        errorElement.style.display = 'none';

        if (fieldName === 'evidence') {
            evidenceInput.style.borderColor = 'var(--border-color)';
        } else {
            formInputs[fieldName].style.borderColor = 'var(--border-color)';
        }
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
    const completedFields = Object.values(formInputs).filter((inputElement) => {
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
        step: currentWizardStep,
        savedAt: new Date().toISOString()
    };
}

function updateDraftStatus(message) {
    if (draftStatusText) {
        draftStatusText.textContent = message;
    }
}

function setAutosaveStatus(message, state = 'idle') {
    if (!autosaveStatusText) return;

    autosaveStatusText.textContent = message;
    autosaveStatusText.classList.remove('pending', 'saved');
    if (state === 'pending') {
        autosaveStatusText.classList.add('pending');
    }
    if (state === 'saved') {
        autosaveStatusText.classList.add('saved');
    }
}

function saveDraftNow() {
    const hasAnyValue = Object.values(formInputs).some((inputElement) => String(inputElement.value || '').trim().length > 0);

    if (!hasAnyValue) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        updateDraftStatus('Noch kein Entwurf gespeichert');
        setAutosaveStatus('Keine ausstehenden Änderungen');
        return;
    }

    const draft = serializeDraft();
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const savedTime = new Date(draft.savedAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    updateDraftStatus(`Automatisch gespeichert um ${savedTime}`);
    setAutosaveStatus('Entwurf gespeichert', 'saved');
}

function scheduleDraftSave() {
    setAutosaveStatus('Änderungen erkannt...', 'pending');

    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
    }

    autosaveTimer = setTimeout(() => {
        saveDraftNow();
    }, 650);
}

function restoreDraft() {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) {
        updateDraftStatus('Noch kein Entwurf gespeichert');
        setAutosaveStatus('Keine ausstehenden Änderungen');
        return;
    }

    try {
        const draft = JSON.parse(rawDraft);
        Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
            inputElement.value = draft[fieldName] || '';
            updateCounter(fieldName, inputElement.value);
        });

        if (Number.isInteger(draft.step) && draft.step >= 1 && draft.step <= totalWizardSteps) {
            currentWizardStep = draft.step;
        }

        updateFormProgress();
        renderWizardStep();

        const savedAt = draft.savedAt
            ? new Date(draft.savedAt).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'unbekannt';

        updateDraftStatus(`Entwurf geladen · zuletzt gespeichert ${savedAt}`);
        setAutosaveStatus('Entwurf geladen', 'saved');
    } catch (error) {
        console.error('Draft konnte nicht geladen werden:', error);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        updateDraftStatus('Entwurf war fehlerhaft und wurde zurückgesetzt');
        setAutosaveStatus('Entwurf zurückgesetzt');
    }
}

function clearDraft() {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    updateDraftStatus('Entwurf gelöscht');
    setAutosaveStatus('Keine ausstehenden Änderungen');
}

function renderWizardStep() {
    document.querySelectorAll('.wizard-step-panel').forEach((panel) => {
        const step = Number(panel.dataset.step);
        panel.hidden = step !== currentWizardStep;
    });

    document.querySelectorAll('[data-step-chip]').forEach((chip) => {
        const step = Number(chip.dataset.stepChip);
        chip.classList.toggle('active', step === currentWizardStep);
    });

    const copy = wizardCopy[currentWizardStep] || wizardCopy[1];
    if (wizardStepTitle) wizardStepTitle.textContent = copy.title;
    if (wizardStepHint) wizardStepHint.textContent = copy.hint;

    if (wizardPrevBtn) {
        wizardPrevBtn.disabled = currentWizardStep === 1;
    }

    if (wizardNextBtn) {
        wizardNextBtn.style.display = currentWizardStep === totalWizardSteps ? 'none' : 'inline-flex';
    }

    if (submitBtn) {
        submitBtn.style.display = currentWizardStep === totalWizardSteps ? 'inline-flex' : 'none';
    }

    if (currentWizardStep === totalWizardSteps) {
        renderReviewSummary();
    }
}

function validateStep(step) {
    const fields = wizardStepFields[step] || [];
    let hasErrors = false;

    fields.forEach((fieldName) => {
        if (fieldName === 'evidence') {
            const file = evidenceInput?.files?.[0] || null;
            const errors = validateField('evidence', file);
            showFieldError('evidence', errors);
            if (errors.length > 0) hasErrors = true;
            return;
        }

        const inputElement = formInputs[fieldName];
        if (!inputElement) return;

        const errors = validateField(fieldName, inputElement.value);
        showFieldError(fieldName, errors);
        if (errors.length > 0) hasErrors = true;
    });

    return !hasErrors;
}

function renderReviewSummary() {
    if (!wizardReviewBox) return;

    const evidenceFile = evidenceInput?.files?.[0] || null;
    const evidenceLabel = evidenceFile
        ? `${evidenceFile.name} (${Math.round(evidenceFile.size / 1024)} KB)`
        : 'Kein Nachweis hochgeladen';

    wizardReviewBox.innerHTML = `
        <h4>Deine Angaben im Überblick</h4>
        <div class="wizard-review-grid">
            <div class="wizard-review-item">
                <strong>Name</strong>
                <span>${escapeHtml(formInputs.name.value.trim() || '—')}</span>
            </div>
            <div class="wizard-review-item">
                <strong>Discord</strong>
                <span>${escapeHtml(formInputs.discord.value.trim() || '—')}</span>
            </div>
            <div class="wizard-review-item">
                <strong>Alter</strong>
                <span>${escapeHtml(formInputs.age.value.trim() || '—')}</span>
            </div>
            <div class="wizard-review-item">
                <strong>Nachweis</strong>
                <span>${escapeHtml(evidenceLabel)}</span>
            </div>
            <div class="wizard-review-item">
                <strong>RP Erfahrung</strong>
                <span>${escapeHtml(formInputs.experience.value.trim() || '—')}</span>
            </div>
            <div class="wizard-review-item">
                <strong>Motivation</strong>
                <span>${escapeHtml(formInputs.motivation.value.trim() || '—')}</span>
            </div>
        </div>
    `;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const raw = String(reader.result || '');
            const commaIndex = raw.indexOf(',');
            resolve(commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw);
        };

        reader.onerror = () => {
            reject(new Error('Datei konnte nicht gelesen werden'));
        };

        reader.readAsDataURL(file);
    });
}

async function buildEvidencePayload() {
    const file = evidenceInput?.files?.[0] || null;
    if (!file) return null;

    const errors = validateEvidenceFile(file);
    showFieldError('evidence', errors);
    if (errors.length > 0) {
        throw new Error(errors[0]);
    }

    const base64Data = await fileToBase64(file);

    return {
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64Data
    };
}

Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
    inputElement.addEventListener('blur', () => {
        const errors = validateField(fieldName, inputElement.value);
        showFieldError(fieldName, errors);
    });

    inputElement.addEventListener('input', () => {
        const errors = validateField(fieldName, inputElement.value);
        showFieldError(fieldName, errors);
        updateCounter(fieldName, inputElement.value);
        updateFormProgress();
        scheduleDraftSave();
    });

    updateCounter(fieldName, inputElement.value);
});

evidenceInput?.addEventListener('change', () => {
    const file = evidenceInput.files?.[0] || null;
    const errors = validateEvidenceFile(file);
    showFieldError('evidence', errors);
    scheduleDraftSave();
});

wizardPrevBtn?.addEventListener('click', () => {
    if (currentWizardStep <= 1) return;
    currentWizardStep -= 1;
    renderWizardStep();
    scheduleDraftSave();
});

wizardNextBtn?.addEventListener('click', () => {
    const valid = validateStep(currentWizardStep);
    if (!valid) {
        showFeedback('Bitte überprüfe die Angaben dieses Schritts.', 'danger');
        return;
    }

    if (currentWizardStep < totalWizardSteps) {
        currentWizardStep += 1;
        renderWizardStep();
        scheduleDraftSave();
    }
});

clearDraftBtn?.addEventListener('click', () => {
    Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
        inputElement.value = '';
        updateCounter(fieldName, inputElement.value);
        showFieldError(fieldName, []);
    });

    if (evidenceInput) {
        evidenceInput.value = '';
        showFieldError('evidence', []);
    }

    currentWizardStep = 1;
    updateFormProgress();
    renderWizardStep();
    clearDraft();
});

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

function setButtonLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtnText.style.display = isLoading ? 'none' : 'inline';
    submitBtnLoader.style.display = isLoading ? 'inline-block' : 'none';
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    let hasErrors = false;
    Object.entries(formInputs).forEach(([fieldName, inputElement]) => {
        const errors = validateField(fieldName, inputElement.value);
        showFieldError(fieldName, errors);
        if (errors.length > 0) hasErrors = true;
    });

    const evidenceErrors = validateEvidenceFile(evidenceInput?.files?.[0] || null);
    showFieldError('evidence', evidenceErrors);
    if (evidenceErrors.length > 0) {
        hasErrors = true;
    }

    if (hasErrors) {
        showFeedback('Bitte überprüfe deine Eingaben.', 'danger');
        return;
    }

    try {
        setButtonLoading(true);
        showFeedback('Bewerbung wird eingereicht...', 'info');

        const evidence = await buildEvidencePayload();

        const formData = {
            name: formInputs.name.value.trim(),
            discord: formInputs.discord.value.trim(),
            age: Number.parseInt(formInputs.age.value, 10),
            experience: formInputs.experience.value.trim(),
            motivation: formInputs.motivation.value.trim(),
            evidence
        };

        const response = await api.submitApplication(formData);

        if (response.success) {
            form.style.display = 'none';
            formFeedback.innerHTML = '';
            successMessage.style.display = 'block';
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            updateDraftStatus('Entwurf erfolgreich abgeschlossen');
            setAutosaveStatus('Bewerbung abgeschlossen', 'saved');
            successMessage.scrollIntoView({ behavior: 'smooth' });
        } else {
            const errorMessage = response.message || 'Fehler beim Einreichen der Bewerbung';
            showFeedback(errorMessage, 'danger');
            setButtonLoading(false);
        }
    } catch (error) {
        console.error('Submission Fehler:', error);

        let errorMessage = 'Fehler beim Einreichen der Bewerbung';
        if (error.message) {
            errorMessage = error.message;
        } else if (error.errors && Array.isArray(error.errors)) {
            errorMessage = error.errors.join(', ');
        }

        showFeedback(errorMessage, 'danger');
        setButtonLoading(false);
    }
});

updateFormProgress();
renderWizardStep();
restoreDraft();

window.addEventListener('load', async () => {
    try {
        const isHealthy = await api.checkHealth();
        if (!isHealthy) {
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
