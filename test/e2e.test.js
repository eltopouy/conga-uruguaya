// test/e2e.test.js
// Suite de Tests E2E de Simulación de Juego (1v1 y 4 Jugadores)

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { Carta, Jugador, CongaEngine } = require('../js/engine/CongaEngine');
const { CongaBot } = require('../js/engine/CongaBot');
const { SoundManager } = require('../js/soundmanager');
const { FirebaseManager } = require('../js/firebasemanager');

let totalE2E = 0;
let passedE2E = 0;

function testE2E(name, fn) {
    totalE2E++;
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passedE2E++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(err);
    }
}

console.log('\n======================================================');
console.log('🚀 INICIANDO TESTS E2E DE SIMULACIÓN DE CONGA');
console.log('======================================================\n');

// 1. Simulación de Flujo 1 vs 1
console.log('🤖 1. Simulación de Flujo 1 vs 1:');

testE2E('Iniciar Partida 1 vs 1 reparte 7 cartas a cada jugador y pone 1 carta en el pozo', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    assert.strictEqual(engine.players.length, 2);
    assert.strictEqual(engine.players[0].hand.length, 7);
    assert.strictEqual(engine.players[1].hand.length, 7);
    assert.strictEqual(engine.discardPile.length, 1);
    assert.strictEqual(engine.fase, 'robar');
    assert.strictEqual(engine.partidoIniciado, true);
    assert.strictEqual(engine.partidoFinalizado, false);
});

testE2E('Simulación completa de turno de jugador humano y respuesta de bot', () => {
    const engine = new CongaEngine();
    const bot = new CongaBot();
    engine.configurarPartida(2);

    // Turno de Jugador 0 (Humano)
    assert.strictEqual(engine.turnoSeat, 0);
    const robada = engine.robarMazo(0);
    assert.notStrictEqual(robada, null);
    assert.strictEqual(engine.players[0].hand.length, 8);
    assert.strictEqual(engine.fase, 'descartar');

    // Descartar carta del índice 7
    const descartada = engine.descartarCarta(0, 7);
    assert.notStrictEqual(descartada, null);
    assert.strictEqual(engine.players[0].hand.length, 7);
    assert.strictEqual(engine.turnoSeat, 1); // Ahora es el turno del bot
    assert.strictEqual(engine.fase, 'robar');

    // Turno del Bot 1
    const roboBot = bot.decidirRobo(engine, 1);
    if (roboBot === 'pozo') engine.robarPozo(1);
    else engine.robarMazo(1);

    assert.strictEqual(engine.players[1].hand.length, 8);
    assert.strictEqual(engine.fase, 'descartar');

    const jugadaBot = bot.decidirJugadaDescarte(engine, 1);
    assert.notStrictEqual(jugadaBot, null);

    if (jugadaBot.cortar) {
        engine.cortar(1, jugadaBot.cardIndex);
        assert.strictEqual(engine.fase, 'fin_ronda');
    } else {
        engine.descartarCarta(1, jugadaBot.cardIndex);
        assert.strictEqual(engine.players[1].hand.length, 7);
        assert.strictEqual(engine.turnoSeat, 0); // Vuelve al humano
        assert.strictEqual(engine.fase, 'robar');
    }
});

// 2. Simulación de Modo 4 Jugadores
console.log('\n👥 2. Modo 4 Jugadores (Todos vs Todos):');

testE2E('Inicialización correcta de 4 Jugadores y rotación de mano', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(4);

    assert.strictEqual(engine.players.length, 4);
    for (let i = 0; i < 4; i++) {
        assert.strictEqual(engine.players[i].hand.length, 7);
    }
    assert.strictEqual(engine.deck.length, 50 - (4 * 7) - 1); // 50 - 28 - 1 = 21 cartas en mazo
});

testE2E('Avanzar turno en 4 jugadores rota 0 -> 1 -> 2 -> 3 -> 0', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(4);

    assert.strictEqual(engine.turnoSeat, 0);
    engine.robarMazo(0);
    engine.descartarCarta(0, 0);
    assert.strictEqual(engine.turnoSeat, 1);

    engine.robarMazo(1);
    engine.descartarCarta(1, 0);
    assert.strictEqual(engine.turnoSeat, 2);

    engine.robarMazo(2);
    engine.descartarCarta(2, 0);
    assert.strictEqual(engine.turnoSeat, 3);

    engine.robarMazo(3);
    engine.descartarCarta(3, 0);
    assert.strictEqual(engine.turnoSeat, 0);
});

