// js/app.js
// Controlador Principal de Interfaz y Flujo de Juego para Conga Uruguaya

let engine = new CongaEngine();
let bot = new CongaBot('normal');
let sound = new SoundManager();
window.engine = engine;
window.sound = sound;

let modoJuego = 'singleplayer'; // 'singleplayer' | 'multiplayer'
let miSeat = 0;
let miRol = 'creador'; // 'creador' | 'invitado'
let selectedCardIndex = null;
let autoAdvanceInterval = null;
let isBotThinking = false;
let lastCardTapTracker = { cardId: null, timestamp: 0 };

Object.defineProperty(window, 'miSeat', {
    get: () => miSeat,
    set: (val) => { miSeat = val; },
    configurable: true
});
Object.defineProperty(window, 'modoJuego', {
    get: () => modoJuego,
    set: (val) => { modoJuego = val; },
    configurable: true
});
Object.defineProperty(window, 'miRol', {
    get: () => miRol,
    set: (val) => { miRol = val; },
    configurable: true
});

// Helpers de sonido
function playSound(name) {
    if (sound) sound.play(name);
}

// -------------------------------------------------------------
// INICIALIZACIÓN Y CONFIGURACIÓN (GESTIÓN DE APODO ESTILO POKER)
// -------------------------------------------------------------
function getPlayerNickname() {
    let name = engine.config.nombreJugador;
    try {
        const stored = localStorage.getItem('conga_nickname');
        if (stored && stored.trim()) name = stored.trim();
    } catch(e) {}
    if (!name || name.trim() === '' || name.trim().toUpperCase() === 'TÚ') {
        return 'TÚ';
    }
    return name.trim();
}

function setPlayerNickname(newName) {
    if (!newName) return;
    const clean = newName.trim();
    if (!clean) return;
    engine.config.nombreJugador = clean;
    try {
        localStorage.setItem('conga_nickname', clean);
        const saved = localStorage.getItem('conga_config');
        const cfg = saved ? JSON.parse(saved) : {};
        cfg.nombreJugador = clean;
        localStorage.setItem('conga_config', JSON.stringify(cfg));
    } catch(e) {}

    // Sincronizar todos los inputs en la UI
    ['input-lobby-nombre', 'input-crear-nombre', 'input-unirse-nombre', 'cfg-nombre'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value !== clean) el.value = clean;
    });

    if (engine && engine.players && engine.players[miSeat]) {
        engine.players[miSeat].name = clean;
    }
}

function cargarConfigLocal() {
    try {
        let nick = localStorage.getItem('conga_nickname');
        const saved = localStorage.getItem('conga_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            engine.config = { ...engine.config, ...parsed };
            if (!nick && parsed.nombreJugador) nick = parsed.nombreJugador;
        }
        if (nick && nick.trim()) {
            engine.config.nombreJugador = nick.trim();
        } else if (!engine.config.nombreJugador) {
            engine.config.nombreJugador = 'TÚ';
        }

        const currentNick = engine.config.nombreJugador;
        ['input-lobby-nombre', 'input-crear-nombre', 'input-unirse-nombre', 'cfg-nombre'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = currentNick;
        });

        const cfgLim = document.getElementById('cfg-limite-puntos');
        const cfgDeck = document.getElementById('cfg-deck-size');
        const cfgJokers = document.getElementById('cfg-comodines');
        const cfgSound = document.getElementById('cfg-sonido');
        const cfgPoints = document.getElementById('cfg-mostrar-puntos');
        if (cfgLim) cfgLim.value = engine.config.limitePuntos || 100;
        if (cfgDeck) cfgDeck.value = engine.config.deckSize || 48;
        if (cfgJokers) cfgJokers.checked = engine.config.conComodines !== false;
        if (cfgSound) cfgSound.checked = !sound.muted;
        if (cfgPoints) cfgPoints.checked = engine.config.mostrarPuntosCartas === true;
    } catch (e) {}
}

function guardarConfigLocal() {
    try {
        const cfgName = document.getElementById('cfg-nombre').value.trim() || 'TÚ';
        const cfgLim = parseInt(document.getElementById('cfg-limite-puntos').value) || 100;
        const cfgDeck = parseInt(document.getElementById('cfg-deck-size').value) || 48;
        const cfgJokers = document.getElementById('cfg-comodines').checked;
        const cfgSound = document.getElementById('cfg-sonido').checked;
        const cfgPoints = document.getElementById('cfg-mostrar-puntos') ? document.getElementById('cfg-mostrar-puntos').checked : false;

        setPlayerNickname(cfgName);
        engine.config.limitePuntos = cfgLim;
        engine.config.deckSize = cfgDeck;
        engine.config.conComodines = cfgJokers;
        engine.config.mostrarPuntosCartas = cfgPoints;
        sound.setMuted(!cfgSound);

        localStorage.setItem('conga_config', JSON.stringify({
            nombreJugador: cfgName,
            limitePuntos: cfgLim,
            deckSize: cfgDeck,
            conComodines: cfgJokers,
            mostrarPuntosCartas: cfgPoints
        }));

        cerrarModal('modal-config');
        if (engine.players[miSeat]) engine.players[miSeat].name = cfgName;
        renderJuego();
    } catch (e) {}
}

// -------------------------------------------------------------
// INICIO DE PARTIDAS
// -------------------------------------------------------------
window.iniciarSolo = function(numJugadores = 2) {
    modoJuego = 'singleplayer';
    miSeat = 0;
    miRol = 'creador';
    selectedCardIndex = null;
    ocultarBotonSiguienteMano();

    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.style.display = 'none';

    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) btnSalir.style.display = 'block';

    engine.configurarPartida(numJugadores);
    playSound('shuffle');

    renderJuego();

    // Si el primer turno le corresponde a un bot
    verificarTurnoBot();
};

function salirAlLobby() {
    if (modoJuego === 'multiplayer' && window.FirebaseManager) {
        window.FirebaseManager.desconectar();
    }
    ocultarBotonSiguienteMano();
    isBotThinking = false;
    engine.partidoIniciado = false;
    selectedCardIndex = null;
    modoJuego = 'singleplayer';
    miSeat = 0;
    miRol = 'creador';
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('btn-salir').style.display = 'none';
    document.getElementById('room-code-tag').style.display = 'none';
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// -------------------------------------------------------------
// CONTROLADOR DE TURNO DEL BOT
// -------------------------------------------------------------
async function verificarTurnoBot() {
    if (modoJuego === 'multiplayer' && miRol !== 'creador') return;
    if (!engine || !engine.partidoIniciado || engine.fase === 'fin_ronda' || engine.partidoFinalizado) return;

    const currentSeat = engine.turnoSeat;
    const currentPlayer = engine.players[currentSeat];
    const sessionToken = engine.partidaToken;

    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.eliminado) return;
    if (isBotThinking) return;

    isBotThinking = true;
    renderJuego();

    // Tiempo de pensamiento natural (1s - 1.5s)
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 400));
    if (!engine || !engine.partidoIniciado || engine.partidaToken !== sessionToken || (modoJuego === 'multiplayer' && miRol !== 'creador')) {
        isBotThinking = false;
        return;
    }

    // 1. Paso 1: Robar (Mazo o Pozo)
    if (engine.fase === 'robar' && engine.turnoSeat === currentSeat) {
        const decisionRobo = bot.decidirRobo(engine, currentSeat);
        if (decisionRobo === 'pozo') {
            engine.robarPozo(currentSeat);
            playSound('card-draw');
        } else {
            const robada = engine.robarMazo(currentSeat);
            if (robada) playSound('card-draw');
        }

        // Si el robo causó el agotamiento definitivo del mazo
        if (engine.fase === 'fin_ronda') {
            isBotThinking = false;
            if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
            mostrarModalFinRonda();
            return;
        }

        if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
        renderJuego();
    }

    // Tiempo de decisión para el descarte
    await new Promise(r => setTimeout(r, 900 + Math.random() * 350));
    if (!engine || !engine.partidoIniciado || engine.partidaToken !== sessionToken || (modoJuego === 'multiplayer' && miRol !== 'creador')) {
        isBotThinking = false;
        return;
    }

    // 2. Paso 2: Descartar o Cortar
    if (engine.fase === 'descartar' && engine.turnoSeat === currentSeat) {
        const jugada = bot.decidirJugadaDescarte(engine, currentSeat);
        if (jugada) {
            if (jugada.cortar && engine.puedeCortar(currentSeat, jugada.cardIndex)) {
                // El bot CORTA la ronda
                isBotThinking = false;
                iniciarFaseAcomodoUI(currentSeat, jugada.cardIndex);
                return;
            }
            // Descarte normal
            let discardRes = engine.descartarCarta(currentSeat, jugada.cardIndex);
            if (!discardRes && currentPlayer.hand) {
                // Fallback de resiliencia: descartar cualquier carta permitida de la mano
                for (let k = 0; k < currentPlayer.hand.length; k++) {
                    discardRes = engine.descartarCarta(currentSeat, k);
                    if (discardRes) break;
                }
            }
            if (discardRes) {
                playSound('card-discard');
                if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
            }
        }
    }

    isBotThinking = false;
    renderJuego();

    // Si el siguiente turno también es de un bot
    setTimeout(() => {
        if (engine && engine.partidaToken === sessionToken) {
            verificarTurnoBot();
        }
    }, 400);
}

