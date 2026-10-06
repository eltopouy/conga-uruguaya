// js/firebasemanager.js
// Gestor de Multijugador en Tiempo Real para Conga Uruguaya usando Firebase Realtime Database

const firebaseConfig = {
    apiKey: "AIzaSyDm0Je0uB5ejXh5e9ZCApWQBBQgbVyPigI",
    authDomain: "truco-25629.firebaseapp.com",
    databaseURL: "https://truco-25629-default-rtdb.firebaseio.com",
    projectId: "truco-25629",
    storageBucket: "truco-25629.firebasestorage.app",
    messagingSenderId: "828862963964",
    appId: "1:828862963964:web:c505946d1e30420af23779"
};

let db = null;
if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = (typeof firebase.database === 'function') ? firebase.database() : null;
        console.log("🔥 Firebase Conga Conectado con éxito");
    } catch (e) {
        console.warn("Inicialización de Firebase:", e);
    }
}

let miRol = null; // 'creador' | 'invitado'
let miSeat = 0;   // 0, 1, 2, 3
let codigoSalaActual = null;
let roomRef = null;
let heartbeatInterval = null;

function generarCodigoSala() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "CG-";
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const FirebaseManager = {
    isAvailable: () => !!db,

    // Escuchar salas públicas en el lobby
    escucharSalasPublicas: (callback) => {
        if (!db) return;
        db.ref('salas').orderByChild('estado').equalTo('esperando').on('value', (snap) => {
            const salas = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const data = child.val();
                    if (data && data.publica && data.juego === 'conga') {
                        salas.push({ id: child.key, ...data });
                    }
                });
            }
            callback(salas);
        });
    },

    // Crear Sala Online (Host / Creador)
    crearSala: async (nombreHost, maxJugadores = 2, publica = true, config = {}) => {
        if (!db) throw new Error("Firebase no disponible");
        const codigo = generarCodigoSala();
        codigoSalaActual = codigo;
        miRol = 'creador';
        miSeat = 0;

        roomRef = db.ref(`salas/${codigo}`);

        const salaData = {
            juego: 'conga',
            codigo,
            creador: nombreHost,
            maxJugadores,
            publica,
            estado: 'esperando',
            creadaEn: Date.now(),
            config: {
                limitePuntos: config.limitePuntos || 100,
                deckSize: config.deckSize || 48,
                conComodines: config.conComodines !== false,
                limiteCorte: config.limiteCorte || 5,
                permitirReenganche: config.permitirReenganche !== false
            },
            jugadores: [
                { seat: 0, name: nombreHost, id: 'host_' + Date.now(), ready: true }
            ]
        };

        await roomRef.set(salaData);
        try {
            roomRef.onDisconnect().update({ estado: 'finalizado' });
        } catch (_) {}
        window.FirebaseManager._iniciarHeartbeat(codigo);
        return { codigo, seat: 0 };
    },

    // Unirse a Sala Online (Invitado)
    unirseSala: async (codigo, nombreJugador) => {
        if (!db) throw new Error("Firebase no disponible");
        codigo = (codigo || '').trim().toUpperCase();
        const ref = db.ref(`salas/${codigo}`);
        const snap = await ref.once('value');

        if (!snap.exists()) {
            throw new Error("La sala no existe o el código es incorrecto.");
        }

        const sala = snap.val();
        if (sala.estado !== 'esperando') {
            throw new Error("La partida ya está en curso o finalizó.");
        }

        const jugadores = sala.jugadores || [];
        if (jugadores.length >= sala.maxJugadores) {
            throw new Error("La sala está llena.");
        }

        const nuevoSeat = jugadores.length;
        jugadores.push({
            seat: nuevoSeat,
            name: nombreJugador,
            id: 'guest_' + Date.now(),
            ready: true
        });

        await ref.update({ jugadores });

        codigoSalaActual = codigo;
        miRol = 'invitado';
        miSeat = nuevoSeat;
        roomRef = ref;

        window.FirebaseManager._iniciarHeartbeat(codigo);
        return { codigo, seat: nuevoSeat, sala };
    },

    // Iniciar Partida (Solo Creador cuando se llena o decide)
    iniciarPartidaOnline: async (engine) => {
        if (miRol !== 'creador' || !roomRef) return;

        engine.configurarPartida(engine.numJugadores);

        await roomRef.update({
            estado: 'jugando',
            iniciadaEn: Date.now()
        });

        window.FirebaseManager.sincronizarEstado(engine);
    },

    // Sincronizar Estado del Motor a Firebase con Anti-Cheat
    sincronizarEstado: async (engine) => {
        if (miRol !== 'creador' || !roomRef) return;

        const snapEngine = {
            rondaActual: engine.rondaActual,
            turnoSeat: engine.turnoSeat,
            fase: engine.fase,
            deckCount: engine.deck.length,
            topDiscard: engine.discardPile.length > 0 ? engine.discardPile[engine.discardPile.length - 1] : null,
            discardPile: engine.discardPile,
            ultimoCortador: engine.ultimoCortador,
            resultadoRonda: engine.resultadoRonda,
            partidoFinalizado: engine.partidoFinalizado,
            ganadorPartido: engine.ganadorPartido,
            ts: Date.now(),
            // Manos de los jugadores:
            // Si la ronda está activa, los invitados reciben solo el número de cartas y sus cartas reales se transmiten
            // sólo a su asiento correspondiente
            players: engine.players.map(p => ({
                seat: p.seat,
                name: p.name,
                puntosAcumulados: p.puntosAcumulados,
                eliminado: p.eliminado,
                reenganches: p.reenganches,
                cardCount: p.hand.length,
                puntosSueltos: p.puntosSueltos,
                // Al terminar la ronda se revelan las cartas de todos; mientras tanto, se guardan en el servidor
                hand: (engine.fase === 'fin_ronda' || engine.partidoFinalizado) ? p.hand : p.hand,
                melds: (engine.fase === 'fin_ronda') ? p.melds : [],
                unmelded: (engine.fase === 'fin_ronda') ? p.unmelded : []
            }))
        };

        await roomRef.child('estadoJuego').set(snapEngine);
    },

    // Enviar Acción del Jugador (Robar, Descartar, Cortar, Chat)
    enviarAccion: (tipo, payload = {}) => {
        if (!roomRef) return;
        const accion = {
            tipo,
            seat: miSeat,
            payload,
            ts: Date.now()
        };
        roomRef.child('acciones').push(accion);
    },

    // Escuchar Eventos de la Sala en Tiempo Real
    escucharSala: (onEstadoUpdated, onAccionRecibida) => {
        if (!roomRef) return;

        // Escuchar cambios de estado general de la sala y jugadores
        roomRef.on('value', (snap) => {
            if (!snap.exists()) return;
            const data = snap.val();
            if (onEstadoUpdated) onEstadoUpdated(data);
        });

        // Escuchar acciones entrantes (Host las procesa; Invitados reciben efectos)
        roomRef.child('acciones').limitToLast(1).on('child_added', (snap) => {
            if (!snap.exists()) return;
            const accion = snap.val();
            if (onAccionRecibida) onAccionRecibida(accion);
        });
    },

    _iniciarHeartbeat: (codigo) => {
        clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (roomRef && db) {
                roomRef.child(`heartbeats/${miSeat}`).set(Date.now()).catch(() => {});
            }
        }, 8000);
    },

    desconectar: () => {
        clearInterval(heartbeatInterval);
        if (roomRef) {
            if (miRol === 'creador') {
                roomRef.update({ estado: 'finalizado' }).catch(() => {});
            }
            roomRef.off();
            roomRef = null;
        }
        codigoSalaActual = null;
        miRol = null;
    }
};

if (typeof window !== 'undefined') {
    window.FirebaseManager = FirebaseManager;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FirebaseManager };
}
