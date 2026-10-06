// js/app.js
// Controlador Principal de Interfaz y Flujo de Juego para Conga Uruguaya

let engine = new CongaEngine();
let bot = new CongaBot('normal');
let sound = new SoundManager();
window.engine = engine;
window.sound = sound;

let modoJuego = 'singleplayer'; // 'singleplayer' | 'multiplayer'
let selectedCardIndex = null;
let autoAdvanceInterval = null;
let isBotThinking = false;

// Helpers de sonido
function playSound(name) {
    if (sound) sound.play(name);
}

// -------------------------------------------------------------
// INICIALIZACIÓN Y CONFIGURACIÓN
// -------------------------------------------------------------
function cargarConfigLocal() {
    try {
        const saved = localStorage.getItem('conga_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            engine.config = { ...engine.config, ...parsed };
            const cfgName = document.getElementById('cfg-nombre');
            const cfgLim = document.getElementById('cfg-limite-puntos');
            const cfgDeck = document.getElementById('cfg-deck-size');
            const cfgJokers = document.getElementById('cfg-comodines');
            const cfgSound = document.getElementById('cfg-sonido');
            if (cfgName) cfgName.value = engine.config.nombreJugador || 'TÚ';
            if (cfgLim) cfgLim.value = engine.config.limitePuntos || 100;
            if (cfgDeck) cfgDeck.value = engine.config.deckSize || 48;
            if (cfgJokers) cfgJokers.checked = engine.config.conComodines !== false;
            if (cfgSound) cfgSound.checked = !sound.muted;
        }
    } catch (e) {}
}

function guardarConfigLocal() {
    try {
        const cfgName = document.getElementById('cfg-nombre').value.trim() || 'TÚ';
        const cfgLim = parseInt(document.getElementById('cfg-limite-puntos').value) || 100;
        const cfgDeck = parseInt(document.getElementById('cfg-deck-size').value) || 48;
        const cfgJokers = document.getElementById('cfg-comodines').checked;
        const cfgSound = document.getElementById('cfg-sonido').checked;

        engine.config.nombreJugador = cfgName;
        engine.config.limitePuntos = cfgLim;
        engine.config.deckSize = cfgDeck;
        engine.config.conComodines = cfgJokers;
        sound.setMuted(!cfgSound);

        localStorage.setItem('conga_config', JSON.stringify({
            nombreJugador: cfgName,
            limitePuntos: cfgLim,
            deckSize: cfgDeck,
            conComodines: cfgJokers
        }));

        cerrarModal('modal-config');
        if (engine.players[0]) engine.players[0].name = cfgName;
        renderJuego();
    } catch (e) {}
}

// -------------------------------------------------------------
// INICIO DE PARTIDAS
// -------------------------------------------------------------
window.iniciarSolo = function(numJugadores = 2) {
    modoJuego = 'singleplayer';
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
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('btn-salir').style.display = 'none';
    document.getElementById('room-code-tag').style.display = 'none';
}

// -------------------------------------------------------------
// CONTROLADOR DE TURNO DEL BOT
// -------------------------------------------------------------
async function verificarTurnoBot() {
    if (modoJuego !== 'singleplayer') return;
    if (engine.fase === 'fin_ronda' || engine.partidoFinalizado) return;

    const currentSeat = engine.turnoSeat;
    const currentPlayer = engine.players[currentSeat];

    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.eliminado) return;
    if (isBotThinking) return;

    isBotThinking = true;
    renderJuego();

    // Tiempo de pensamiento natural (1s - 1.6s)
    await new Promise(r => setTimeout(r, 1100 + Math.random() * 500));

    // 1. Paso 1: Robar (Mazo o Pozo)
    if (engine.fase === 'robar' && engine.turnoSeat === currentSeat) {
        const decisionRobo = bot.decidirRobo(engine, currentSeat);
        if (decisionRobo === 'pozo') {
            engine.robarPozo(currentSeat);
            playSound('card-draw');
        } else {
            engine.robarMazo(currentSeat);
            playSound('card-draw');
        }
        renderJuego();
    }

    // Tiempo de decisión para el descarte
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 400));

    // 2. Paso 2: Descartar o Cortar
    if (engine.fase === 'descartar' && engine.turnoSeat === currentSeat) {
        const jugada = bot.decidirJugadaDescarte(engine, currentSeat);
        if (jugada) {
            if (jugada.cortar) {
                // El bot CORTA la ronda
                const ok = engine.cortar(currentSeat, jugada.cardIndex);
                if (ok) {
                    playSound('cut');
                    mostrarModalFinRonda();
                    isBotThinking = false;
                    return;
                }
            }
            // Descarte normal
            engine.descartarCarta(currentSeat, jugada.cardIndex);
            playSound('card-discard');
        }
    }

    isBotThinking = false;
    renderJuego();

    // Si el siguiente turno también es de un bot
    setTimeout(() => {
        verificarTurnoBot();
    }, 400);
}