// -------------------------------------------------------------
// ADAPTACIÓN Y ESCALADO DINÁMICO POR RESOLUCIÓN
// -------------------------------------------------------------
function ajustarEscalaResponsiva() {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth || document.documentElement.clientWidth || 1024;
    const h = window.innerHeight || document.documentElement.clientHeight || 768;
    const root = document.documentElement;

    let cardW, cardH, cardOverlap, handH;
    let pileW, pileH;
    let oppCardW, oppCardH, oppCardOverlap;
    let bannerFontSize, toolbarBtnPad, btnFontSize;

    if (w >= 1400 && h >= 780) {
        // Pantallas Grandes y Desktop Full HD (1080p, 1440p, 4K)
        cardW = 142;
        cardH = 210;
        cardOverlap = -22;
        handH = 225;
        pileW = 120;
        pileH = 178;
        oppCardW = 40;
        oppCardH = 58;
        oppCardOverlap = -18;
        bannerFontSize = '1rem';
        toolbarBtnPad = '11px 20px';
        btnFontSize = '1rem';
    } else if (w >= 1050 && h >= 680) {
        // Laptops de 1366x768 / Escritorios medianos
        cardW = 128;
        cardH = 190;
        cardOverlap = -18;
        handH = 205;
        pileW = 110;
        pileH = 162;
        oppCardW = 35;
        oppCardH = 51;
        oppCardOverlap = -15;
        bannerFontSize = '0.95rem';
        toolbarBtnPad = '10px 18px';
        btnFontSize = '0.95rem';
    } else if (w >= 800 && h >= 600) {
        // Tablets y laptops compactas
        cardW = 114;
        cardH = 168;
        cardOverlap = -16;
        handH = 180;
        pileW = 98;
        pileH = 145;
        oppCardW = 30;
        oppCardH = 44;
        oppCardOverlap = -13;
        bannerFontSize = '0.92rem';
        toolbarBtnPad = '9px 15px';
        btnFontSize = '0.9rem';
    } else if (h < 600 && w >= 600) {
        // Modo horizontal en pantallas de baja altura (Landscape móvil / Notebook baja)
        cardH = Math.max(96, Math.min(145, Math.round(h * 0.22)));
        cardW = Math.round(cardH / 1.48);
        cardOverlap = -12;
        handH = cardH + 12;
        pileH = Math.max(82, Math.min(125, Math.round(h * 0.19)));
        pileW = Math.round(pileH / 1.48);
        oppCardH = Math.max(28, Math.min(38, Math.round(h * 0.058)));
        oppCardW = Math.round(oppCardH / 1.48);
        oppCardOverlap = -10;
        bannerFontSize = '0.82rem';
        toolbarBtnPad = '6px 12px';
        btnFontSize = '0.82rem';
    } else if (w <= 600) {
        // Móviles en vertical
        cardW = Math.max(72, Math.min(92, Math.round(w * 0.185)));
        cardH = Math.round(cardW * 1.48);
        cardOverlap = -12;
        handH = cardH + 12;
        pileW = Math.max(68, Math.min(84, Math.round(w * 0.175)));
        pileH = Math.round(pileW * 1.48);
        oppCardW = 26;
        oppCardH = 38;
        oppCardOverlap = -11;
        bannerFontSize = '0.85rem';
        toolbarBtnPad = '8px 12px';
        btnFontSize = '0.84rem';
    } else {
        // Formatos intermedios
        cardW = 104;
        cardH = 154;
        cardOverlap = -14;
        handH = 165;
        pileW = 90;
        pileH = 133;
        oppCardW = 28;
        oppCardH = 41;
        oppCardOverlap = -12;
        bannerFontSize = '0.9rem';
        toolbarBtnPad = '8px 14px';
        btnFontSize = '0.88rem';
    }

    // Asegurar que el ancho de 8 cartas quepa en la ventana sin desbordar
    const maxAnchoMano = w - 24;
    const anchoEstimado = cardW + 7 * (cardW + cardOverlap);
    if (anchoEstimado > maxAnchoMano) {
        const overlapCalculado = Math.floor((maxAnchoMano - 8 * cardW) / 7);
        cardOverlap = Math.min(-8, overlapCalculado);
    }

    root.style.setProperty('--card-w', `${cardW}px`);
    root.style.setProperty('--card-h', `${cardH}px`);
    root.style.setProperty('--card-overlap', `${cardOverlap}px`);
    root.style.setProperty('--hand-container-h', `${handH}px`);
    root.style.setProperty('--pile-w', `${pileW}px`);
    root.style.setProperty('--pile-h', `${pileH}px`);
    root.style.setProperty('--opp-card-w', `${oppCardW}px`);
    root.style.setProperty('--opp-card-h', `${oppCardH}px`);
    root.style.setProperty('--opp-card-overlap', `${oppCardOverlap}px`);
    root.style.setProperty('--banner-font-size', bannerFontSize);
    root.style.setProperty('--toolbar-btn-pad', toolbarBtnPad);
    root.style.setProperty('--btn-font-size', btnFontSize);
}

