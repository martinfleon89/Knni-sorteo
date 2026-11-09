// API de la app KnNi (Netlify Function).
// Toda la lectura/escritura de JSONBin pasa por aquí, así la clave y la contraseña de admin
// nunca llegan al navegador.
//
// Variables de entorno (Netlify → Site configuration → Environment variables):
//   JSONBIN_BIN_ID      ID del bin (ej: 6aed9aa3ac6210605a71b12b)
//   JSONBIN_KEY         Clave de JSONBin (recomendado: Access Key con permisos Read + Update del bin)
//   JSONBIN_KEY_HEADER  "X-Access-Key" si usas Access Key (por defecto: "X-Master-Key")
//   ADMIN_PASSWORD      Contraseña de administrador
//   TOKEN_SECRET        Texto largo y aleatorio para firmar las sesiones de admin

import crypto from 'node:crypto';

export const config = { path: '/api' };

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const MAX_CLAIMS = 200;
const EVENTS = ['CS', 'DS'];
const TEAMS = ['Equipo A', 'Equipo B'];
const ROLES = ['Titular', 'Suplente'];
const TROOPS = ['Tank', 'Air', 'Missile'];
const REG_KEYS = EVENTS.flatMap(ev => TEAMS.map(t => `${ev} - ${t}`));

const DEFAULT_NAMES = [
    "Acerofd", "Albee3609", "ALEXG", "Allpau", "Army Moonlight", "Arturo H1234", "AspeřMaster23", "AxiE",
    "B1G BOSS", "BADA Lodu", "Bahrok", "Bales117", "Betty1010", "BobB53", "BobGio밥지오", "boom boy", "Borvey", "Brokeback Hooty", "B3ngel",
    "Captain Zverman", "chhota lodu", "Cokeafgano", "Countryguy", "CP6964", "Cristophoros", "CSH SKYBLUE555",
    "Danos SR", "Darkina", "DarkZeru", "Darth Grizzly", "DaveyCrocket44", "DaViS", "DBrad11", "Defiant One", "Deroga da Grinch", "Destinuke", "DF66", "Drsimibelico",
    "Geovane rech", "Getting by", "Giobob2", "gossipGirl", "Góòse", "GUNNER39", "Gensis",
    "HackChop", "Hexina", "HUEVO FIGHTER",
    "Inflightpro44", "itsmeJJ",
    "Jack meHoff", "Jamesson45891", "JeanPierre08", "JestFatality", "JOAT79", "JP AH", "JP1351", "Jungle20",
    "KillB", "KillïnPïxîeDuśt", "KnNi Mert", "Kopa 빨간색",
    "LightIna", "LuckStrayker",
    "MADDOG 1856", "MelRose", "Mia2424", "MPK Buff", "Musky78",
    "ottotank",
    "Pepperspray69", "Phlyn",
    "Ricknick", "RimMER", "RLP castle", "RTAlejandro", "RUNTZ", "RW 1Too345",
    "San Guillermo", "SaRgeReApEr", "shoo merito", "spal4", "spirit xx",
    "낭만용사Maquina", "TartanTerror", "tavo20", "TheEnforcer77", "TheRealBetty", "Th3 Lil Effin Go4t", "tornillo90", "Turbonovtec", "TwannaJ",
    "WillDW", "WilliamDOTJames", "XLeo26"
];

class ApiError extends Error {
    constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; this.extra = extra; }
}

function env(name, fallback) {
    const v = process.env[name];
    return v === undefined || v === '' ? fallback : v;
}

// ---------- JSONBin ----------
function binUrl() {
    const id = env('JSONBIN_BIN_ID');
    if (!id || !env('JSONBIN_KEY')) throw new ApiError('server_misconfigured', 500);
    return `https://api.jsonbin.io/v3/b/${id}`;
}
function binHeaders() {
    return { [env('JSONBIN_KEY_HEADER', 'X-Master-Key')]: env('JSONBIN_KEY'), 'Content-Type': 'application/json' };
}

async function readState() {
    const res = await fetch(`${binUrl()}/latest`, { headers: binHeaders(), cache: 'no-store' });
    if (!res.ok) throw new ApiError('storage_error', 502);
    const json = await res.json();
    return normalizeState(json.record || {});
}

async function writeState(state) {
    const res = await fetch(binUrl(), { method: 'PUT', headers: binHeaders(), body: JSON.stringify(state) });
    if (!res.ok) throw new ApiError('storage_error', 502);
}