// -------------------------------------------------------------
// RENDERIZADO VISUAL DEL JUEGO
// -------------------------------------------------------------
function renderJuego() {
    if (!engine || !engine.partidoIniciado) return;

    // 1. Rivales (Superior)
    const oppArea = document.getElementById('opponents-area');
    if (oppArea) {
        oppArea.innerHTML = '';
        engine.players.forEach(p => {
            if (p.seat !== 0) {
                const badge = document.createElement('div');
                badge.className = `opponent-badge ${engine.turnoSeat === p.seat ? 'active-turn' : ''}`;
                
                let miniCardsHTML = '';
                const cardCount = p.hand.length;
                for (let i = 0; i < cardCount; i++) {
                    miniCardsHTML += '<div class="mini-card-back"></div>';
                }

                badge.innerHTML = `
                    <div class="opponent-name">${p.name} ${p.eliminado ? '💀 (Eliminado)' : ''}</div>
                    <div class="opponent-score">${p.puntosAcumulados} pts / ${p.hand.length} cartas</div>
                    <div class="opponent-cards-mini">${miniCardsHTML}</div>
                `;
                oppArea.appendChild(badge);
            }
        });
    }

    // 2. Centro de la mesa: Mazo de Robo y Pozo
    const deckCountEl = document.getElementById('deck-counter');
    if (deckCountEl) deckCountEl.innerText = engine.deck.length;

    const deckEl = document.getElementById('deck-pile-element');
    const isMyTurnToDraw = (engine.turnoSeat === 0 && engine.fase === 'robar');
    if (deckEl) {
        if (isMyTurnToDraw) deckEl.classList.add('highlight-draw');
        else deckEl.classList.remove('highlight-draw');
    }

    const discardEl = document.getElementById('discard-pile-element');
    if (discardEl) {
        const topDiscard = engine.discardPile.length > 0 ? engine.discardPile[engine.discardPile.length - 1] : null;
        if (topDiscard) {
            discardEl.style.backgroundImage = `url("${topDiscard.getAssetUrl()}")`;
            discardEl.style.opacity = '1';
        } else {
            discardEl.style.backgroundImage = 'none';
            discardEl.style.opacity = '0.3';
        }

        if (isMyTurnToDraw && topDiscard) discardEl.classList.add('highlight-draw');
        else discardEl.classList.remove('highlight-draw');
    }

    // 3. Banner de Estado y Turno
    const turnText = document.getElementById('turn-text');
    const turnIcon = document.getElementById('turn-icon');
    const banner = document.getElementById('turn-status-banner');
    
    if (turnText && banner) {
        if (engine.turnoSeat === 0) {
            banner.classList.add('my-turn');
            turnIcon.innerText = "⭐";
            if (engine.fase === 'robar') {
                turnText.innerText = "Tu turno: Robá del mazo o del pozo";
            } else if (engine.fase === 'descartar') {
                turnText.innerText = "Tu turno: Selecciona una carta para descartar o cortar";
            }
        } else {
            banner.classList.remove('my-turn');
            turnIcon.innerText = "⏳";
            const botPlayer = engine.players[engine.turnoSeat];
            turnText.innerText = `Turno de ${botPlayer ? botPlayer.name : 'Rival'}...`;
        }
    }

    // 4. Mano del Jugador (Seat 0)
    const plyHandFan = document.getElementById('player-hand-fan');
    const myPlayer = engine.players[0];
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
            cardEl.style.backgroundImage = `url("${carta.getAssetUrl()}")`;
            cardEl.dataset.index = idx;

            // Inclinación suave en abanico
            const angle = (idx - (totalCards - 1) / 2) * 4;
            const yOffset = Math.abs(idx - (totalCards - 1) / 2) * 3;
            cardEl.style.transform = `rotate(${angle}deg) translateY(${yOffset}px)`;

            if (selectedCardIndex === idx) {
                cardEl.classList.add('selected-card');
            }

            // Badge de ligada o suelta
            const badge = document.createElement('div');
            badge.className = `card-meld-badge ${meldedSet.has(carta.id) ? 'badge-ligada' : 'badge-suelta'}`;
            badge.innerText = meldedSet.has(carta.id) ? "LIGADA" : `${carta.getPuntosSueltos()}p`;
            cardEl.appendChild(badge);

            // Permitir arrastre y reordenamiento manual de la carta con mouse o touch
            habilitarArrastreReorden(cardEl, idx, myPlayer.hand, plyHandFan);

            plyHandFan.appendChild(cardEl);
        });

        // Actualizar indicador de puntos sueltos
        const deadwoodEl = document.getElementById('deadwood-pts');
        const deadwoodBadge = document.getElementById('deadwood-badge');
        if (deadwoodEl && deadwoodBadge) {
            deadwoodEl.innerText = `${analysis.puntosSueltos} pts`;
            if (analysis.puntosSueltos <= (engine.config.limiteCorte || 5) && myPlayer.hand.length === 8 && engine.turnoSeat === 0 && engine.fase === 'descartar') {
                deadwoodBadge.classList.add('can-cut-text');
                deadwoodBadge.title = "¡Cumples las condiciones para Cortar!";
            } else {
                deadwoodBadge.classList.remove('can-cut-text');
            }
        }
    }

    // 5. Botones de Acción
    const btnRobarMazo = document.getElementById('btn-robar-mazo');
    const btnRobarPozo = document.getElementById('btn-robar-pozo');
    const btnDescartar = document.getElementById('btn-descartar');
    const btnCortar = document.getElementById('btn-cortar');

    const esMiTurno = (engine.turnoSeat === 0 && !myPlayer.eliminado);

    if (btnRobarMazo) {
        btnRobarMazo.disabled = !(esMiTurno && engine.fase === 'robar');
    }
    if (btnRobarPozo) {
        btnRobarPozo.disabled = !(esMiTurno && engine.fase === 'robar' && engine.discardPile.length > 0);
    }
    if (btnDescartar) {
        btnDescartar.disabled = !(esMiTurno && engine.fase === 'descartar' && selectedCardIndex !== null);
    }
    if (btnCortar) {
        const canCut = esMiTurno && engine.fase === 'descartar' && selectedCardIndex !== null && engine.puedeCortar(0, selectedCardIndex);
        btnCortar.disabled = !canCut;
        if (canCut) btnCortar.classList.add('can-cut');
        else btnCortar.classList.remove('can-cut');
    }
}