// -------------------------------------------------------------
// RENDERIZADO VISUAL DEL JUEGO
// -------------------------------------------------------------
function renderJuego() {
    ajustarEscalaResponsiva();
    if (!engine || !engine.partidoIniciado) return;

    // Si la ronda terminó (por corte o mazo agotado), asegurar que se visualicen los resultados
    if (engine.fase === 'fin_ronda') {
        const modal = document.getElementById('modal-fin-ronda');
        if (modal && modal.style.display !== 'flex') {
            mostrarModalFinRonda();
        }
    }

    const myPlayer = engine.players[miSeat];

    // GUARD: El botón de siguiente mano NUNCA debe mostrarse durante una mano activa ni tras terminar el partido
    if (engine.fase !== 'fin_ronda' || engine.partidoFinalizado) {
        ocultarBotonSiguienteMano();
    }

    // 1. Rivales (Superior)
    const oppArea = document.getElementById('opponents-area');
    if (oppArea) {
        oppArea.innerHTML = '';
        engine.players.forEach(p => {
            if (p.seat !== miSeat) {
                const badge = document.createElement('div');
                badge.className = `opponent-badge ${engine.turnoSeat === p.seat ? 'active-turn' : ''}`;
                
                let miniCardsHTML = '';
                const cardCount = p.hand.length;
                const revealCards = (engine.fase === 'acomodo' || engine.fase === 'fin_ronda');

                for (let i = 0; i < cardCount; i++) {
                    const angle = (i - (cardCount - 1) / 2) * 5;
                    const yOffset = Math.abs(i - (cardCount - 1) / 2) * 1.5;
                    if (revealCards && p.hand[i]) {
                        const c = p.hand[i];
                        const assetUrl = (typeof c.getAssetUrl === 'function') ? c.getAssetUrl() : new Carta(c.valor, c.palo, c.esComodin, c.id).getAssetUrl();
                        miniCardsHTML += `<div class="mini-card-front" style="background-image: url('${assetUrl}'); transform: rotate(${angle}deg) translateY(${yOffset}px);" title="${c.valor} de ${c.palo}"></div>`;
                    } else {
                        miniCardsHTML += `<div class="mini-card-back" style="transform: rotate(${angle}deg) translateY(${yOffset}px);"></div>`;
                    }
                }

                // Determinación limpia del nombre del rival (evita mostrar "TÚ" en la caja del oponente)
                let opponentDisplayName = p.name;
                if (!opponentDisplayName || opponentDisplayName.trim() === '' || opponentDisplayName.trim().toUpperCase() === 'TÚ') {
                    opponentDisplayName = (modoJuego === 'multiplayer') ? 'Rival' : `Bot ${p.seat === 1 ? 'Tatú' : (p.seat === 2 ? 'Gaucho' : 'Pampero')}`;
                }

                badge.innerHTML = `
                    <div class="opponent-name">${opponentDisplayName} ${p.eliminado ? '💀 (Eliminado)' : ''}</div>
                    <div class="opponent-score">${p.puntosAcumulados} pts</div>
                    <div class="opponent-cards-mini">${miniCardsHTML}</div>
                `;
                oppArea.appendChild(badge);
            }
        });
    }

    // 2. Centro de la mesa: Mazo de Robo y Pozo
    const centerTableEl = document.getElementById('center-table');
    const isAcomodoOrFin = (engine.fase === 'acomodo' || engine.fase === 'fin_ronda') && engine.corteInfo;
    if (centerTableEl) {
        centerTableEl.style.display = isAcomodoOrFin ? 'none' : 'flex';
    }

    const deckEl = document.getElementById('deck-pile-element');
    const deckCount = engine.deck ? engine.deck.length : 0;
    const isMyTurnToDraw = (engine.turnoSeat === miSeat && engine.fase === 'robar');
    actualizarVolumenMazo(deckCount, isMyTurnToDraw);

    if (deckEl) {
        if (isMyTurnToDraw && deckCount > 0) deckEl.classList.add('highlight-draw');
        else deckEl.classList.remove('highlight-draw');
    }

    const discardEl = document.getElementById('discard-pile-element');
    if (discardEl) {
        const topDiscard = engine.discardPile.length > 0 ? engine.discardPile[engine.discardPile.length - 1] : null;
        if (topDiscard) {
            discardEl.style.backgroundImage = `url("${topDiscard.getAssetUrl ? topDiscard.getAssetUrl() : ''}")`;
            discardEl.style.opacity = '1';
            discardEl.style.border = '2px solid rgba(255, 255, 255, 0.4)';
        } else {
            discardEl.style.backgroundImage = 'none';
            discardEl.style.opacity = '0.25';
            discardEl.style.border = '2px dashed rgba(255, 255, 255, 0.35)';
        }

        if (isMyTurnToDraw && topDiscard) discardEl.classList.add('highlight-draw');
        else discardEl.classList.remove('highlight-draw');
    }

    // 2.5 Mesa de Cartas Bajadas (Corte y Acomodo)
    const tableMeldsArea = document.getElementById('table-melds-area');
    if (tableMeldsArea) {
        if ((engine.fase === 'acomodo' || engine.fase === 'fin_ronda') && engine.corteInfo) {
            tableMeldsArea.style.display = 'flex';
            const corte = engine.corteInfo;
            const titleEl = document.getElementById('table-melds-title');
            const ptsEl = document.getElementById('table-melds-pts');
            const containerEl = document.getElementById('table-melds-container');

            if (titleEl) {
                let cortadorNom = corte.cortadorNombre;
                if (!cortadorNom || cortadorNom.trim() === '' || cortadorNom.trim().toUpperCase() === 'TÚ') {
                    cortadorNom = (corte.cortadorSeat === miSeat) ? 'Tú' : 'el Rival';
                }
                const sufijo = (corte.cortadorSeat === miSeat) ? 'Tuyo' : `de ${cortadorNom}`;
                if (corte.esCongaLimpia) {
                    titleEl.innerText = `🏆 ¡CONGA LIMPIA ${sufijo}! (7 cartas del mismo palo)`;
                } else if (corte.esCongaConComodin) {
                    titleEl.innerText = `🔥 ¡CONGA ${sufijo}! (con Comodín)`;
                } else if (corte.esCorteCero) {
                    titleEl.innerText = `⭐ ¡Corte con 0 Puntos ${sufijo}!`;
                } else {
                    titleEl.innerText = `✂️ Corte ${sufijo} (con ${corte.puntosSueltos} pts)`;
                }
            }

            if (ptsEl) {
                if (corte.esCongaLimpia) {
                    ptsEl.innerText = `PARTIDO GANADO`;
                } else if (corte.esCongaConComodin || corte.esCorteCero) {
                    ptsEl.innerText = `-10 Pts (Sin colocación)`;
                } else if (corte.permiteAcomodo) {
                    if (engine.fase === 'acomodo') {
                        ptsEl.innerText = (corte.cortadorSeat === miSeat) 
                            ? `Esperando colocación de rivales...` 
                            : `👉 ¡Coloca tus cartas sueltas en sus ligas!`;
                    } else {
                        ptsEl.innerText = `Ronda finalizada`;
                    }
                } else {
                    ptsEl.innerText = ``;
                }
            }

            if (containerEl) {
                containerEl.innerHTML = '';

                // Juegos del cortador
                const meldsAMostrar = corte.melds || [];
                meldsAMostrar.forEach((meld, mIdx) => {
                    const groupEl = document.createElement('div');
                    groupEl.className = 'meld-group-box';

                    const gTitle = document.createElement('div');
                    gTitle.className = 'meld-group-title';
                    gTitle.innerText = `Juego #${mIdx + 1} (${meld.length} cartas)`;
                    groupEl.appendChild(gTitle);

                    const rowEl = document.createElement('div');
                    rowEl.className = 'meld-cards-row';

                    meld.forEach(c => {
                        const cardMini = document.createElement('div');
                        const esAcomodada = engine.cartasAcomodadas && engine.cartasAcomodadas.some(a => a.carta && a.carta.id === c.id);
                        cardMini.className = `meld-card-mini ${esAcomodada ? 'card-acomodada' : ''}`;
                        const url = (typeof c.getAssetUrl === 'function') ? c.getAssetUrl() : new Carta(c.valor, c.palo, c.esComodin, c.id).getAssetUrl();
                        cardMini.style.backgroundImage = `url("${url}")`;
                        cardMini.title = `${c.valor} de ${c.palo}${esAcomodada ? ' (Colocada por rival)' : ''}`;
                        rowEl.appendChild(cardMini);
                    });

                    groupEl.appendChild(rowEl);
                    containerEl.appendChild(groupEl);
                });

                // Cartas sueltas del cortador
                if (corte.unmelded && corte.unmelded.length > 0) {
                    const groupSuelta = document.createElement('div');
                    groupSuelta.className = 'meld-group-box';

                    const gTitle = document.createElement('div');
                    gTitle.className = 'meld-group-title';
                    gTitle.innerText = `Sueltas (${corte.puntosSueltos}p)`;
                    groupSuelta.appendChild(gTitle);

                    const rowEl = document.createElement('div');
                    rowEl.className = 'meld-cards-row';

                    corte.unmelded.forEach(c => {
                        const cardMini = document.createElement('div');
                        cardMini.className = 'meld-card-mini';
                        const url = (typeof c.getAssetUrl === 'function') ? c.getAssetUrl() : new Carta(c.valor, c.palo, c.esComodin, c.id).getAssetUrl();
                        cardMini.style.backgroundImage = `url("${url}")`;
                        cardMini.title = `${c.valor} de ${c.palo}`;
                        rowEl.appendChild(cardMini);
                    });

                    groupSuelta.appendChild(rowEl);
                    containerEl.appendChild(groupSuelta);
                }

                // Carta con la que cortó (descarte)
                if (corte.cartaDescarte) {
                    const c = corte.cartaDescarte;
                    const groupDesc = document.createElement('div');
                    groupDesc.className = 'meld-group-box';

                    const gTitle = document.createElement('div');
                    gTitle.className = 'meld-group-title';
                    gTitle.innerText = `Carta de Corte`;
                    groupDesc.appendChild(gTitle);

                    const rowEl = document.createElement('div');
                    rowEl.className = 'meld-cards-row';

                    const cardMini = document.createElement('div');
                    cardMini.className = 'meld-card-mini';
                    const url = (typeof c.getAssetUrl === 'function') ? c.getAssetUrl() : new Carta(c.valor, c.palo, c.esComodin, c.id).getAssetUrl();
                    cardMini.style.backgroundImage = `url("${url}")`;
                    cardMini.title = `Descarte: ${c.valor} de ${c.palo}`;
                    rowEl.appendChild(cardMini);

                    groupDesc.appendChild(rowEl);
                    containerEl.appendChild(groupDesc);
                }
            }
        } else {
            tableMeldsArea.style.display = 'none';
        }
    }

    // 3. Banner de Estado y Turno
    const turnText = document.getElementById('turn-text');
    const turnIcon = document.getElementById('turn-icon');
    const banner = document.getElementById('turn-status-banner');
    
    if (turnText && banner) {
        if (engine.fase === 'acomodo') {
            banner.classList.add('banner-interactive');
            banner.title = "Haz clic aquí para ver los resultados de la ronda";
            const corte = engine.corteInfo;
            if (corte) {
                let cortadorNom = corte.cortadorNombre;
                if (!cortadorNom || cortadorNom.trim() === '' || cortadorNom.trim().toUpperCase() === 'TÚ') {
                    cortadorNom = (corte.cortadorSeat === miSeat) ? 'Tú' : 'El rival';
                }
                if (corte.cortadorSeat === miSeat) {
                    banner.classList.add('my-turn');
                    turnIcon.innerText = "✂️";
                    turnText.innerHTML = `Cortaste la ronda. <span class="banner-action-pill">📊 Ver Resultados ➔</span>`;
                } else if (corte.permiteAcomodo) {
                    banner.classList.add('my-turn');
                    turnIcon.innerText = "🃏";
                    const tieneColocables = myPlayer && myPlayer.hand.some(c => engine.puedeColocarCarta(miSeat, c.id));
                    turnText.innerHTML = tieneColocables 
                        ? `¡Coloca tus cartas! Toca las cartas destacadas o pulsa <span class="banner-action-pill">📊 Ver Resultados ➔</span>`
                        : `${cortadorNom} cortó con ${corte.puntosSueltos} pts. <span class="banner-action-pill">📊 Ver Resultados ➔</span>`;
                } else {
                    banner.classList.remove('my-turn');
                    turnIcon.innerText = "⭐";
                    turnText.innerHTML = `${cortadorNom} cortó con 0 o Conga. <span class="banner-action-pill">📊 Ver Resultados ➔</span>`;
                }
            }
        } else {
            banner.classList.remove('banner-interactive');
            banner.title = "";
            if (engine.turnoSeat === miSeat) {
                banner.classList.add('my-turn');
                turnIcon.innerText = "⭐";
                if (engine.fase === 'robar') {
                    turnText.innerText = (engine.discardPile.length > 0)
                        ? "Tu turno: Robá del mazo o del pozo"
                        : "Tu turno: Robá del mazo";
                } else if (engine.fase === 'descartar') {
                    turnText.innerText = (engine.discardPile.length === 0)
                        ? "Sos mano: Tienes 8 cartas. Selecciona una carta para tirar al pozo e iniciar la partida"
                        : "Tu turno: Selecciona una carta para descartar o cortar";
                }
            } else {
                banner.classList.remove('my-turn');
                turnIcon.innerText = "⏳";
                const activePlayer = engine.players[engine.turnoSeat];
                let nombreTurno = 'Rival';
                if (activePlayer && activePlayer.name) {
                    const rawName = activePlayer.name.trim();
                    if (rawName && rawName.toUpperCase() !== 'TÚ') {
                        nombreTurno = rawName;
                    }
                }
                turnText.innerText = `Turno de ${nombreTurno}...`;
            }
        }
    }

    // 4. Mano del Jugador Local (Seat miSeat)
    const plyHandFan = document.getElementById('player-hand-fan');
    if (plyHandFan && myPlayer) {
        plyHandFan.innerHTML = '';
        
        // Calcular melds para mostrar badges
        const analysis = engine.detectarMejoresMelds(myPlayer.hand);
        const meldedSet = new Set();
        analysis.melds.forEach(m => m.forEach(c => meldedSet.add(c.id)));

        const totalCards = myPlayer.hand.length;
        myPlayer.hand.forEach((carta, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'hand-card';
            cardEl.style.backgroundImage = `url("${carta.getAssetUrl ? carta.getAssetUrl() : ''}")`;
            cardEl.dataset.index = idx;

            // Inclinación suave en abanico
            const angle = (idx - (totalCards - 1) / 2) * 4;
            const yOffset = Math.abs(idx - (totalCards - 1) / 2) * 3;
            cardEl.style.transform = `rotate(${angle}deg) translateY(${yOffset}px)`;

            if (selectedCardIndex === idx) {
                cardEl.classList.add('selected-card');
            }

            // Badge de ligada o suelta en la esquina de cada carta (oculto por defecto, configurable)
            if (engine.config.mostrarPuntosCartas && engine.fase !== 'acomodo') {
                const badge = document.createElement('div');
                badge.className = `card-meld-badge ${meldedSet.has(carta.id) ? 'badge-ligada' : 'badge-suelta'}`;
                badge.innerText = meldedSet.has(carta.id) ? "LIGADA" : `${carta.getPuntosSueltos ? carta.getPuntosSueltos() : 0}p`;
                cardEl.appendChild(badge);
            }

            // Comprobar si la carta se puede colocar durante fase de acomodo
            const puedeColocar = (engine.fase === 'acomodo' && engine.corteInfo && engine.corteInfo.permiteAcomodo && miSeat !== engine.corteInfo.cortadorSeat && engine.puedeColocarCarta(miSeat, carta.id));

            if (puedeColocar) {
                cardEl.classList.add('card-placeable');
                const badgeColocar = document.createElement('div');
                badgeColocar.className = 'badge-colocar';
                badgeColocar.innerText = "➕ COLOCAR";
                cardEl.appendChild(badgeColocar);

                cardEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
                        window.FirebaseManager.enviarAccion('colocar_carta', { cartaId: carta.id });
                    } else {
                        const ok = engine.colocarCarta(miSeat, carta.id);
                        if (ok) {
                            playSound('card-deal');
                            if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
                            renderJuego();
                        }
                    }
                });
            } else {
                // Permitir arrastre y reordenamiento manual de la carta solo durante juego normal
                if (engine.fase !== 'acomodo') {
                    habilitarArrastreReorden(cardEl, idx, myPlayer.hand, plyHandFan);
                }
            }

            plyHandFan.appendChild(cardEl);
        });

        // Actualizar indicador de puntos sueltos
        const deadwoodEl = document.getElementById('deadwood-pts');
        const deadwoodBadge = document.getElementById('deadwood-badge');
        if (deadwoodEl && deadwoodBadge) {
            let ptsAMostrar = analysis.puntosSueltos;
            let esCortePosible = false;

            if (myPlayer.hand.length === 8 && engine.turnoSeat === miSeat && engine.fase === 'descartar') {
                if (selectedCardIndex !== null && selectedCardIndex >= 0 && selectedCardIndex < myPlayer.hand.length) {
                    const manoSim = myPlayer.hand.filter((_, i) => i !== selectedCardIndex);
                    const simAnalysis = engine.detectarMejoresMelds(manoSim);
                    ptsAMostrar = simAnalysis.puntosSueltos;
                    esCortePosible = engine.puedeCortar(miSeat, selectedCardIndex);
                    deadwoodEl.innerText = `${ptsAMostrar} pts (al descartar)`;
                } else {
                    esCortePosible = engine.puedeCortar(miSeat);
                    deadwoodEl.innerText = `${ptsAMostrar} pts`;
                }

                if (esCortePosible) {
                    deadwoodBadge.classList.add('can-cut-text');
                    deadwoodBadge.title = "¡Puedes cortar esta ronda!";
                } else {
                    deadwoodBadge.classList.remove('can-cut-text');
                    deadwoodBadge.title = "";
                }
            } else {
                deadwoodEl.innerText = `${ptsAMostrar} pts`;
                deadwoodBadge.classList.remove('can-cut-text');
                deadwoodBadge.title = "";
            }
        }
    }

    // 5. Botones de Acción
    const btnRobarMazo = document.getElementById('btn-robar-mazo');
    const btnRobarPozo = document.getElementById('btn-robar-pozo');
    const btnDescartar = document.getElementById('btn-descartar');
    const btnCortar = document.getElementById('btn-cortar');
    const btnAuto = document.getElementById('btn-auto-ordenar');
    const btnAcomodarTodas = document.getElementById('btn-acomodar-todas');
    const btnConfirmarCorte = document.getElementById('btn-confirmar-corte');

    const esMiTurno = (engine.turnoSeat === miSeat && myPlayer && !myPlayer.eliminado);

    if (engine.fase === 'acomodo') {
        if (btnRobarMazo) btnRobarMazo.style.display = 'none';
        if (btnRobarPozo) btnRobarPozo.style.display = 'none';
        if (btnDescartar) btnDescartar.style.display = 'none';
        if (btnCortar) btnCortar.style.display = 'none';
        if (btnAuto) btnAuto.style.display = 'none';

        const corte = engine.corteInfo;
        const esRival = (corte && corte.cortadorSeat !== miSeat);
        const tieneColocables = esRival && corte.permiteAcomodo && myPlayer && myPlayer.hand.some(c => engine.puedeColocarCarta(miSeat, c.id));

        if (btnAcomodarTodas) {
            if (esRival && corte.permiteAcomodo) {
                btnAcomodarTodas.style.display = 'inline-flex';
                btnAcomodarTodas.disabled = !tieneColocables;
                btnAcomodarTodas.innerText = tieneColocables ? "🃏 Colocar Mis Cartas" : "✅ Cartas Colocadas";
            } else {
                btnAcomodarTodas.style.display = 'none';
            }
        }

        if (btnConfirmarCorte) {
            btnConfirmarCorte.style.display = 'inline-flex';
            btnConfirmarCorte.innerText = "📊 Ver Resultados";
        }
    } else if (engine.fase === 'robar') {
        if (btnRobarMazo) {
            btnRobarMazo.style.display = 'inline-flex';
            btnRobarMazo.disabled = !esMiTurno;
        }
        if (btnRobarPozo) {
            btnRobarPozo.style.display = 'inline-flex';
            btnRobarPozo.disabled = !(esMiTurno && engine.discardPile.length > 0);
        }
        if (btnDescartar) btnDescartar.style.display = 'none';
        if (btnCortar) btnCortar.style.display = 'none';
        if (btnAuto) btnAuto.style.display = 'inline-flex';
        if (btnAcomodarTodas) btnAcomodarTodas.style.display = 'none';
        if (btnConfirmarCorte) btnConfirmarCorte.style.display = 'none';
    } else {
        // Fase 'descartar'
        if (btnRobarMazo) btnRobarMazo.style.display = 'none';
        if (btnRobarPozo) btnRobarPozo.style.display = 'none';

        const hasCardSelected = (selectedCardIndex !== null && selectedCardIndex >= 0 && myPlayer && selectedCardIndex < myPlayer.hand.length);

        if (btnDescartar) {
            btnDescartar.style.display = 'inline-flex';
            const canDiscard = esMiTurno && hasCardSelected;
            btnDescartar.disabled = !canDiscard;
            if (canDiscard) {
                btnDescartar.classList.add('can-discard');
                btnDescartar.title = "Descartar la carta seleccionada al pozo";
            } else {
                btnDescartar.classList.remove('can-discard');
                btnDescartar.title = "Selecciona una carta o haz doble clic / doble tap para descartar";
            }
        }

        if (btnCortar) {
            btnCortar.style.display = 'inline-flex';
            const canCutSelected = esMiTurno && hasCardSelected && engine.puedeCortar(miSeat, selectedCardIndex);
            btnCortar.disabled = !canCutSelected;

            if (canCutSelected) {
                btnCortar.classList.add('can-cut');
                btnCortar.title = "¡Cumples las condiciones para cortar la ronda!";
                const manoSim = myPlayer.hand.filter((_, i) => i !== selectedCardIndex);
                const simAnalysis = engine.detectarMejoresMelds(manoSim);
                if (simAnalysis.esConga) {
                    btnCortar.innerText = simAnalysis.esCongaLimpia ? "👑 ¡CONGA LIMPIA!" : "🎉 ¡CONGA!";
                } else if (simAnalysis.esCorteCero) {
                    btnCortar.innerText = "✂️ Cortar (0 pts)";
                } else {
                    btnCortar.innerText = `✂️ Cortar (${simAnalysis.puntosSueltos} pts)`;
                }
            } else {
                btnCortar.classList.remove('can-cut');
                if (esMiTurno && !hasCardSelected && engine.puedeCortar(miSeat)) {
                    btnCortar.innerText = "✂️ Cortar (Elige carta)";
                    btnCortar.title = "Tienes juego para cortar: selecciona la carta a descartar";
                } else {
                    btnCortar.innerText = "✂️ Cortar";
                    btnCortar.title = "Debes tener 5 puntos sueltos o menos (o Conga) para cortar";
                }
            }
        }

        if (btnAuto) btnAuto.style.display = 'inline-flex';
        if (btnAcomodarTodas) btnAcomodarTodas.style.display = 'none';
        if (btnConfirmarCorte) btnConfirmarCorte.style.display = 'none';
    }
}

