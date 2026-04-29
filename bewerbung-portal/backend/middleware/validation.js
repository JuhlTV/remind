/**
 * Validiert Bewerbungsformular
 */
export function validateApplication(req, res, next) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const discord = typeof req.body.discord === 'string' ? req.body.discord.trim() : '';
    const experience = typeof req.body.experience === 'string' ? req.body.experience.trim() : '';
    const motivation = typeof req.body.motivation === 'string' ? req.body.motivation.trim() : '';
    const ageRaw = req.body.age;
    const evidence = req.body.evidence;
    const errors = [];

    // Name validieren
    if (!name || name.length < 2) {
        errors.push('Name muss mindestens 2 Zeichen lang sein');
    }
    if (name && name.length > 100) {
        errors.push('Name darf maximal 100 Zeichen lang sein');
    }

    // Discord validieren
    if (!discord || discord.length < 3) {
        errors.push('Discord Tag muss mindestens 3 Zeichen lang sein');
    }
    if (discord && !/^.{2,32}#\d{4}$/.test(discord) && !/^[a-z0-9._]{2,32}$/i.test(discord)) {
        errors.push('Bitte gib einen gültigen Discord-Namen oder Tag ein');
    }

    // Alter validieren
    const ageNum = parseInt(ageRaw, 10);
    if (!ageRaw || Number.isNaN(ageNum) || ageNum < 13) {
        errors.push('Du musst mindestens 13 Jahre alt sein');
    }
    if (ageNum > 120) {
        errors.push('Bitte gib ein realistisches Alter ein');
    }

    // Erfahrung validieren
    if (!experience || experience.length < 10) {
        errors.push('Erfahrung muss mindestens 10 Zeichen lang sein');
    }
    if (experience && experience.length > 500) {
        errors.push('Erfahrung darf maximal 500 Zeichen lang sein');
    }

    // Motivation validieren
    if (!motivation || motivation.length < 20) {
        errors.push('Motivation muss mindestens 20 Zeichen lang sein');
    }
    if (motivation && motivation.length > 2000) {
        errors.push('Motivation darf maximal 2000 Zeichen lang sein');
    }

    if (evidence) {
        const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

        if (typeof evidence !== 'object' || evidence === null) {
            errors.push('Ungültiges Nachweis-Format');
        } else {
            const safeName = typeof evidence.name === 'string' ? evidence.name.trim() : '';
            const safeType = typeof evidence.type === 'string' ? evidence.type.trim().toLowerCase() : '';
            const safeData = typeof evidence.data === 'string' ? evidence.data.trim() : '';
            const safeSize = Number(evidence.size || 0);

            if (!safeName || safeName.length > 255) {
                errors.push('Dateiname für den Nachweis ist ungültig');
            }

            if (!allowedMimeTypes.includes(safeType)) {
                errors.push('Nachweis muss PDF, PNG, JPG oder WEBP sein');
            }

            if (!safeData || !/^[A-Za-z0-9+/=]+$/.test(safeData)) {
                errors.push('Nachweis-Daten konnten nicht gelesen werden');
            }

            if (!Number.isFinite(safeSize) || safeSize <= 0 || safeSize > 5 * 1024 * 1024) {
                errors.push('Nachweis darf maximal 5 MB groß sein');
            }
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validierungsfehler',
            errors
        });
    }

    // Use normalized values downstream to avoid duplicate checks with different casing/whitespace.
    req.body.name = name;
    req.body.discord = discord.toLowerCase();
    req.body.age = ageNum;
    req.body.experience = experience;
    req.body.motivation = motivation;
    req.body.evidence = evidence || null;

    next();
}

/**
 * Validiert Admin Login
 */
export function validateLogin(req, res, next) {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const errors = [];

    if (!username || username.trim().length < 3) {
        errors.push('Username muss mindestens 3 Zeichen lang sein');
    }

    if (!password || password.length < 6) {
        errors.push('Passwort muss mindestens 6 Zeichen lang sein');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validierungsfehler',
            errors
        });
    }

    req.body.username = username;
    req.body.password = password;

    next();
}