// -------------------------------------------------------------
// INTERACCIÓN DE JUGADOR HUMANO
// -------------------------------------------------------------
function seleccionarCarta(idx) {
    if (engine.turnoSeat !== 0 || engine.fase !== 'descartar') return;
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
            } else if (dy < -80 && engine.turnoSeat === 0 && engine.fase === 'descartar') {
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
        seleccionarCarta(index);
    });
}
window.habilitarArrastreReorden = habilitarArrastreReorden;

// Robar Mazo
document.getElementById('btn-robar-mazo').addEventListener('click', () => {
    if (engine.turnoSeat !== 0 || engine.fase !== 'robar') return;
    engine.robarMazo(0);
    playSound('card-draw');
    renderJuego();
});

// Robar Pozo
document.getElementById('btn-robar-pozo').addEventListener('click', () => {
    if (engine.turnoSeat !== 0 || engine.fase !== 'robar') return;
    engine.robarPozo(0);
    playSound('card-draw');
    renderJuego();
});

// Click directo en los pozos del centro
document.getElementById('stock-pile-container').addEventListener('click', () => {
    if (engine.turnoSeat === 0 && engine.fase === 'robar') {
        engine.robarMazo(0);
        playSound('card-draw');
        renderJuego();
    }
});

document.getElementById('discard-pile-container').addEventListener('click', () => {
    if (engine.turnoSeat === 0) {
        if (engine.fase === 'robar') {
            engine.robarPozo(0);
            playSound('card-draw');
            renderJuego();
        } else if (engine.fase === 'descartar' && selectedCardIndex !== null) {
            ejecutarDescarteHumano();
        }
    }
});