/**
 * Actualiza el volumen tridimensional y los bordes visibles del mazo de robo.
 * Sin mostrar un número artificial, los jugadores pueden ver a simple vista cuántas cartas
 * quedan según el grosor del mazo (para pocas cartas se aprecian exactamente los bordes de cada carta).
 */
function actualizarVolumenMazo(count, isHighlight = false) {
    const deckEl = document.getElementById('deck-pile-element');
    if (!deckEl) return;

    if (count <= 0) {
        // Mazo totalmente agotado
        deckEl.style.opacity = '0.22';
        deckEl.style.backgroundImage = 'none';
        deckEl.style.border = '2px dashed rgba(255, 255, 255, 0.35)';
        deckEl.style.boxShadow = 'none';
        deckEl.style.cursor = 'default';
        return;
    }

    deckEl.style.opacity = '1';
    deckEl.style.backgroundImage = "url('assets/cards_tatu/carta_reverso.png')";
    deckEl.style.border = '2px solid rgba(255, 255, 255, 0.4)';
    deckEl.style.cursor = 'pointer';

    if (count === 1) {
        // Exactamente 1 carta: plana en la mesa, sin capas debajo
        const baseShadow = '0 3px 8px rgba(0, 0, 0, 0.55)';
        deckEl.style.boxShadow = isHighlight 
            ? `0 0 20px rgba(241, 196, 15, 0.9), ${baseShadow}`
            : baseShadow;
        return;
    }

    // Para 2 a 8 cartas: exactamente (count - 1) bordes de cartas debajo de la superior
    // Para más de 8 cartas: escala progresiva hasta 14 capas para representar un mazo completo
    const visibleEdges = (count <= 8) 
        ? (count - 1) 
        : Math.min(14, 7 + Math.floor((count - 8) / 3));

    // Separación entre bordes: 1.9px para pocas cartas (se cuentan a simple vista), 1.2px para mazo grueso
    const step = (count <= 5) ? 1.9 : ((count <= 10) ? 1.5 : 1.2);
    const shadows = [];

    // Brillo dorado de turno de robo si corresponde
    if (isHighlight) {
        shadows.push('0 0 22px rgba(241, 196, 15, 0.9)');
    }

    for (let i = 1; i <= visibleEdges; i++) {
        const x = (i * step).toFixed(1);
        const y = (i * step).toFixed(1);
        const cardEdgeColor = (i % 2 === 0) ? '#e8e4db' : '#fcfaf6';
        const separatorLine = (i % 2 === 0) ? '#281a10' : '#180e08';

        shadows.push(`${x}px ${y}px 0 ${cardEdgeColor}`);
        shadows.push(`${x}px ${(parseFloat(y) + 0.6).toFixed(1)}px 0 ${separatorLine}`);
    }

    // Sombra ambiental sobre la mesa
    const totalX = (visibleEdges * step + 4).toFixed(1);
    const totalY = (visibleEdges * step + 6).toFixed(1);
    const blur = Math.min(18, 6 + visibleEdges).toFixed(1);
    shadows.push(`${totalX}px ${totalY}px ${blur}px rgba(0, 0, 0, 0.65)`);

    deckEl.style.boxShadow = shadows.join(', ');
}
window.actualizarVolumenMazo = actualizarVolumenMazo;

// -------------------------------------------------------------
// INTERACCIÓN DE JUGADOR HUMANO
// -------------------------------------------------------------
function seleccionarCarta(idx) {
    if (engine.turnoSeat !== miSeat || engine.fase !== 'descartar') return;
    if (selectedCardIndex === idx) {
        selectedCardIndex = null;
    } else {
        selectedCardIndex = idx;
    }
    renderJuego();
}

