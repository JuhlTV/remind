export const ROLE_DEFINITIONS = {
    website_owner: {
        label: 'Website Owner',
        rank: 100,
        permissions: [
            'applications.read',
            'applications.review',
            'applications.delete',
            'stats.read',
            'admins.read',
            'admins.create',
            'admins.assign_roles'
        ]
    },
    projektleitung: {
        label: 'Projektleitung',
        rank: 80,
        permissions: [
            'applications.read',
            'applications.review',
            'applications.delete',
            'stats.read',
            'admins.read',
            'admins.create',
            'admins.assign_roles'
        ]
    },
    hr_manager: {
        label: 'HR Manager',
        rank: 60,
        permissions: [
            'applications.read',
            'applications.review',
            'stats.read',
            'admins.read',
            'admins.create'
        ]
    },
    reviewer: {
        label: 'Reviewer',
        rank: 40,
        permissions: [
            'applications.read',
            'applications.review'
        ]
    },
    analyst: {
        label: 'Analyst',
        rank: 30,
        permissions: ['stats.read']
    },
    observer: {
        label: 'Observer',
        rank: 20,
        permissions: ['applications.read']
    },
    support: {
        label: 'Support',
        rank: 10,
        permissions: ['applications.read']
    }
};

const DEFAULT_ROLE_META = {
    label: 'Unbekannt',
    rank: 0,
    permissions: []
};

export const PERMISSION_LABELS = {
    'applications.read': 'Bewerbungen lesen',
    'applications.review': 'Bewerbungen bewerten',
    'applications.delete': 'Bewerbungen loeschen',
    'stats.read': 'Statistiken sehen',
    'admins.read': 'Admins einsehen',
    'admins.create': 'Admins erstellen',
    'admins.assign_roles': 'Rollen zuweisen'
};

export const PERMISSION_ORDER = [
    'applications.read',
    'applications.review',
    'applications.delete',
    'stats.read',
    'admins.read',
    'admins.create',
    'admins.assign_roles'
];

export function isValidRole(role) {
    return Object.prototype.hasOwnProperty.call(ROLE_DEFINITIONS, role);
}

export function getPermissionsForRole(role) {
    return ROLE_DEFINITIONS[role]?.permissions || [];
}

export function getRoleMeta(role) {
    return ROLE_DEFINITIONS[role] || {
        ...DEFAULT_ROLE_META,
        label: role
    };
}

export function getRoleRank(role) {
    return getRoleMeta(role).rank;
}

export function canManageRole(actorRole, targetRole) {
    if (actorRole === 'website_owner') {
        return true;
    }

    return getRoleRank(actorRole) > getRoleRank(targetRole);
}

export function listRoles() {
    return Object.entries(ROLE_DEFINITIONS)
        .sort(([, a], [, b]) => b.rank - a.rank)
        .map(([key, value]) => ({
            key,
            label: value.label,
            rank: value.rank,
            permissions: value.permissions
        }));
}

export function getRoleMatrix() {
    return {
        permissions: PERMISSION_ORDER.map(permission => ({
            key: permission,
            label: PERMISSION_LABELS[permission] || permission
        })),
        roles: listRoles()
    };
}