// Descartar Carta Seleccionada
function ejecutarDescarteHumano() {
    if (engine.turnoSeat !== 0 || engine.fase !== 'descartar' || selectedCardIndex === null) return;
    const idx = selectedCardIndex;
    selectedCardIndex = null;
    engine.descartarCarta(0, idx);
    playSound('card-discard');
    renderJuego();

    verificarTurnoBot();
}
document.getElementById('btn-descartar').addEventListener('click', ejecutarDescarteHumano);

// Cortar Ronda
document.getElementById('btn-cortar').addEventListener('click', () => {
    if (engine.turnoSeat !== 0 || engine.fase !== 'descartar' || selectedCardIndex === null) return;
    const ok = engine.cortar(0, selectedCardIndex);
    if (ok) {
        selectedCardIndex = null;
        playSound('cut');
        mostrarModalFinRonda();
    }
});

// Auto-ordenar Mano
document.getElementById('btn-auto-ordenar').addEventListener('click', () => {
    if (!engine.players[0]) return;
    engine.players[0].hand = engine.autoOrganizarMano(engine.players[0].hand);
    selectedCardIndex = null;
    playSound('card-deal');
    renderJuego();
});

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
    } else {
        const cortador = engine.players[res.cortadorSeat];
        title.innerText = `✂️ ${cortador.name} ha cortado la ronda`;
    }

    let html = '';
    res.detalles.forEach(d => {
        const p = engine.players[d.seat];
        html += `
            <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="color:var(--gold); font-size:1.05rem;">${d.name}</strong>
                    <span style="font-weight:bold; font-size:1.1rem; color:${d.puntosRonda <= 0 ? '#2ecc71' : '#e74c3c'};">
                        ${d.puntosRonda > 0 ? '+' : ''}${d.puntosRonda} Pts
                    </span>
                </div>
                <div style="font-size:0.85rem; color:#bbb; margin-bottom:6px;">${d.motivo}</div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#ddd;">
                    <span>Puntaje total acumulado:</span>
                    <strong>${p.puntosAcumulados} / ${engine.config.limitePuntos} pts</strong>
                </div>
            </div>
        `;
    });

    if (engine.partidoFinalizado) {
        const ganador = engine.players[engine.ganadorPartido];
        html += `
            <div style="background:linear-gradient(135deg, #f1c40f, #e67e22); color:#000; padding:14px; border-radius:12px; text-align:center; font-weight:800; font-size:1.15rem; margin-top:12px;">
                🎉 ¡${ganador ? ganador.name : 'GANADOR'} ES EL CAMPEÓN DEL PARTIDO! 🎉
            </div>
        `;
    }

    body.innerHTML = html;
    modal.style.display = 'flex';

    // Activar botón flotante con cuenta regresiva de 3s
    if (!engine.partidoFinalizado) {
        iniciarConteoProximaMano();
    }
}