/**
 * Habilita el reordenamiento manual de cartas en mano por arrastre (drag-and-drop)
 * con botón izquierdo del mouse o pantalla táctil, además de permitir descarte rápido.
 */
function habilitarArrastreReorden(cardDOM, index, hand, container) {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let wasDragged = false;
    let currentSlotIndex = index;
    let activePointerId = null;
    let siblingCards = [];
    let slotCenters = [];
    let shiftAmount = 60;
    const totalCards = hand.length;

    cardDOM.addEventListener('pointerdown', (e) => {
        // Responder únicamente a botón principal (0) en mouse o puntero táctil
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;
        isDragging = false;
        wasDragged = false;
        currentSlotIndex = index;
        activePointerId = e.pointerId;

        siblingCards = Array.from(container.children).filter(el => el.classList.contains('hand-card'));
        const cardRects = siblingCards.map(el => el.getBoundingClientRect());
        slotCenters = cardRects.map(r => r.left + r.width / 2);
        if (slotCenters.length > 1) {
            shiftAmount = Math.abs(slotCenters[1] - slotCenters[0]) || 60;
        }

        try {
            cardDOM.setPointerCapture(e.pointerId);
        } catch (_) {}
    });

    cardDOM.addEventListener('pointermove', (e) => {
        if (activePointerId === null || e.pointerId !== activePointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isDragging) {
            // Umbral de 7 píxeles para distinguir click de arrastre intencional
            if (Math.hypot(dx, dy) >= 7) {
                isDragging = true;
                wasDragged = true;
                cardDOM.classList.add('is-dragging');
                if (navigator.vibrate) navigator.vibrate(10);
            }
        }

        if (isDragging) {
            cardDOM.style.transform = `translate3d(${dx}px, ${dy - 14}px, 0) scale(1.12) rotate(${dx * 0.04}deg)`;

            const currentCenterX = (slotCenters[index] || 0) + dx;
            let nearestSlot = index;
            let minDiff = Infinity;
            slotCenters.forEach((centerX, sIdx) => {
                const diff = Math.abs(currentCenterX - centerX);
                if (diff < minDiff) {
                    minDiff = diff;
                    nearestSlot = sIdx;
                }
            });

            if (nearestSlot !== currentSlotIndex) {
                currentSlotIndex = nearestSlot;

                siblingCards.forEach((sibling, sIdx) => {
                    if (sIdx === index) return;

                    const baseAngle = (sIdx - (totalCards - 1) / 2) * 4;
                    const baseYOffset = Math.abs(sIdx - (totalCards - 1) / 2) * 3;
                    sibling.style.transition = 'transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1)';

                    if (index < currentSlotIndex) {
                        if (sIdx > index && sIdx <= currentSlotIndex) {
                            sibling.style.transform = `translateX(-${shiftAmount}px) rotate(${baseAngle}deg) translateY(${baseYOffset}px)`;
                        } else {
                            sibling.style.transform = `rotate(${baseAngle}deg) translateY(${baseYOffset}px)`;
                        }
                    } else if (index > currentSlotIndex) {
                        if (sIdx >= currentSlotIndex && sIdx < index) {
                            sibling.style.transform = `translateX(${shiftAmount}px) rotate(${baseAngle}deg) translateY(${baseYOffset}px)`;
                        } else {
                            sibling.style.transform = `rotate(${baseAngle}deg) translateY(${baseYOffset}px)`;
                        }
                    } else {
                        sibling.style.transform = `rotate(${baseAngle}deg) translateY(${baseYOffset}px)`;
                    }
                });
            }
        }
    });

    const finalizarArrastre = (e) => {
        if (activePointerId === null || e.pointerId !== activePointerId) return;

        try {
            cardDOM.releasePointerCapture(e.pointerId);
        } catch (_) {}
        activePointerId = null;

        if (isDragging) {
            const dy = e.clientY - startY;
            cardDOM.classList.remove('is-dragging');
            cardDOM.style.transform = '';

            siblingCards.forEach(s => {
                s.style.transform = '';
                s.style.transition = '';
            });

            if (currentSlotIndex !== index && currentSlotIndex >= 0 && currentSlotIndex < hand.length) {
                // Reordenar las cartas en la mano del jugador
                const [movedCard] = hand.splice(index, 1);
                hand.splice(currentSlotIndex, 0, movedCard);

                // Ajustar índice de la carta seleccionada si existía
                if (selectedCardIndex === index) {
                    selectedCardIndex = currentSlotIndex;
                } else if (selectedCardIndex !== null) {
                    if (index < selectedCardIndex && currentSlotIndex >= selectedCardIndex) {
                        selectedCardIndex--;
                    } else if (index > selectedCardIndex && currentSlotIndex <= selectedCardIndex) {
                        selectedCardIndex++;
                    }
                }

                playSound('card-deal');
                renderJuego();
            } else if (dy < -80 && engine.turnoSeat === miSeat && engine.fase === 'descartar') {
                // Descarte rápido por arrastre vertical hacia arriba a la mesa
                selectedCardIndex = index;
                ejecutarDescarteHumano();
            } else {
                renderJuego();
            }

            wasDragged = true;
            isDragging = false;
            setTimeout(() => { wasDragged = false; }, 300);
        }
    };

    cardDOM.addEventListener('pointerup', finalizarArrastre);
    cardDOM.addEventListener('pointercancel', finalizarArrastre);

    cardDOM.addEventListener('click', (e) => {
        if (wasDragged) {
            wasDragged = false;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.stopPropagation();

        const card = hand[index];
        const now = Date.now();
        const isDoubleTap = (lastCardTapTracker.cardId && card && lastCardTapTracker.cardId === card.id && (now - lastCardTapTracker.timestamp) < 380);

        if (isDoubleTap && engine.turnoSeat === miSeat && engine.fase === 'descartar') {
            lastCardTapTracker = { cardId: null, timestamp: 0 };
            selectedCardIndex = index;
            ejecutarDescarteHumano();
            return;
        }

        lastCardTapTracker = { cardId: card ? card.id : null, timestamp: now };
        seleccionarCarta(index);
    });

    // Doble clic con mouse en computadoras para descartar directo
    cardDOM.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (engine.turnoSeat === miSeat && engine.fase === 'descartar') {
            lastCardTapTracker = { cardId: null, timestamp: 0 };
            selectedCardIndex = index;
            ejecutarDescarteHumano();
        }
    });
}
window.habilitarArrastreReorden = habilitarArrastreReorden;

// Robar Mazo
document.getElementById('btn-robar-mazo').addEventListener('click', () => {
    if (engine.turnoSeat !== miSeat || engine.fase !== 'robar') return;
    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        window.FirebaseManager.enviarAccion('robar_mazo');
    } else {
        const robada = engine.robarMazo(miSeat);
        if (engine.fase === 'fin_ronda') {
            if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
            mostrarModalFinRonda();
            return;
        }
        if (robada) playSound('card-draw');
        if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
        renderJuego();
    }
});

// Robar Pozo
document.getElementById('btn-robar-pozo').addEventListener('click', () => {
    if (engine.turnoSeat !== miSeat || engine.fase !== 'robar') return;
    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        window.FirebaseManager.enviarAccion('robar_pozo');
    } else {
        engine.robarPozo(miSeat);
        playSound('card-draw');
        if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
        renderJuego();
    }
});

// Click directo en los pozos del centro
document.getElementById('stock-pile-container').addEventListener('click', () => {
    if (engine.turnoSeat === miSeat && engine.fase === 'robar') {
        if (modoJuego === 'multiplayer' && miRol !== 'creador') {
            window.FirebaseManager.enviarAccion('robar_mazo');
        } else {
            const robada = engine.robarMazo(miSeat);
            if (engine.fase === 'fin_ronda') {
                if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
                renderJuego();
                mostrarModalFinRonda();
                return;
            }
            if (robada) playSound('card-draw');
            if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
        }
    }
});

document.getElementById('discard-pile-container').addEventListener('click', () => {
    if (engine.turnoSeat === miSeat) {
        if (engine.fase === 'robar') {
            if (engine.discardPile.length === 0) return; // Pozo vacío al iniciar
            if (modoJuego === 'multiplayer' && miRol !== 'creador') {
                window.FirebaseManager.enviarAccion('robar_pozo');
            } else {
                engine.robarPozo(miSeat);
                playSound('card-draw');
                if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
                renderJuego();
            }
        } else if (engine.fase === 'descartar' && selectedCardIndex !== null) {
            ejecutarDescarteHumano();
        }
    }
});

// Descartar Carta Seleccionada
function ejecutarDescarteHumano() {
    if (engine.turnoSeat !== miSeat || engine.fase !== 'descartar') return;
    if (selectedCardIndex === null || selectedCardIndex < 0 || !engine.players[miSeat] || selectedCardIndex >= engine.players[miSeat].hand.length) {
        alert("Toca una carta de tu mano para seleccionarla o haz doble clic / doble tap sobre ella para tirarla.");
        return;
    }
    const player = engine.players[miSeat];
    const carta = player ? player.hand[selectedCardIndex] : null;
    if (engine.origenRobo === 'pozo' && engine.cartaRobada && carta && carta.id === engine.cartaRobada.id) {
        alert("Regla de Conga: No puedes tirar la misma carta que acabas de robar del pozo.");
        return;
    }
    const idx = selectedCardIndex;
    selectedCardIndex = null;
    lastCardTapTracker = { cardId: null, timestamp: 0 };

    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        window.FirebaseManager.enviarAccion('descartar', { cardIndex: idx });
    } else {
        engine.descartarCarta(miSeat, idx);
        playSound('card-discard');
        if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
        renderJuego();
        verificarTurnoBot();
    }
}
document.getElementById('btn-descartar').addEventListener('click', ejecutarDescarteHumano);

// Cortar Ronda
document.getElementById('btn-cortar').addEventListener('click', () => {
    if (engine.turnoSeat !== miSeat || engine.fase !== 'descartar') return;
    if (selectedCardIndex === null || selectedCardIndex < 0 || !engine.players[miSeat] || selectedCardIndex >= engine.players[miSeat].hand.length) {
        alert("Selecciona primero la carta con la que deseas descartar para cortar.");
        return;
    }
    if (!engine.puedeCortar(miSeat, selectedCardIndex)) {
        alert("No cumples las condiciones para cortar con esta carta. Debes tener 5 puntos sueltos o menos, o Conga.");
        return;
    }
    const idx = selectedCardIndex;
    selectedCardIndex = null;
    lastCardTapTracker = { cardId: null, timestamp: 0 };

    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        window.FirebaseManager.enviarAccion('cortar', { cardIndex: idx });
    } else {
        iniciarFaseAcomodoUI(miSeat, idx);
    }
});