function normalizeState(r) {
    return {
        historyData: Array.isArray(r.historyData) ? r.historyData : [],
        trainConfig: { driver: '---', vip: '---', arrival: '21:30 hs', discord: 'https://discord.gg/TU_ENLACE_DE_DISCORD', ...(r.trainConfig || {}) },
        mvpConfig: { week: '---', champion: '---', ds1: '---', ds2: '---', cs1: '---', cs2: '---', ...(r.mvpConfig || {}) },
        allianceNames: Array.isArray(r.allianceNames) && r.allianceNames.length > 0 ? r.allianceNames : [...DEFAULT_NAMES],
        powersData: r.powersData && typeof r.powersData === 'object' ? r.powersData : {},
        registrations: r.registrations && typeof r.registrations === 'object' ? r.registrations : {},
        suspendedEvents: { CS: false, DS: false, ...(r.suspendedEvents || {}) },
        claimsData: Array.isArray(r.claimsData) ? r.claimsData : [],
    };
}

// Lo que ve cada usuario: los reclamos solo los ve el admin.
function viewFor(state, admin) {
    const { claimsData, ...rest } = state;
    return admin ? state : rest;
}

// ---------- Sesión de admin ----------
function sign(value) {
    return crypto.createHmac('sha256', env('TOKEN_SECRET', '')).update(value).digest('hex');
}
function safeEqual(a, b) {
    const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function createToken() {
    const exp = String(Date.now() + TOKEN_TTL_MS);
    return `${exp}.${sign(exp)}`;
}
function isValidToken(token) {
    if (!token || !env('TOKEN_SECRET')) return false;
    const [exp, sig] = String(token).split('.');
    if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
    return Number(exp) > Date.now();
}
function tokenFrom(req) {
    const h = req.headers.get('authorization') || '';
    return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// ---------- Validación ----------
function text(v, max, { required = true } = {}) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (required && !s) throw new ApiError('invalid');
    return s.slice(0, max);
}
function oneOf(v, list) {
    if (!list.includes(v)) throw new ApiError('invalid');
    return v;
}
function memberName(state, v) {
    const name = text(v, 60).toLowerCase();
    const found = state.allianceNames.find(n => n.toLowerCase() === name);
    if (!found) throw new ApiError('unknown_member');
    return found;
}

// Horario del servidor del juego: UTC-2. Misma lógica que muestra la página.
function isEventOpen(ev, now = new Date()) {
    const d = new Date(now.getTime() - 2 * 3600000);
    const h = d.getUTCDay() * 24 + d.getUTCHours() + d.getUTCMinutes() / 60;
    if (ev === 'CS') return h >= 120 || h < 35;
    if (ev === 'DS') return h >= 144 || h < 83;
    return false;
}
function assertCanRegister(state, ev, admin) {
    if (admin) return;
    if (state.suspendedEvents[ev] || !isEventOpen(ev)) throw new ApiError('closed', 409);
}

function findTeam(state, ev, name) {
    const target = name.toLowerCase();
    return TEAMS.find(t => (state.registrations[`${ev} - ${t}`] || []).some(i => String(i.name).toLowerCase() === target)) || null;
}

// ---------- Acciones ----------
const publicActions = {
    register(state, p, admin) {
        const ev = oneOf(p.event, EVENTS);
        const team = oneOf(p.team, TEAMS);
        const role = oneOf(p.role, ROLES);
        const name = memberName(state, p.name);
        assertCanRegister(state, ev, admin);
        const existing = findTeam(state, ev, name);
        if (existing) throw new ApiError('duplicate', 409, { team: existing });
        const key = `${ev} - ${team}`;
        state.registrations[key] = [...(state.registrations[key] || []), { name, role }];
    },

    cancel(state, p, admin) {
        const ev = oneOf(p.event, EVENTS);
        const name = memberName(state, p.name);
        assertCanRegister(state, ev, admin);
        if (!findTeam(state, ev, name)) throw new ApiError('not_registered', 404);
        for (const t of TEAMS) {
            const key = `${ev} - ${t}`;
            if (state.registrations[key]) state.registrations[key] = state.registrations[key].filter(i => String(i.name).toLowerCase() !== name.toLowerCase());
        }
    },

    claim(state, p) {
        if (state.claimsData.length >= MAX_CLAIMS) throw new ApiError('inbox_full', 429);
        state.claimsData.push({
            id: Date.now() * 1000 + crypto.randomInt(1000),
            name: text(p.name, 40),
            event: oneOf(p.event, ['CS', 'DS', 'Both']),
            reason: text(p.reason, 500),
            date: new Date().toISOString(),
        });
    },

    updatePower(state, p) {
        const name = memberName(state, p.name);
        const field = oneOf(p.field, ['m1', 'm2', 'm3', 'troop']);
        let value;
        if (field === 'troop') value = oneOf(p.value, TROOPS);
        else {
            value = text(p.value, 10, { required: false }) || '00.00';
            if (!/^[0-9]+([.,][0-9]+)?$/.test(value)) throw new ApiError('invalid');
        }
        state.powersData[name] = { m1: '00.00', m2: '00.00', m3: '00.00', troop: 'Tank', ...(state.powersData[name] || {}), [field]: value };
    },
};

const adminActions = {
    toggleSuspend(state, p) {
        const ev = oneOf(p.event, EVENTS);
        state.suspendedEvents[ev] = !state.suspendedEvents[ev];
    },

    removeReg(state, p) {
        const key = oneOf(p.key, REG_KEYS);
        const list = state.registrations[key] || [];
        const idx = list.findIndex(i => i.name === p.name);
        if (idx === -1) throw new ApiError('not_found', 404);
        list.splice(idx, 1);
    },

    deleteClaim(state, p) {
        state.claimsData = state.claimsData.filter(c => c.id !== p.id);
    },

    addMember(state, p) {
        const name = text(p.name, 40);
        if (state.allianceNames.some(n => n.toLowerCase() === name.toLowerCase())) throw new ApiError('exists', 409);
        state.allianceNames.push(name);
        state.allianceNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        state.powersData[name] = { m1: '00.00', m2: '00.00', m3: '00.00', troop: 'Tank' };
    },

    deleteMember(state, p) {
        const name = memberName(state, p.name);
        state.allianceNames = state.allianceNames.filter(n => n !== name);
        delete state.powersData[name];
    },

    addHistory(state, p) {
        state.historyData.push({
            id: Date.now(),
            Date: text(p.date, 30),
            Driver: text(p.driver, 60),
            VIP: text(p.vip, 60),
            Config: 'Sorteo Divino',
        });
    },

    deleteHistory(state, p) {
        const idx = state.historyData.findIndex(h => p.id
            ? String(h.id) === String(p.id)
            : (h.Date === p.date && h.Driver === p.driver && h.VIP === p.vip));
        if (idx === -1) throw new ApiError('not_found', 404);
        state.historyData.splice(idx, 1);
    },

    saveTrain(state, p) {
        const arrival = text(p.arrival, 5, { required: false });
        if (arrival && !/^\d{2}:\d{2}$/.test(arrival)) throw new ApiError('invalid');
        state.trainConfig = {
            ...state.trainConfig,
            driver: text(p.driver, 60, { required: false }) || '---',
            vip: text(p.vip, 60, { required: false }) || '---',
            arrival: `${arrival || '21:30'} hs`,
        };
    },

    saveDiscord(state, p) {
        const url = text(p.url, 200);
        let u;
        try { u = new URL(url); } catch { throw new ApiError('bad_url'); }
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ApiError('bad_url');
        state.trainConfig = { ...state.trainConfig, discord: u.href };
    },

    saveMvp(state, p) {
        const f = k => text(p[k], 60, { required: false }) || '---';
        state.mvpConfig = { week: f('week'), champion: f('champion'), ds1: f('ds1'), ds2: f('ds2'), cs1: f('cs1'), cs2: f('cs2') };
    },
};

// ---------- Entrada ----------
function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async function handler(req) {
    try {
        const admin = isValidToken(tokenFrom(req));

        if (req.method === 'GET') {
            return json({ ok: true, admin, state: viewFor(await readState(), admin) });
        }
        if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

        let body;
        try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid' }, 400); }
        const action = body && body.action;

        if (action === 'login') {
            const expected = env('ADMIN_PASSWORD');
            if (!expected || !env('TOKEN_SECRET')) throw new ApiError('server_misconfigured', 500);
            if (typeof body.password !== 'string' || !safeEqual(body.password, expected)) {
                await new Promise(r => setTimeout(r, 800)); // frena intentos por fuerza bruta
                return json({ ok: false, error: 'bad_password' }, 401);
            }
            return json({ ok: true, token: createToken() });
        }

        const fn = publicActions[action] || adminActions[action];
        if (!fn) return json({ ok: false, error: 'unknown_action' }, 400);
        if (adminActions[action] && !admin) return json({ ok: false, error: 'unauthorized' }, 401);

        // Leer lo último → aplicar el cambio → guardar. Todo en el servidor.
        const state = await readState();
        try {
            fn(state, body, admin);
        } catch (err) {
            if (err instanceof ApiError) return json({ ok: false, error: err.code, ...err.extra, state: viewFor(state, admin) }, err.status);
            throw err;
        }
        await writeState(state);
        return json({ ok: true, state: viewFor(state, admin) });
    } catch (err) {
        if (err instanceof ApiError) return json({ ok: false, error: err.code }, err.status);
        console.error(err);
        return json({ ok: false, error: 'server_error' }, 500);
    }
}
