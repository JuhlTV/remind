/**
 * Validiert Bewerbungsformular
 */
export function validateApplication(req, res, next) {
    const { name, discord, age, experience, motivation } = req.body;
    const errors = [];

    // Name validieren
    if (!name || name.trim().length < 2) {
        errors.push('Name muss mindestens 2 Zeichen lang sein');
    }
    if (name && name.length > 100) {
        errors.push('Name darf maximal 100 Zeichen lang sein');
    }

    // Discord validieren
    if (!discord || discord.trim().length < 3) {
        errors.push('Discord Tag muss mindestens 3 Zeichen lang sein');
    }
    if (discord && !/^.+#\d{4}$/.test(discord) && !/^[a-zA-Z0-9_]{3,32}$/.test(discord)) {
        // Erlaubt sowohl altes Format (Name#1234) als auch neues Format (Nutzername)
        console.warn(`Discord Format: ${discord} - wird akzeptiert`);
    }

    // Alter validieren
    const ageNum = parseInt(age);
    if (!age || isNaN(ageNum) || ageNum < 13) {
        errors.push('Du musst mindestens 13 Jahre alt sein');
    }
    if (ageNum > 120) {
        errors.push('Bitte gib ein realistisches Alter ein');
    }

    // Erfahrung validieren
    if (!experience || experience.trim().length < 10) {
        errors.push('Erfahrung muss mindestens 10 Zeichen lang sein');
    }
    if (experience && experience.length > 500) {
        errors.push('Erfahrung darf maximal 500 Zeichen lang sein');
    }

    // Motivation validieren
    if (!motivation || motivation.trim().length < 20) {
        errors.push('Motivation muss mindestens 20 Zeichen lang sein');
    }
    if (motivation && motivation.length > 2000) {
        errors.push('Motivation darf maximal 2000 Zeichen lang sein');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validierungsfehler',
            errors
        });
    }

    next();
}

/**
 * Validiert Admin Login
 */
export function validateLogin(req, res, next) {
    const { username, password } = req.body;
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

    next();
}