// Botones de Fase de Acomodo
document.getElementById('btn-acomodar-todas').addEventListener('click', () => {
    if (!engine || engine.fase !== 'acomodo') return;
    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        window.FirebaseManager.enviarAccion('acomodar_todas');
    } else {
        const totalPuestas = engine.acomodarTodasDelJugador(miSeat);
        if (totalPuestas > 0) {
            playSound('card-deal');
        }
        if (modoJuego === 'multiplayer') window.FirebaseManager.sincronizarEstado(engine);
        renderJuego();
    }
});

document.getElementById('btn-confirmar-corte').addEventListener('click', () => {
    if (!engine || engine.fase !== 'acomodo') return;
    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        window.FirebaseManager.enviarAccion('confirmar_corte');
    } else {
        finalizarFaseAcomodoUI();
    }
});

// Clic en el banner / leyenda de Ver Resultados para avanzar de forma directa
document.getElementById('turn-status-banner').addEventListener('click', () => {
    if (engine && engine.fase === 'acomodo') {
        if (modoJuego === 'multiplayer' && miRol !== 'creador') {
            window.FirebaseManager.enviarAccion('confirmar_corte');
        } else {
            finalizarFaseAcomodoUI();
        }
    }
});

// Botón "Ver Resultados" en la cabecera de la mesa de cartas bajadas
const btnVerMesa = document.getElementById('btn-ver-resultados-mesa');
if (btnVerMesa) {
    btnVerMesa.addEventListener('click', () => {
        if (engine && engine.fase === 'acomodo') {
            if (modoJuego === 'multiplayer' && miRol !== 'creador') {
                window.FirebaseManager.enviarAccion('confirmar_corte');
            } else {
                finalizarFaseAcomodoUI();
            }
        }
    });
}

// Botón rápido en la esquina superior del modal para pasar a siguiente mano
const btnHeaderSigMano = document.getElementById('btn-header-siguiente-mano');
if (btnHeaderSigMano) {
    btnHeaderSigMano.addEventListener('click', avanzarSiguienteMano);
}

// Auto-ordenar Mano
document.getElementById('btn-auto-ordenar').addEventListener('click', () => {
    if (!engine.players[miSeat]) return;
    engine.players[miSeat].hand = engine.autoOrganizarMano(engine.players[miSeat].hand);
    selectedCardIndex = null;
    playSound('card-deal');
    renderJuego();
});

// -------------------------------------------------------------
// CONTROL DE CORTE Y FASE DE ACOMODO (LAYOFFS)
// -------------------------------------------------------------
function iniciarFaseAcomodoUI(cortadorSeat, cardIndex) {
    if (!engine || !engine.partidoIniciado) return;
    const corteInfo = engine.iniciarCorte(cortadorSeat, cardIndex);
    if (!corteInfo) return;

    playSound('cut');
    selectedCardIndex = null;

    // Si permite acomodo (1 a 5 pts), los bots rivales acomodan sus cartas automáticamente
    if (corteInfo.permiteAcomodo) {
        engine.players.forEach(p => {
            if (p.isBot && p.seat !== cortadorSeat && !p.eliminado) {
                engine.acomodarTodasDelJugador(p.seat);
            }
        });
    }

    if (modoJuego === 'multiplayer') {
        window.FirebaseManager.sincronizarEstado(engine);
    }

    renderJuego();
}

function finalizarFaseAcomodoUI() {
    if (!engine) return;
    const ok = engine.finalizarCorte();
    if (!ok && engine.fase !== 'fin_ronda') return;

    if (modoJuego === 'multiplayer') {
        window.FirebaseManager.sincronizarEstado(engine);
    }

    renderJuego();
    mostrarModalFinRonda();
}