function iniciarConteoProximaMano() {
    ocultarBotonSiguienteMano();
    const btn = document.getElementById('btn-siguiente-mano');
    if (!btn) return;

    btn.style.display = 'block';
    let count = 3;
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

    if (engine.partidoFinalizado) return;

    engine.iniciarRonda();
    playSound('shuffle');
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
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            tr.innerHTML = `
                <td style="padding:10px; font-weight:bold;">${p.name}</td>
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

// Multijugador Online: Crear Sala
document.getElementById('btn-crear-online').addEventListener('click', async () => {
    if (!window.FirebaseManager || !window.FirebaseManager.isAvailable()) {
        alert("Firebase no está conectado. Revisa tu conexión a internet.");
        return;
    }
    try {
        const nombre = engine.config.nombreJugador || "Anfitrión";
        const res = await window.FirebaseManager.crearSala(nombre, 2, true, engine.config);
        
        document.getElementById('form-unirse-sala').style.display = 'none';
        document.getElementById('info-sala-espera').style.display = 'block';
        document.getElementById('sala-codigo-display').innerText = res.codigo;
        document.getElementById('btn-host-iniciar').style.display = 'block';
        
        document.getElementById('room-code-tag').innerText = res.codigo;
        document.getElementById('room-code-tag').style.display = 'inline-block';

        abrirModal('modal-sala');

        window.FirebaseManager.escucharSala((sala) => {
            const lista = document.getElementById('sala-lista-jugadores');
            if (lista && sala.jugadores) {
                lista.innerHTML = sala.jugadores.map(j => `<div style="padding:6px; background:rgba(255,255,255,0.1); border-radius:6px;">👤 ${j.name} (Listo)</div>`).join('');
            }
        });
    } catch(err) {
        alert("Error creando sala: " + err.message);
    }
});

// Host hace click en Iniciar Partida
document.getElementById('btn-host-iniciar').addEventListener('click', async () => {
    modoJuego = 'multiplayer';
    cerrarModal('modal-sala');
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('btn-salir').style.display = 'block';

    await window.FirebaseManager.iniciarPartidaOnline(engine);
    renderJuego();
});

// Unirse con Código
document.getElementById('btn-unirse-online').addEventListener('click', () => {
    document.getElementById('form-unirse-sala').style.display = 'flex';
    document.getElementById('info-sala-espera').style.display = 'none';
    abrirModal('modal-sala');
});

document.getElementById('btn-confirmar-unirse').addEventListener('click', async () => {
    const code = document.getElementById('input-codigo-sala').value.trim();
    if (!code) return alert("Por favor ingresa un código válido.");
    try {
        const nombre = engine.config.nombreJugador || "Invitado";
        const res = await window.FirebaseManager.unirseSala(code, nombre);
        
        modoJuego = 'multiplayer';
        cerrarModal('modal-sala');
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('btn-salir').style.display = 'block';
        document.getElementById('room-code-tag').innerText = code;
        document.getElementById('room-code-tag').style.display = 'inline-block';

        window.FirebaseManager.escucharSala((sala) => {
            if (sala.estado === 'jugando' && sala.estadoJuego) {
                // Sincronizar estado
                engine.fase = sala.estadoJuego.fase;
                engine.turnoSeat = sala.estadoJuego.turnoSeat;
                renderJuego();
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
                <button class="btn-icon" onclick="document.getElementById('input-codigo-sala').value='${s.codigo}'; document.getElementById('btn-confirmar-unirse').click();" style="padding:4px 10px; font-size:0.8rem;">Entrar</button>
            </div>
        `).join('');
    });
}

// -------------------------------------------------------------
// ATAJOS DE TECLADO
// -------------------------------------------------------------
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
        return;
    }

    if (!engine || !engine.partidoIniciado || engine.turnoSeat !== 0) return;

    if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
        // Espacio o R: Robar del mazo
        if (engine.fase === 'robar') {
            e.preventDefault();
            engine.robarMazo(0);
            playSound('card-draw');
            renderJuego();
        }
    } else if (e.key === 'p' || e.key === 'P') {
        // P: Robar del pozo
        if (engine.fase === 'robar') {
            e.preventDefault();
            engine.robarPozo(0);
            playSound('card-draw');
            renderJuego();
        }
    } else if (e.key === 'd' || e.key === 'D') {
        // D: Descartar
        if (engine.fase === 'descartar' && selectedCardIndex !== null) {
            e.preventDefault();
            ejecutarDescarteHumano();
        }
    } else if (e.key === 'c' || e.key === 'C') {
        // C: Cortar
        if (engine.fase === 'descartar' && selectedCardIndex !== null && engine.puedeCortar(0, selectedCardIndex)) {
            e.preventDefault();
            document.getElementById('btn-cortar').click();
        }
    } else if (e.key >= '1' && e.key <= '8') {
        // Teclas 1 a 8 para seleccionar carta
        const idx = parseInt(e.key) - 1;
        if (engine.players[0] && idx < engine.players[0].hand.length) {
            e.preventDefault();
            seleccionarCarta(idx);
        }
    }
});

// Inicializar configuración al cargar
cargarConfigLocal();