// 3. Auto-organización de Mano
console.log('\n🃏 3. Auto-organización de Mano:');

testE2E('autoOrganizarMano agrupa melds primero y cartas sueltas ordenadas al final', () => {
    const engine = new CongaEngine();
    const mano = [
        new Carta(10, 'Oro'),  // Suelta (10 pts)
        new Carta(4, 'Espada'), // Meld parte 1
        new Carta(1, 'Copa'),   // Suelta (1 pt)
        new Carta(5, 'Espada'), // Meld parte 2
        new Carta(6, 'Espada'), // Meld parte 3
        new Carta(2, 'Basto'),  // Suelta (2 pts)
        new Carta(7, 'Oro')     // Suelta (7 pts)
    ];

    const organizada = engine.autoOrganizarMano(mano);
    assert.strictEqual(organizada.length, 7);

    // Las primeras 3 cartas deben ser la escalera (4, 5, 6 de Espada)
    assert.strictEqual(organizada[0].palo, 'Espada');
    assert.strictEqual(organizada[1].palo, 'Espada');
    assert.strictEqual(organizada[2].palo, 'Espada');

    // Las 4 últimas son las sueltas ordenadas por valor (1, 2, 7, 10)
    assert.strictEqual(organizada[3].getPuntosSueltos(), 1);
    assert.strictEqual(organizada[4].getPuntosSueltos(), 2);
    assert.strictEqual(organizada[5].getPuntosSueltos(), 7);
    assert.strictEqual(organizada[6].getPuntosSueltos(), 10);
});

testE2E('Reordenamiento manual de cartas en mano permuta correctamente la posición de las cartas', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);
    const hand = engine.players[0].hand;
    const card0 = hand[0];
    const card3 = hand[3];

    // Simular el movimiento de la carta en índice 3 hacia la posición 0
    const [movedCard] = hand.splice(3, 1);
    hand.splice(0, 0, movedCard);

    assert.strictEqual(hand[0].id, card3.id);
    assert.strictEqual(hand[1].id, card0.id);
    assert.strictEqual(hand.length, 7);

    // Mover la carta de posición 0 al final (índice 6)
    const [movedCard2] = hand.splice(0, 1);
    hand.splice(6, 0, movedCard2);
    assert.strictEqual(hand[6].id, card3.id);
    assert.strictEqual(hand[0].id, card0.id);
});

// 4. SoundManager y Web Audio
console.log('\n🔊 4. SoundManager y Web Audio:');

testE2E('SoundManager se inicializa, permite mutear y no lanza excepciones sin AudioContext real', () => {
    const sm = new SoundManager();
    sm.setMuted(true);
    assert.strictEqual(sm.muted, true);
    sm.setMuted(false);
    assert.strictEqual(sm.muted, false);
    assert.doesNotThrow(() => sm.play('card-draw'));
    assert.doesNotThrow(() => sm.play('cut'));
    assert.doesNotThrow(() => sm.play('conga'));
});

// 5. PWA y Manifiesto
console.log('\n📱 5. PWA, Service Worker y Manifiesto:');

testE2E('sw.js existe y contiene lista de precaché con archivos clave', () => {
    const swPath = path.join(__dirname, '..', 'sw.js');
    assert.strictEqual(fs.existsSync(swPath), true);
    const content = fs.readFileSync(swPath, 'utf8');
    assert.strictEqual(content.includes('CACHE_NAME'), true);
    assert.strictEqual(content.includes('PRECACHE_ASSETS'), true);
    assert.strictEqual(content.includes('CongaEngine.js'), true);
});

testE2E('manifest.json es válido y sus íconos existen en el disco', () => {
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    assert.strictEqual(fs.existsSync(manifestPath), true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.name, 'Conga Uruguaya Premium');
    assert.strictEqual(Array.isArray(manifest.icons), true);

    manifest.icons.forEach(ico => {
        const fullPath = path.join(__dirname, '..', ico.src);
        assert.strictEqual(fs.existsSync(fullPath), true, `El ícono ${ico.src} debe existir en disco`);
    });
});

console.log('\n======================================================');
console.log(`🏁 RESULTADO E2E: ${passedE2E}/${totalE2E} tests pasados con éxito.`);
console.log('======================================================\n');

if (passedE2E !== totalE2E) {
    process.exit(1);
}