// -------------------------------------------------------------
// MODAL FIN DE RONDA Y PROGRESIÓN FLUIDA
// -------------------------------------------------------------
function mostrarModalFinRonda() {
    const res = engine.resultadoRonda;
    if (!res) return;

    const modal = document.getElementById('modal-fin-ronda');
    const title = document.getElementById('fin-ronda-title');
    const body = document.getElementById('fin-ronda-body');
    const btnSiguiente = document.getElementById('btn-siguiente-mano');

    if (res.victoriaDirecta) {
        title.innerText = "🏆 ¡CONGA LIMPIA! PARTIDO GANADO 🏆";
        playSound('win');
    } else if (res.mazoAgotado) {
        title.innerText = "📦 Mazo agotado - Fin de Ronda";
    } else {
        const cortador = engine.players[res.cortadorSeat];
        let cortadorNom = cortador ? cortador.name : 'Un jugador';
        if (!cortadorNom || cortadorNom.trim() === '' || cortadorNom.trim().toUpperCase() === 'TÚ') {
            cortadorNom = (res.cortadorSeat === miSeat) ? 'Tú' : 'El rival';
        }
        title.innerText = (res.cortadorSeat === miSeat)
            ? `✂️ Cortaste la ronda`
            : `✂️ ${cortadorNom} ha cortado la ronda`;
    }

    let html = '';
    res.detalles.forEach(d => {
        const p = engine.players[d.seat];
        let meldsHTML = '';
        if (p.melds && p.melds.length > 0) {
            meldsHTML += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items:center;">
                <span style="font-size:0.75rem; color:#f1c40f; font-weight:bold;">Ligas:</span>`;
            p.melds.forEach(m => {
                meldsHTML += `<div style="display:flex; background:rgba(0,0,0,0.3); padding:2px 4px; border-radius:4px; margin-right:4px;">`;
                m.forEach(c => {
                    const url = (typeof c.getAssetUrl === 'function') ? c.getAssetUrl() : new Carta(c.valor, c.palo, c.esComodin, c.id).getAssetUrl();
                    meldsHTML += `<div class="meld-card-mini" style="background-image:url('${url}'); width:34px; height:50px; margin:0 -4px;" title="${c.valor} de ${c.palo}"></div>`;
                });
                meldsHTML += `</div>`;
            });
            meldsHTML += `</div>`;
        }

        let unmeldedHTML = '';
        if (p.unmelded && p.unmelded.length > 0) {
            unmeldedHTML += `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; align-items:center;">
                <span style="font-size:0.75rem; color:#e74c3c; font-weight:bold;">Sueltas (${p.puntosSueltos}p):</span>
                <div style="display:flex; margin-left:4px;">`;
            p.unmelded.forEach(c => {
                const url = (typeof c.getAssetUrl === 'function') ? c.getAssetUrl() : new Carta(c.valor, c.palo, c.esComodin, c.id).getAssetUrl();
                unmeldedHTML += `<div class="meld-card-mini" style="background-image:url('${url}'); width:34px; height:50px; margin:0 -4px;" title="${c.valor} de ${c.palo}"></div>`;
            });
            unmeldedHTML += `</div></div>`;
        }

        let displayName = d.name;
        if (d.seat === miSeat) {
            displayName = `${d.name || 'Tú'} (Tú)`;
        } else if (!displayName || displayName.trim() === '' || displayName.trim().toUpperCase() === 'TÚ') {
            displayName = (modoJuego === 'multiplayer') ? 'Rival' : `Bot ${d.seat === 1 ? 'Tatú' : (d.seat === 2 ? 'Gaucho' : 'Pampero')}`;
        }

        html += `
            <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="color:var(--gold); font-size:1.05rem;">${displayName}</strong>
                    <span style="font-weight:bold; font-size:1.1rem; color:${d.puntosRonda <= 0 ? '#2ecc71' : '#e74c3c'};">
                        ${d.puntosRonda > 0 ? '+' : ''}${d.puntosRonda} Pts
                    </span>
                </div>
                <div style="font-size:0.85rem; color:#bbb; margin-bottom:6px;">${d.motivo}</div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#ddd; margin-bottom:4px;">
                    <span>Puntaje total acumulado:</span>
                    <strong>${p.puntosAcumulados} / ${engine.config.limitePuntos} pts ${p.eliminado ? '(Eliminado)' : ''}</strong>
                </div>
                ${meldsHTML}
                ${unmeldedHTML}
            </div>
        `;
    });

    // Reenganche automático para bots si corresponde
    if (modoJuego === 'singleplayer') {
        engine.players.forEach(p => {
            if (p.isBot && engine.puedeReenganchar(p.seat)) {
                engine.reenganchar(p.seat);
                html += `
                    <div style="background:rgba(39, 174, 96, 0.2); border:1px solid #27ae60; border-radius:8px; padding:8px; margin-top:8px; font-size:0.85rem; color:#2ecc71; text-align:center;">
                        🔄 ${p.name} ha usado el reenganche con ${p.puntosAcumulados} pts.
                    </div>
                `;
            }
        });
    }

    const btnReenganchar = document.getElementById('btn-reenganchar');
    if (btnReenganchar) {
        if (engine.puedeReenganchar(miSeat)) {
            const activos = engine.players.filter(x => !x.eliminado);
            const maxPuntos = Math.max(...activos.map(x => x.puntosAcumulados));
            btnReenganchar.innerText = `🔄 Reengancharse al Partido con ${maxPuntos} pts`;
            btnReenganchar.style.display = 'flex';
            btnReenganchar.onclick = () => {
                engine.reenganchar(miSeat);
                playSound('card-deal');
                btnReenganchar.style.display = 'none';
                mostrarModalFinRonda();
                renderJuego();
            };
        } else {
            btnReenganchar.style.display = 'none';
        }
    }

    if (engine.partidoFinalizado && !engine.puedeReenganchar(miSeat)) {
        const ganador = engine.players[engine.ganadorPartido];
        html += `
            <div style="background:linear-gradient(135deg, #f1c40f, #e67e22); color:#000; padding:14px; border-radius:12px; text-align:center; font-weight:800; font-size:1.15rem; margin-top:12px;">
                🎉 ¡${ganador ? ganador.name : 'GANADOR'} ES EL CAMPEÓN DEL PARTIDO! 🎉
            </div>
        `;
    }

    body.innerHTML = html;
    modal.style.display = 'flex';

    // Si el usuario toca o hace scroll en el modal para leer las cartas, pausamos el auto-avance
    const pausarAutoAvance = () => {
        ocultarBotonSiguienteMano();
    };
    modal.onpointerdown = pausarAutoAvance;
    modal.onwheel = pausarAutoAvance;

    // Activar botón flotante con cuenta regresiva cómoda (8s) si no hay reenganche pendiente
    if (!engine.partidoFinalizado && !engine.puedeReenganchar(miSeat)) {
        iniciarConteoProximaMano();
    }
}

function iniciarConteoProximaMano() {
    ocultarBotonSiguienteMano();
    const btn = document.getElementById('btn-siguiente-mano');
    if (!btn) return;

    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        // En multijugador, el invitado espera al anfitrión
        return;
    }

    btn.style.display = 'block';
    let count = 8;
    btn.innerText = `🃏 Siguiente Mano (${count}s)`;

    autoAdvanceInterval = setInterval(() => {
        count--;
        if (count <= 0) {
            ocultarBotonSiguienteMano();
            avanzarSiguienteMano();
        } else {
            btn.innerText = `🃏 Siguiente Mano (${count}s)`;
        }
    }, 1000);
}

function ocultarBotonSiguienteMano() {
    if (autoAdvanceInterval) {
        clearInterval(autoAdvanceInterval);
        autoAdvanceInterval = null;
    }
    const btn = document.getElementById('btn-siguiente-mano');
    if (btn) btn.style.display = 'none';
}

function avanzarSiguienteMano() {
    ocultarBotonSiguienteMano();
    cerrarModal('modal-fin-ronda');
    selectedCardIndex = null;

    if (engine.partidoFinalizado) return;

    if (modoJuego === 'multiplayer' && miRol !== 'creador') {
        return; // Invitado espera actualización del anfitrión
    }

    const tableMeldsArea = document.getElementById('table-melds-area');
    if (tableMeldsArea) tableMeldsArea.style.display = 'none';

    engine.iniciarRonda();
    playSound('shuffle');
    if (modoJuego === 'multiplayer') {
        window.FirebaseManager.sincronizarEstado(engine);
    }
    renderJuego();

    verificarTurnoBot();
}

document.getElementById('btn-siguiente-mano').addEventListener('click', avanzarSiguienteMano);
document.getElementById('btn-cerrar-fin-ronda').addEventListener('click', avanzarSiguienteMano);

// -------------------------------------------------------------
// CONTROL DE MODALES (MARCADOR, REGLAS, CONFIG)
// -------------------------------------------------------------
function abrirModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function cerrarModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

document.querySelectorAll('.modal-close-btn, [data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.close || btn.closest('.modal-overlay').id;
        cerrarModal(target);
    });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && overlay.id !== 'modal-fin-ronda' && overlay.id !== 'modal-sala') {
            cerrarModal(overlay.id);
        }
    });
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            if (overlay.id !== 'modal-fin-ronda' && overlay.style.display === 'flex') {
                cerrarModal(overlay.id);
            }
        });
    }
});

document.getElementById('btn-reglamento').addEventListener('click', () => abrirModal('modal-reglamento'));
document.getElementById('btn-ver-reglamento-lobby').addEventListener('click', () => abrirModal('modal-reglamento'));
document.getElementById('btn-guia').addEventListener('click', () => abrirModal('modal-guia'));
document.getElementById('btn-config').addEventListener('click', () => abrirModal('modal-config'));
document.getElementById('btn-guardar-config').addEventListener('click', guardarConfigLocal);
document.getElementById('btn-salir').addEventListener('click', salirAlLobby);

// Marcador
document.getElementById('btn-marcador').addEventListener('click', () => {
    const tbody = document.getElementById('marcador-tbody');
    if (tbody && engine) {
        tbody.innerHTML = '';
        engine.players.forEach(p => {
            let pDisplayName = p.name;
            if (p.seat === miSeat) {
                pDisplayName = `${p.name || 'Tú'} (Tú)`;
            } else if (!pDisplayName || pDisplayName.trim() === '' || pDisplayName.trim().toUpperCase() === 'TÚ') {
                pDisplayName = (modoJuego === 'multiplayer') ? 'Rival' : `Bot ${p.seat === 1 ? 'Tatú' : (p.seat === 2 ? 'Gaucho' : 'Pampero')}`;
            }
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold;">${pDisplayName}</td>
                <td style="padding:10px; font-size:1.1rem; color:${p.puntosAcumulados > 80 ? '#e74c3c' : 'var(--gold)'};">${p.puntosAcumulados} / ${engine.config.limitePuntos}</td>
                <td style="padding:10px;">${p.eliminado ? '💀 Eliminado' : '🟢 En Juego'}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    abrirModal('modal-marcador');
});

// -------------------------------------------------------------
// BOTONES DEL LOBBY
// -------------------------------------------------------------
document.getElementById('btn-start-1v1').addEventListener('click', () => window.iniciarSolo(2));
document.getElementById('btn-start-4p').addEventListener('click', () => window.iniciarSolo(4));

// -------------------------------------------------------------
// MULTIJUGADOR ONLINE Y SINCRONIZACIÓN REMOTA
// -------------------------------------------------------------
let ultimaAccionProcesadaTs = 0;
function procesarAccionRemota(accion) {
    if (miRol !== 'creador' || !accion || !accion.tipo) return;
    if (accion.seat === miSeat) return;
    if (accion.ts && accion.ts <= ultimaAccionProcesadaTs) return;
    ultimaAccionProcesadaTs = accion.ts || Date.now();

    const seat = accion.seat;
    if (engine.fase !== 'acomodo' && seat !== engine.turnoSeat) return;

    if (accion.tipo === 'robar_mazo') {
        if (engine.fase === 'robar') {
            engine.robarMazo(seat);
            playSound('card-draw');
            window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
        }
    } else if (accion.tipo === 'robar_pozo') {
        if (engine.fase === 'robar') {
            engine.robarPozo(seat);
            playSound('card-draw');
            window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
        }
    } else if (accion.tipo === 'descartar') {
        if (engine.fase === 'descartar' && typeof accion.payload?.cardIndex === 'number') {
            engine.descartarCarta(seat, accion.payload.cardIndex);
            playSound('card-discard');
            window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
            verificarTurnoBot();
        }
    } else if (accion.tipo === 'cortar') {
        if (engine.fase === 'descartar' && typeof accion.payload?.cardIndex === 'number') {
            iniciarFaseAcomodoUI(seat, accion.payload.cardIndex);
        }
    } else if (accion.tipo === 'colocar_carta') {
        if (engine.fase === 'acomodo' && accion.payload?.cartaId) {
            engine.colocarCarta(seat, accion.payload.cartaId);
            window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
        }
    } else if (accion.tipo === 'acomodar_todas') {
        if (engine.fase === 'acomodo') {
            engine.acomodarTodasDelJugador(seat);
            window.FirebaseManager.sincronizarEstado(engine);
            renderJuego();
        }
    } else if (accion.tipo === 'confirmar_corte') {
        if (engine.fase === 'acomodo') {
            finalizarFaseAcomodoUI();
        }
    }
}

function aplicarEstadoJuegoRemoto(estadoJuego) {
    if (!estadoJuego) return;
    if (!engine) engine = new CongaEngine();
    engine.partidoIniciado = true;
    engine.rondaActual = estadoJuego.rondaActual;
    engine.turnoSeat = estadoJuego.turnoSeat;
    engine.fase = estadoJuego.fase;
    engine.ultimoCortador = estadoJuego.ultimoCortador;
    engine.partidoFinalizado = !!estadoJuego.partidoFinalizado;
    engine.ganadorPartido = estadoJuego.ganadorPartido;

    // Información de corte y acomodo
    if (estadoJuego.corteInfo) {
        engine.corteInfo = {
            ...estadoJuego.corteInfo,
            melds: (estadoJuego.corteInfo.melds || []).map(m => m.map(c => new Carta(c.valor, c.palo, c.esComodin, c.id))),
            unmelded: (estadoJuego.corteInfo.unmelded || []).map(c => new Carta(c.valor, c.palo, c.esComodin, c.id)),
            cartaDescarte: estadoJuego.corteInfo.cartaDescarte ? new Carta(
                estadoJuego.corteInfo.cartaDescarte.valor,
                estadoJuego.corteInfo.cartaDescarte.palo,
                estadoJuego.corteInfo.cartaDescarte.esComodin,
                estadoJuego.corteInfo.cartaDescarte.id
            ) : null
        };
    } else {
        engine.corteInfo = null;
    }

    if (Array.isArray(estadoJuego.cartasAcomodadas)) {
        engine.cartasAcomodadas = estadoJuego.cartasAcomodadas.map(a => ({
            ...a,
            carta: a.carta ? new Carta(a.carta.valor, a.carta.palo, a.carta.esComodin, a.carta.id) : null
        }));
    } else {
        engine.cartasAcomodadas = [];
    }

    // Pozo de descarte
    if (Array.isArray(estadoJuego.discardPile)) {
        engine.discardPile = estadoJuego.discardPile.map(c => new Carta(c.valor, c.palo, c.esComodin, c.id));
    }

    // Representación visual del mazo
    if (typeof estadoJuego.deckCount === 'number') {
        engine.deck = new Array(estadoJuego.deckCount).fill(null).map((_, i) => new Carta(1, 'Espada', false, `deck_${i}`));
    }

    // Jugadores
    if (Array.isArray(estadoJuego.players)) {
        engine.numPlayers = estadoJuego.players.length;
        engine.players = estadoJuego.players.map(pData => {
            const p = new Jugador(pData.seat, pData.name, pData.isBot);
            p.puntosAcumulados = pData.puntosAcumulados || 0;
            p.eliminado = !!pData.eliminado;
            p.reenganches = pData.reenganches || 0;
            p.puntosSueltos = pData.puntosSueltos || 0;
            p.hand = (pData.hand || []).map(c => new Carta(c.valor, c.palo, c.esComodin, c.id));
            p.melds = (pData.melds || []).map(m => m.map(c => new Carta(c.valor, c.palo, c.esComodin, c.id)));
            p.unmelded = (pData.unmelded || []).map(c => new Carta(c.valor, c.palo, c.esComodin, c.id));
            return p;
        });
    }

    // Modal de fin de ronda
    if (estadoJuego.resultadoRonda) {
        engine.resultadoRonda = estadoJuego.resultadoRonda;
        const modal = document.getElementById('modal-fin-ronda');
        if (modal && modal.style.display !== 'flex') {
            mostrarModalFinRonda();
        }
    } else {
        cerrarModal('modal-fin-ronda');
    }

    renderJuego();
}
window.aplicarEstadoJuegoRemoto = aplicarEstadoJuegoRemoto;

// Multijugador Online: Abrir Modal Crear Sala
document.getElementById('btn-crear-online').addEventListener('click', () => {
    if (!window.FirebaseManager || !window.FirebaseManager.isAvailable()) {
        alert("Firebase no está conectado. Revisa tu conexión a internet.");
        return;
    }
    const modalTitle = document.getElementById('modal-sala-title');
    if (modalTitle) modalTitle.innerText = "🌐 Crear Sala Online";
    document.getElementById('form-crear-sala').style.display = 'flex';
    document.getElementById('form-unirse-sala').style.display = 'none';
    document.getElementById('info-sala-espera').style.display = 'none';
    const crearInput = document.getElementById('input-crear-nombre');
    if (crearInput) {
        crearInput.value = (engine.config.nombreJugador && engine.config.nombreJugador !== 'TÚ') ? engine.config.nombreJugador : '';
        crearInput.focus();
    }
    abrirModal('modal-sala');
});

// Confirmar Crear Sala (Host)
const btnConfirmarCrear = document.getElementById('btn-confirmar-crear');
if (btnConfirmarCrear) {
    btnConfirmarCrear.addEventListener('click', async () => {
        if (!window.FirebaseManager || !window.FirebaseManager.isAvailable()) {
            alert("Firebase no está conectado. Revisa tu conexión a internet.");
            return;
        }
        const inputNom = document.getElementById('input-crear-nombre');
        let nombre = inputNom ? inputNom.value.trim() : '';
        if (!nombre || nombre.toUpperCase() === 'TÚ') {
            nombre = (engine.config.nombreJugador && engine.config.nombreJugador.toUpperCase() !== 'TÚ') 
                ? engine.config.nombreJugador 
                : 'Anfitrión';
        }
        setPlayerNickname(nombre);

        try {
            const res = await window.FirebaseManager.crearSala(nombre, 2, true, engine.config);
            miSeat = 0;
            miRol = 'creador';
            modoJuego = 'multiplayer';

            const modalTitle = document.getElementById('modal-sala-title');
            if (modalTitle) modalTitle.innerText = "🌐 Sala de Espera";
            document.getElementById('form-crear-sala').style.display = 'none';
            document.getElementById('form-unirse-sala').style.display = 'none';
            document.getElementById('info-sala-espera').style.display = 'block';
            document.getElementById('sala-codigo-display').innerText = res.codigo;
            document.getElementById('btn-host-iniciar').style.display = 'block';
            
            document.getElementById('room-code-tag').innerText = res.codigo;
            document.getElementById('room-code-tag').style.display = 'inline-block';

            window.FirebaseManager.escucharSala((sala) => {
                const lista = document.getElementById('sala-lista-jugadores');
                if (lista && sala.jugadores) {
                    lista.innerHTML = sala.jugadores.map(j => `<div style="padding:6px; background:rgba(255,255,255,0.1); border-radius:6px;">👤 ${j.name} (Listo)</div>`).join('');
                }
            }, (accion) => {
                procesarAccionRemota(accion);
            });
        } catch(err) {
            alert("Error creando sala: " + err.message);
        }
    });
}

// Host hace click en Iniciar Partida
document.getElementById('btn-host-iniciar').addEventListener('click', async () => {
    modoJuego = 'multiplayer';
    miSeat = 0;
    miRol = 'creador';
    cerrarModal('modal-sala');
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('btn-salir').style.display = 'block';

    await window.FirebaseManager.iniciarPartidaOnline(engine);
    renderJuego();
    verificarTurnoBot();
});

// Unirse con Código
document.getElementById('btn-unirse-online').addEventListener('click', () => {
    const modalTitle = document.getElementById('modal-sala-title');
    if (modalTitle) modalTitle.innerText = "🔑 Unirse a Sala Online";
    document.getElementById('form-crear-sala').style.display = 'none';
    document.getElementById('form-unirse-sala').style.display = 'flex';
    document.getElementById('info-sala-espera').style.display = 'none';
    const unirseInput = document.getElementById('input-unirse-nombre');
    if (unirseInput) {
        unirseInput.value = (engine.config.nombreJugador && engine.config.nombreJugador !== 'TÚ') ? engine.config.nombreJugador : '';
    }
    const codeInput = document.getElementById('input-codigo-sala');
    if (codeInput) codeInput.value = '';
    abrirModal('modal-sala');
});

// Unirse a una sala pública desde el lobby
window.unirseDesdeListaPublica = function(codigo) {
    const modalTitle = document.getElementById('modal-sala-title');
    if (modalTitle) modalTitle.innerText = "🔑 Unirse a Sala Online";
    document.getElementById('form-crear-sala').style.display = 'none';
    document.getElementById('form-unirse-sala').style.display = 'flex';
    document.getElementById('info-sala-espera').style.display = 'none';
    document.getElementById('input-codigo-sala').value = codigo;
    const unirseInput = document.getElementById('input-unirse-nombre');
    if (unirseInput) {
        unirseInput.value = (engine.config.nombreJugador && engine.config.nombreJugador !== 'TÚ') ? engine.config.nombreJugador : '';
    }
    abrirModal('modal-sala');
};

document.getElementById('btn-confirmar-unirse').addEventListener('click', async () => {
    const code = document.getElementById('input-codigo-sala').value.trim();
    if (!code) return alert("Por favor ingresa un código válido.");

    const inputNom = document.getElementById('input-unirse-nombre');
    let nombre = inputNom ? inputNom.value.trim() : '';
    if (!nombre || nombre.toUpperCase() === 'TÚ') {
        nombre = (engine.config.nombreJugador && engine.config.nombreJugador.toUpperCase() !== 'TÚ') 
            ? engine.config.nombreJugador 
            : 'Invitado';
    }
    setPlayerNickname(nombre);

    try {
        const res = await window.FirebaseManager.unirseSala(code, nombre);
        
        modoJuego = 'multiplayer';
        miSeat = res.seat;
        miRol = 'invitado';

        const modalTitle = document.getElementById('modal-sala-title');
        if (modalTitle) modalTitle.innerText = "🌐 Sala de Espera";
        document.getElementById('form-crear-sala').style.display = 'none';
        document.getElementById('form-unirse-sala').style.display = 'none';
        document.getElementById('info-sala-espera').style.display = 'block';
        document.getElementById('sala-codigo-display').innerText = code;
        document.getElementById('btn-host-iniciar').style.display = 'none';
        document.getElementById('room-code-tag').innerText = code;
        document.getElementById('room-code-tag').style.display = 'inline-block';

        window.FirebaseManager.escucharSala((sala) => {
            const lista = document.getElementById('sala-lista-jugadores');
            if (lista && sala.jugadores) {
                lista.innerHTML = sala.jugadores.map(j => `<div style="padding:6px; background:rgba(255,255,255,0.1); border-radius:6px;">👤 ${j.name} (Listo)</div>`).join('');
            }

            if (sala.estado === 'jugando' && sala.estadoJuego) {
                cerrarModal('modal-sala');
                document.getElementById('start-screen').style.display = 'none';
                document.getElementById('btn-salir').style.display = 'block';
                aplicarEstadoJuegoRemoto(sala.estadoJuego);
            } else if (sala.estado === 'finalizado') {
                alert("La sala fue cerrada por el anfitrión.");
                salirAlLobby();
            }
        });
    } catch(e) {
        alert("Error al unirse: " + e.message);
    }
});

// Escuchar Salas Públicas en el lobby
if (window.FirebaseManager && window.FirebaseManager.isAvailable()) {
    window.FirebaseManager.escucharSalasPublicas((salas) => {
        const container = document.getElementById('lista-salas-container');
        if (!container) return;
        if (salas.length === 0) {
            container.innerHTML = '<div style="color:#888; font-size:0.85rem; text-align:center;">No hay salas públicas esperando. ¡Sé el primero en crear una!</div>';
            return;
        }
        container.innerHTML = salas.map(s => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.08); padding:8px 12px; border-radius:8px;">
                <div><strong>${s.codigo}</strong> (${s.creador})</div>
                <button class="btn-icon" onclick="window.unirseDesdeListaPublica('${s.codigo}')" style="padding:4px 10px; font-size:0.8rem;">Entrar</button>
            </div>
        `).join('');
    });
}

