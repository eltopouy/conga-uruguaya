// test/conga.test.js
// Suite de Tests Unitarios para el Motor de Conga Uruguaya

const assert = require('assert');
const { Carta, Jugador, CongaEngine } = require('../js/engine/CongaEngine');
const { CongaBot } = require('../js/engine/CongaBot');

let totalTests = 0;
let passedTests = 0;

function test(nombre, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ ${nombre}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ ${nombre}`);
        console.error(err);
    }
}

console.log('\n========================================');
console.log('🎴 INICIANDO TESTS DE CONGA URUGUAYA');
console.log('========================================\n');

// 1. Estructura de Cartas y Mazo
console.log('📦 1. Mazo y Puntos de Cartas:');

test('Cartas tienen valores de puntos sueltos correctos (As=1, figuras=10, comodín=25)', () => {
    const as = new Carta(1, 'Espada');
    const cinco = new Carta(5, 'Oro');
    const sota = new Carta(10, 'Copa');
    const rey = new Carta(12, 'Basto');
    const comodin = new Carta(0, 'Comodín', true);

    assert.strictEqual(as.getPuntosSueltos(), 1);
    assert.strictEqual(cinco.getPuntosSueltos(), 5);
    assert.strictEqual(sota.getPuntosSueltos(), 10);
    assert.strictEqual(rey.getPuntosSueltos(), 10);
    assert.strictEqual(comodin.getPuntosSueltos(), 25);
});

test('Creación de mazo de 48 cartas + 2 comodines (50 en total)', () => {
    const engine = new CongaEngine({ deckSize: 48, conComodines: true });
    const mazo = engine.crearMazo();
    assert.strictEqual(mazo.length, 50);
    assert.strictEqual(mazo.filter(c => c.esComodin).length, 2);
});

test('Creación de mazo de 40 cartas sin comodines', () => {
    const engine = new CongaEngine({ deckSize: 40, conComodines: false });
    const mazo = engine.crearMazo();
    assert.strictEqual(mazo.length, 40);
    assert.strictEqual(mazo.filter(c => c.esComodin).length, 0);
    assert.strictEqual(mazo.some(c => c.valor === 8 || c.valor === 9), false);
});

// 2. Validación de Combinaciones (Escaleras y Piernas)
console.log('\n⚔️ 2. Validación de Combinaciones:');

test('Escalera natural del mismo palo es válida (4, 5, 6 de Espadas)', () => {
    const engine = new CongaEngine();
    const cartas = [
        new Carta(4, 'Espada'),
        new Carta(5, 'Espada'),
        new Carta(6, 'Espada')
    ];
    assert.strictEqual(engine.esEscaleraValida(cartas), true);
});

test('Escalera rechaza cartas de palos distintos', () => {
    const engine = new CongaEngine();
    const cartas = [
        new Carta(4, 'Espada'),
        new Carta(5, 'Basto'),
        new Carta(6, 'Espada')
    ];
    assert.strictEqual(engine.esEscaleraValida(cartas), false);
});

test('Escalera con comodín en el medio es válida (3 de Copas, Comodín, 5 de Copas)', () => {
    const engine = new CongaEngine();
    const cartas = [
        new Carta(3, 'Copa'),
        new Carta(0, 'Comodín', true),
        new Carta(5, 'Copa')
    ];
    assert.strictEqual(engine.esEscaleraValida(cartas), true);
});

test('Pierna natural (trío del mismo número con palos diferentes)', () => {
    const engine = new CongaEngine();
    const cartas = [
        new Carta(7, 'Espada'),
        new Carta(7, 'Basto'),
        new Carta(7, 'Oro')
    ];
    assert.strictEqual(engine.esPiernaValida(cartas), true);
});

test('Pierna con comodín es válida (dos 11 de palos distintos + Comodín)', () => {
    const engine = new CongaEngine();
    const cartas = [
        new Carta(11, 'Espada'),
        new Carta(11, 'Copa'),
        new Carta(0, 'Comodín', true)
    ];
    assert.strictEqual(engine.esPiernaValida(cartas), true);
});

test('Pierna rechaza palos duplicados (dos 5 de Espadas)', () => {
    const engine = new CongaEngine();
    const cartas = [
        new Carta(5, 'Espada'),
        new Carta(5, 'Espada'),
        new Carta(5, 'Oro')
    ];
    assert.strictEqual(engine.esPiernaValida(cartas), false);
});

// 3. Algoritmo de Detección Óptima de Melds y Corte
console.log('\n👑 3. Detección Óptima de Melds:');

test('Corte en 0 (-10 pts): mano de 7 cartas con 4 de escalera + 3 de trío', () => {
    const engine = new CongaEngine();
    const mano = [
        new Carta(1, 'Oro'), new Carta(2, 'Oro'), new Carta(3, 'Oro'), new Carta(4, 'Oro'), // Escalera de 4
        new Carta(6, 'Espada'), new Carta(6, 'Basto'), new Carta(6, 'Copa')                 // Trío de 6s
    ];
    const res = engine.detectarMejoresMelds(mano);
    assert.strictEqual(res.esCorteCero, true);
    assert.strictEqual(res.puntosSueltos, 0);
    assert.strictEqual(res.melds.length, 2);
    assert.strictEqual(res.unmelded.length, 0);
});

test('¡CONGA LIMPIA! (7 cartas consecutivas del mismo palo sin comodín)', () => {
    const engine = new CongaEngine({ deckSize: 48 });
    const mano = [
        new Carta(1, 'Espada'), new Carta(2, 'Espada'), new Carta(3, 'Espada'),
        new Carta(4, 'Espada'), new Carta(5, 'Espada'), new Carta(6, 'Espada'), new Carta(7, 'Espada')
    ];
    const res = engine.detectarMejoresMelds(mano);
    assert.strictEqual(res.esConga, true);
    assert.strictEqual(res.esCongaLimpia, true);
    assert.strictEqual(res.esCongaConComodin, false);
});

test('Conga con comodín (7 cartas con 1 comodín)', () => {
    const engine = new CongaEngine({ deckSize: 48 });
    const mano = [
        new Carta(1, 'Basto'), new Carta(2, 'Basto'), new Carta(0, 'Comodín', true),
        new Carta(4, 'Basto'), new Carta(5, 'Basto'), new Carta(6, 'Basto'), new Carta(7, 'Basto')
    ];
    const res = engine.detectarMejoresMelds(mano);
    assert.strictEqual(res.esConga, true);
    assert.strictEqual(res.esCongaLimpia, false);
    assert.strictEqual(res.esCongaConComodin, true);
});

test('Mano con 1 trío y 4 cartas sueltas calcula exactamente los puntos sueltos', () => {
    const engine = new CongaEngine();
    const mano = [
        new Carta(4, 'Oro'), new Carta(4, 'Copa'), new Carta(4, 'Basto'), // Trío de 4s (ligado)
        new Carta(1, 'Espada'), // 1 pt
        new Carta(2, 'Espada'), // 2 pts
        new Carta(3, 'Copa'),   // 3 pts
        new Carta(10, 'Oro')    // 10 pts
    ];
    const res = engine.detectarMejoresMelds(mano);
    assert.strictEqual(res.melds.length, 1);
    assert.strictEqual(res.unmelded.length, 4);
    assert.strictEqual(res.puntosSueltos, 16); // 1 + 2 + 3 + 10 = 16 pts
});

// 4. Mecánica de Turno: Robar, Descartar y Cortar
console.log('\n🎲 4. Mecánica de Turnos y Corte:');

test('Robar del mazo otorga 1 carta y cambia fase a descartar', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);
    assert.strictEqual(engine.fase, 'robar');
    assert.strictEqual(engine.players[0].hand.length, 7);

    const carta = engine.robarMazo(0);
    assert.notStrictEqual(carta, null);
    assert.strictEqual(engine.players[0].hand.length, 8);
    assert.strictEqual(engine.fase, 'descartar');
});

test('Descartar carta reduce mano a 7 y pasa el turno al siguiente jugador', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);
    engine.robarMazo(0);

    const pozoAntes = engine.discardPile.length;
    const descartada = engine.descartarCarta(0, 0);

    assert.notStrictEqual(descartada, null);
    assert.strictEqual(engine.players[0].hand.length, 7);
    assert.strictEqual(engine.discardPile.length, pozoAntes + 1);
    assert.strictEqual(engine.turnoSeat, 1);
    assert.strictEqual(engine.fase, 'robar');
});

test('puedeCortar valida que los puntos sueltos sean <= limiteCorte (5)', () => {
    const engine = new CongaEngine({ limiteCorte: 5 });
    engine.configurarPartida(2);

    // Preparar mano con 3 y 3 ligadas + 1 suelta de 3 pts + 1 carta basura para descartar
    engine.players[0].hand = [
        new Carta(1, 'Oro'), new Carta(2, 'Oro'), new Carta(3, 'Oro'), // Escalera 3
        new Carta(7, 'Espada'), new Carta(7, 'Basto'), new Carta(7, 'Copa'), // Trío 3
        new Carta(3, 'Basto'), // Suelta = 3 pts (<= 5)
        new Carta(12, 'Espada') // Descarte (índice 7)
    ];
    engine.fase = 'descartar';
    engine.turnoSeat = 0;

    assert.strictEqual(engine.puedeCortar(0, 7), true, 'Debe permitir cortar descartando la 12');
    assert.strictEqual(engine.puedeCortar(0, 6), false, 'Descartar la 3 deja el Rey de 10 pts suelto (>5)');
});

// 5. Layoffs (Acomodo) y Puntuación
console.log('\n📊 5. Layoffs y Cálculo de Puntuación:');

test('Acomodo de cartas: rival acomoda carta suelta en la escalera del cortador', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Cortador tiene escalera 3-4-5 de Espada y una carta de 2 pts
    const cortador = engine.players[0];
    cortador.hand = [
        new Carta(3, 'Espada'), new Carta(4, 'Espada'), new Carta(5, 'Espada'),
        new Carta(2, 'Oro')
    ];
    cortador.melds = [[cortador.hand[0], cortador.hand[1], cortador.hand[2]]];
    cortador.unmelded = [cortador.hand[3]];
    cortador.puntosSueltos = 2;

    // Rival tiene 6 de Espada suelto
    const rival = engine.players[1];
    rival.hand = [new Carta(6, 'Espada')];
    rival.melds = [];
    rival.unmelded = [rival.hand[0]];
    rival.puntosSueltos = 6;

    engine.aplicarAcomodoCartas(0);

    assert.strictEqual(rival.unmelded.length, 0, 'La carta del rival debió acomodarse');
    assert.strictEqual(rival.puntosSueltos, 0, 'Puntos del rival se reducen a 0');
});

test('Penalización por corte fallido: si el rival empata o tiene menos puntos, el cortador se castiga con +10 pts de recargo', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Cortador corta con 4 puntos
    engine.ultimoCortador = 0;
    engine.players[0].hand = [new Carta(4, 'Oro')];
    engine.players[0].unmelded = [new Carta(4, 'Oro')];
    engine.players[0].puntosSueltos = 4;

    // Rival tiene 2 puntos (le ganó al cortador)
    engine.players[1].hand = [new Carta(2, 'Copa')];
    engine.players[1].unmelded = [new Carta(2, 'Copa')];
    engine.players[1].puntosSueltos = 2;

    engine.calcularPuntajesRonda({ esCorteCero: false, esConga: false, esCongaLimpia: false });

    assert.strictEqual(engine.players[0].puntosAcumulados, 14, 'Cortador recibe 4 + 10 de castigo = 14 pts');
    assert.strictEqual(engine.players[1].puntosAcumulados, 0, 'Rival que superó al cortador suma 0 pts');
    assert.strictEqual(engine.resultadoRonda.pasaronAlCortador, true);
});

test('Corte limpio en 0 otorga -10 puntos de premio', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);
    engine.players[0].puntosAcumulados = 20;

    engine.ultimoCortador = 0;
    engine.players[0].unmelded = [];
    engine.players[0].puntosSueltos = 0;

    engine.players[1].unmelded = [new Carta(7, 'Oro')];
    engine.players[1].puntosSueltos = 7;

    engine.calcularPuntajesRonda({ esCorteCero: true, esConga: false, esCongaLimpia: false });

    assert.strictEqual(engine.players[0].puntosAcumulados, 10, '20 - 10 = 10 pts');
    assert.strictEqual(engine.players[1].puntosAcumulados, 7);
});

test('Victoria directa del partido por Conga Limpia', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    engine.ultimoCortador = 0;
    engine.players[0].unmelded = [];
    engine.players[0].puntosSueltos = 0;

    engine.calcularPuntajesRonda({ esCongaLimpia: true, esCorteCero: true });

    assert.strictEqual(engine.partidoFinalizado, true);
    assert.strictEqual(engine.ganadorPartido, 0);
});

// 6. Eliminación y Reenganche
console.log('\n🚪 6. Eliminación y Reenganche:');

test('Jugador que supera 100 puntos queda eliminado', () => {
    const engine = new CongaEngine({ limitePuntos: 100 });
    engine.configurarPartida(2);

    engine.players[1].puntosAcumulados = 105;
    engine.verificarEliminaciones();

    assert.strictEqual(engine.players[1].eliminado, true);
    assert.strictEqual(engine.partidoFinalizado, true);
    assert.strictEqual(engine.ganadorPartido, 0);
});

test('Reenganche permite a un jugador eliminado volver con el puntaje más alto', () => {
    const engine = new CongaEngine({ limitePuntos: 100, permitirReenganche: true });
    engine.configurarPartida(3);

    engine.players[0].puntosAcumulados = 40;
    engine.players[1].puntosAcumulados = 75;
    engine.players[2].puntosAcumulados = 102;
    engine.players[2].eliminado = true;

    assert.strictEqual(engine.puedeReenganchar(2), true);
    engine.reenganchar(2);

    assert.strictEqual(engine.players[2].eliminado, false);
    assert.strictEqual(engine.players[2].puntosAcumulados, 75, 'Debe reengancharse con 75 pts (el mayor activo)');
    assert.strictEqual(engine.players[2].reenganches, 1);
});

// 7. Inteligencia Artificial (CongaBot)
console.log('\n🤖 7. Táctica de Inteligencia Artificial (CongaBot):');

test('CongaBot roba del pozo si la carta completa o reduce puntos', () => {
    const bot = new CongaBot('normal');
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Bot tiene 3 y 4 de Espadas en mano
    engine.players[1].hand = [
        new Carta(3, 'Espada'),
        new Carta(4, 'Espada'),
        new Carta(10, 'Oro'),
        new Carta(11, 'Oro'),
        new Carta(12, 'Oro'),
        new Carta(1, 'Copa'),
        new Carta(6, 'Basto')
    ];

    // En el pozo hay un 5 de Espadas (completa la escalera 3-4-5)
    engine.discardPile = [new Carta(5, 'Espada')];

    const decision = bot.decidirRobo(engine, 1);
    assert.strictEqual(decision, 'pozo', 'El bot debe alzar el 5 de Espadas del pozo');
});

test('CongaBot decide descartar la carta que deja menor deadwood y corta si es <= 5 pts', () => {
    const bot = new CongaBot('normal');
    const engine = new CongaEngine({ limiteCorte: 5 });
    engine.configurarPartida(2);

    engine.players[1].hand = [
        new Carta(1, 'Oro'), new Carta(2, 'Oro'), new Carta(3, 'Oro'), // Escalera (ligada)
        new Carta(7, 'Espada'), new Carta(7, 'Basto'), new Carta(7, 'Copa'), // Trío (ligado)
        new Carta(2, 'Basto'),  // 2 pts sueltos
        new Carta(12, 'Espada') // 10 pts sueltos (basura)
    ];

    const jugada = bot.decidirJugadaDescarte(engine, 1);
    assert.strictEqual(jugada.carta.valor, 12, 'El bot debe descartar el Rey (12)');
    assert.strictEqual(jugada.cortar, true, 'El bot debe decidir cortar con 2 puntos');
});

console.log('\n========================================');
console.log(`🏁 RESULTADO: ${passedTests}/${totalTests} tests pasados.`);
console.log('========================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