// Sincronización en vivo de campos de Apodo
['input-lobby-nombre', 'input-crear-nombre', 'input-unirse-nombre', 'cfg-nombre'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', (e) => setPlayerNickname(e.target.value));
    }
});

// -------------------------------------------------------------
// ATAJOS DE TECLADO
// -------------------------------------------------------------
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        return;
    }

    if (!engine || !engine.partidoIniciado || engine.turnoSeat !== miSeat) return;

    if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
        // Espacio o R: Robar del mazo
        if (engine.fase === 'robar') {
            e.preventDefault();
            document.getElementById('btn-robar-mazo').click();
        }
    } else if (e.key === 'p' || e.key === 'P') {
        // P: Robar del pozo
        if (engine.fase === 'robar') {
            e.preventDefault();
            document.getElementById('btn-robar-pozo').click();
        }
    } else if (e.key === 'd' || e.key === 'D') {
        // D: Descartar
        if (engine.fase === 'descartar' && selectedCardIndex !== null) {
            e.preventDefault();
            ejecutarDescarteHumano();
        }
    } else if (e.key === 'c' || e.key === 'C') {
        // C: Cortar
        if (engine.fase === 'descartar' && selectedCardIndex !== null && engine.puedeCortar(miSeat, selectedCardIndex)) {
            e.preventDefault();
            document.getElementById('btn-cortar').click();
        }
    } else if (e.key >= '1' && e.key <= '8') {
        // Teclas 1 a 8 para seleccionar carta
        const idx = parseInt(e.key) - 1;
        if (engine.players[miSeat] && idx < engine.players[miSeat].hand.length) {
            e.preventDefault();
            seleccionarCarta(idx);
        }
    }
});

// Inicializar configuración y escala responsiva al cargar
cargarConfigLocal();
window.addEventListener('resize', ajustarEscalaResponsiva);
window.addEventListener('orientationchange', ajustarEscalaResponsiva);
ajustarEscalaResponsiva();
