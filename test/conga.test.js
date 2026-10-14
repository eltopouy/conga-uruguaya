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

test('El mano recibe 8 cartas para salir descartando, el rival 7 y el pozo inicia vacío', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);
    assert.strictEqual(engine.turnoSeat, 0, 'El mano es el jugador 0');
    assert.strictEqual(engine.players[0].hand.length, 8, 'El mano recibe 8 cartas');
    assert.strictEqual(engine.players[1].hand.length, 7, 'El rival recibe 7 cartas');
    assert.strictEqual(engine.discardPile.length, 0, 'El pozo inicia vacío');
    assert.strictEqual(engine.fase, 'descartar', 'El mano inicia directamente en fase descartar');

    // El mano descarta su carta para inaugurar el pozo
    const descartada = engine.descartarCarta(0, 0);
    assert.notStrictEqual(descartada, null);
    assert.strictEqual(engine.players[0].hand.length, 7);
    assert.strictEqual(engine.discardPile.length, 1, 'La carta descartada inaugura el pozo');
    assert.strictEqual(engine.turnoSeat, 1, 'Pasa el turno al jugador 1');
    assert.strictEqual(engine.fase, 'robar', 'El jugador 1 debe robar');

    // Jugador 1 roba del mazo y pasa a 8 cartas
    const robada = engine.robarMazo(1);
    assert.notStrictEqual(robada, null);
    assert.strictEqual(engine.players[1].hand.length, 8);
    assert.strictEqual(engine.fase, 'descartar');
});

test('Descartar carta reduce mano a 7 y pasa el turno al siguiente jugador', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Mano (0) descarta para salir
    engine.descartarCarta(0, 0);

    // Jugador 1 roba del mazo
    engine.robarMazo(1);

    const pozoAntes = engine.discardPile.length;
    const descartada = engine.descartarCarta(1, 0);

    assert.notStrictEqual(descartada, null);
    assert.strictEqual(engine.players[1].hand.length, 7);
    assert.strictEqual(engine.discardPile.length, pozoAntes + 1);
    assert.strictEqual(engine.turnoSeat, 0);
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

// 8. Resiliencia de Motor y Reglas Avanzadas
console.log('\n🛡️ 8. Resiliencia de Motor y Reglas Avanzadas:');

test('No se permite descartar la misma carta que se acaba de robar del pozo', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    const cartaPozo = new Carta(7, 'Oro');
    engine.discardPile = [cartaPozo];
    engine.fase = 'robar';
    engine.turnoSeat = 0;

    engine.robarPozo(0);
    assert.strictEqual(engine.fase, 'descartar');
    assert.strictEqual(engine.origenRobo, 'pozo');

    // Intentar tirar la misma carta recién robada (la última de la mano)
    const cardIndexRobada = engine.players[0].hand.length - 1;
    const ok = engine.descartarCarta(0, cardIndexRobada);
    assert.strictEqual(ok, null, 'No debe permitir descartar la carta recién alzada del pozo');
    assert.strictEqual(engine.fase, 'descartar', 'La fase debe permanecer en descartar');
});

test('Agotamiento total de mazo y pozo finaliza la ronda sin bloqueo infinito', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Vaciar mazo y dejar pozo en 1 carta
    engine.deck = [];
    engine.discardPile = [new Carta(4, 'Copas')];
    engine.fase = 'robar';
    engine.turnoSeat = 0;

    // Robar del mazo cuando no hay cartas en mazo ni para reciclar en pozo
    const carta = engine.robarMazo(0);
    assert.strictEqual(carta, null, 'No debe robar carta');
    assert.strictEqual(engine.fase, 'fin_ronda', 'La ronda debe terminar por mazo agotado');
    assert(engine.resultadoRonda !== null, 'Debe generarse un resultado de ronda');
    assert.strictEqual(engine.resultadoRonda.mazoAgotado, true);
});

test('Configuración: mostrarPuntosCartas es false por defecto (oculto en esquinas)', () => {
    const engine = new CongaEngine();
    assert.strictEqual(engine.config.mostrarPuntosCartas, false);

    const engineConPuntos = new CongaEngine({ mostrarPuntosCartas: true });
    assert.strictEqual(engineConPuntos.config.mostrarPuntosCartas, true);
});

test('Mazo de 40 cartas: Escalera con comodín cubriendo el salto 7 -> 10 -> 11 es válida', () => {
    const engine = new CongaEngine({ deckSize: 40 });
    const run = [
        new Carta(7, 'Espada'),
        new Carta(0, 'Comodín', true),
        new Carta(11, 'Espada')
    ];
    assert.strictEqual(engine.esEscaleraValida(run), true, '7 - Comodín - 11 debe ser válida en mazo de 40');

    const runConDiez = [
        new Carta(7, 'Oro'),
        new Carta(10, 'Oro'),
        new Carta(11, 'Oro')
    ];
    assert.strictEqual(engine.esEscaleraValida(runConDiez), true, '7 - 10 - 11 natural debe ser válida en mazo de 40');
});

test('puedeCortar rechaza cortar si se intenta descartar la carta recién alzada del pozo', () => {
    const engine = new CongaEngine({ limiteCorte: 5 });
    engine.configurarPartida(2);

    const cartaPozo = new Carta(12, 'Espada');
    engine.discardPile = [cartaPozo];
    engine.fase = 'robar';
    engine.turnoSeat = 0;

    engine.players[0].hand = [
        new Carta(1, 'Oro'), new Carta(2, 'Oro'), new Carta(3, 'Oro'),
        new Carta(7, 'Espada'), new Carta(7, 'Basto'), new Carta(7, 'Copa'),
        new Carta(2, 'Basto')
    ];

    engine.robarPozo(0); // Ahora tiene 8 cartas, la última es cartaPozo (12 de Espada)
    const idxPozo = engine.players[0].hand.length - 1;

    // Descartar la 12 de Espada dejaría 2 pts sueltos (<=5), pero FUE ALZADA DEL POZO en este turno
    assert.strictEqual(engine.puedeCortar(0, idxPozo), false, 'No puede cortar descartando la carta alzada del pozo');
});

test('CongaBot jamás elige la carta alzada del pozo para descartar o cortar', () => {
    const bot = new CongaBot('normal');
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    const cartaPozo = new Carta(12, 'Copas');
    engine.discardPile = [cartaPozo];
    engine.turnoSeat = 1;
    engine.fase = 'robar';

    engine.players[1].hand = [
        new Carta(1, 'Oro'), new Carta(2, 'Oro'), new Carta(3, 'Oro'),
        new Carta(4, 'Oro'), new Carta(5, 'Oro'), new Carta(6, 'Oro'),
        new Carta(7, 'Oro')
    ];

    engine.robarPozo(1);
    const jugada = bot.decidirJugadaDescarte(engine, 1);
    assert.notStrictEqual(jugada, null);
    assert.notStrictEqual(jugada.carta.id, cartaPozo.id, 'El bot nunca debe descartar la carta que acaba de levantar del pozo');
});

test('Acomodo multi-pase: acomoda múltiples cartas consecutivas sin importar su orden en unmelded', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    const cortador = engine.players[0];
    cortador.hand = [
        new Carta(3, 'Espada'), new Carta(4, 'Espada'), new Carta(5, 'Espada'),
        new Carta(2, 'Oro')
    ];
    cortador.melds = [[cortador.hand[0], cortador.hand[1], cortador.hand[2]]];
    cortador.unmelded = [cortador.hand[3]];
    cortador.puntosSueltos = 2;

    const rival = engine.players[1];
    // Rival tiene 7 de Espada primero y 6 de Espada segundo en unmelded
    rival.hand = [new Carta(7, 'Espada'), new Carta(6, 'Espada')];
    rival.melds = [];
    rival.unmelded = [rival.hand[0], rival.hand[1]];
    rival.puntosSueltos = 13;

    engine.aplicarAcomodoCartas(0);

    assert.strictEqual(rival.unmelded.length, 0, 'Ambas cartas deben acomodarse');
    assert.strictEqual(rival.puntosSueltos, 0, 'Puntos del rival deben ser 0 tras acomodo de 6 y 7');
});

test('Flujo interactivo de Corte y Acomodo (iniciarCorte -> colocarCarta -> finalizarCorte)', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Jugador 0 tiene 8 cartas (fase descartar): Escalera 4-5-6 de Oro + 2 de Basto (suelta) + 12 de Espada (descarte)
    const c0 = engine.players[0];
    c0.hand = [
        new Carta(4, 'Oro'), new Carta(5, 'Oro'), new Carta(6, 'Oro'),
        new Carta(2, 'Basto'), new Carta(12, 'Espada')
    ];
    engine.fase = 'descartar';
    engine.turnoSeat = 0;

    // Jugador 1 tiene 7 de Oro (extensión de la escalera del cortador) y 10 de Copas (no liga)
    const c1 = engine.players[1];
    c1.hand = [new Carta(7, 'Oro', false, 'c1_7oro'), new Carta(10, 'Copas', false, 'c1_10copas')];

    // Iniciar corte descartando la carta index 4 (12 de Espada)
    const corteInfo = engine.iniciarCorte(0, 4);
    assert.ok(corteInfo, 'El corte debe iniciarse exitosamente');
    assert.strictEqual(engine.fase, 'acomodo', 'La fase debe cambiar a acomodo');
    assert.strictEqual(corteInfo.permiteAcomodo, true, 'Corte con 2 pts debe permitir acomodo');
    assert.strictEqual(c0.hand.length, 4, 'El cortador queda con 4 cartas tras descartar la de corte');

    // Rival verifica si puede colocar sus cartas
    const fit7 = engine.puedeColocarCarta(1, 'c1_7oro');
    assert.ok(fit7, 'El 7 de Oro debe poder colocarse en la escalera 4-5-6');
    const fit10 = engine.puedeColocarCarta(1, 'c1_10copas');
    assert.strictEqual(fit10, null, 'El 10 de Copas no debe poder colocarse');

    // Rival coloca el 7 de Oro interactivamente
    const colocada = engine.colocarCarta(1, 'c1_7oro');
    assert.strictEqual(colocada, true, 'La colocación debe ser exitosa');
    assert.strictEqual(c1.hand.length, 1, 'La mano del rival se reduce a 1 carta');
    assert.strictEqual(c1.puntosSueltos, 10, 'Puntos sueltos del rival se reducen a 10');
    assert.strictEqual(engine.cartasAcomodadas.length, 1, 'Se registra en cartasAcomodadas');

    // Finalizar corte
    const fin = engine.finalizarCorte();
    assert.strictEqual(fin, true, 'El corte debe finalizar correctamente');
    assert.strictEqual(engine.fase, 'fin_ronda', 'Fase cambia a fin_ronda');
    assert.ok(engine.resultadoRonda, 'Se computa el resultado de la ronda');
});

test('Corte en 0 o Conga bloquea la colocación de cartas', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);

    // Jugador 0 tiene 8 cartas: Escalera 1 a 7 de Copas + 10 de Espada (descarte)
    const c0 = engine.players[0];
    c0.hand = [
        new Carta(1, 'Copa'), new Carta(2, 'Copa'), new Carta(3, 'Copa'),
        new Carta(4, 'Copa'), new Carta(5, 'Copa'), new Carta(6, 'Copa'), new Carta(7, 'Copa'),
        new Carta(10, 'Espada')
    ];
    engine.fase = 'descartar';
    engine.turnoSeat = 0;

    const c1 = engine.players[1];
    c1.hand = [new Carta(8, 'Copa', false, 'c1_8copa')];

    // Corta con Conga
    const corteInfo = engine.iniciarCorte(0, 7);
    assert.ok(corteInfo);
    assert.strictEqual(corteInfo.permiteAcomodo, false, 'Conga no debe permitir acomodo');

    // El rival intenta colocar carta
    const fit = engine.puedeColocarCarta(1, 'c1_8copa');
    assert.strictEqual(fit, null, 'No se debe permitir colocar cartas ante Conga');
});

test('Reenganche funciona correctamente en modo 1 vs 1 (al quedar 1 sobreviviente)', () => {
    const engine = new CongaEngine({ limitePuntos: 100, permitirReenganche: true });
    engine.configurarPartida(2);

    engine.players[0].puntosAcumulados = 60;
    engine.players[1].puntosAcumulados = 105;
    engine.verificarEliminaciones();

    // En 1 vs 1, el bot queda eliminado y sobrevivientes.length === 1
    assert.strictEqual(engine.players[1].eliminado, true);
    assert.strictEqual(engine.partidoFinalizado, true, 'El partido se marca como finalizado temporalmente');

    // Sin embargo, debe permitir el reenganche al no ser Conga Limpia
    assert.strictEqual(engine.puedeReenganchar(1), true, 'Jugador 1 debe poder reengancharse en 1 vs 1');

    const ok = engine.reenganchar(1);
    assert.strictEqual(ok, true);
    assert.strictEqual(engine.players[1].eliminado, false, 'Jugador 1 ya no está eliminado');
    assert.strictEqual(engine.players[1].puntosAcumulados, 60, 'Reengancha con los puntos del único sobreviviente (60 pts)');
    assert.strictEqual(engine.partidoFinalizado, false, 'El partido se reanuda al haber reenganche');
    assert.strictEqual(engine.players[1].reenganches, 1);
    assert.strictEqual(engine.puedeReenganchar(1), false, 'No puede reengancharse por segunda vez');
});

test('ordenarMeld ordena escaleras naturales, con comodín intercalado y mazo de 40', () => {
    const engine48 = new CongaEngine({ deckSize: 48 });
    const desordenada = [
        new Carta(6, 'Espada'),
        new Carta(4, 'Espada'),
        new Carta(5, 'Espada')
    ];
    const ord48 = engine48.ordenarMeld(desordenada);
    assert.deepStrictEqual(ord48.map(c => c.valor), [4, 5, 6], 'Debe ordenar 4, 5, 6');

    // Escalera con comodín intercalado (3, Comodín, 5)
    const conComodin = [
        new Carta(5, 'Copa'),
        new Carta(0, 'Comodín', true),
        new Carta(3, 'Copa')
    ];
    const ordCom = engine48.ordenarMeld(conComodin);
    assert.strictEqual(ordCom[0].valor, 3);
    assert.strictEqual(ordCom[1].esComodin, true);
    assert.strictEqual(ordCom[2].valor, 5);

    // Mazo de 40 (6, 7, 10 de Oro)
    const engine40 = new CongaEngine({ deckSize: 40 });
    const desordenada40 = [
        new Carta(10, 'Oro'),
        new Carta(6, 'Oro'),
        new Carta(7, 'Oro')
    ];
    const ord40 = engine40.ordenarMeld(desordenada40);
    assert.deepStrictEqual(ord40.map(c => c.valor), [6, 7, 10], 'En mazo de 40 cartas, 7 -> 10 es correlativo');
});

test('colocarCarta mantiene los melds ordenados secuencialmente', () => {
    const engine = new CongaEngine({ limiteCorte: 5 });
    engine.configurarPartida(2);

    // Jugador 0 corta con escalera 4, 5, 6 de Basto
    const p0 = engine.players[0];
    p0.hand = [
        new Carta(4, 'Basto'), new Carta(5, 'Basto'), new Carta(6, 'Basto'),
        new Carta(1, 'Oro'), new Carta(2, 'Oro'), new Carta(1, 'Espada'), new Carta(1, 'Copa'),
        new Carta(10, 'Espada')
    ];
    engine.fase = 'descartar';
    engine.turnoSeat = 0;

    const p1 = engine.players[1];
    p1.hand = [new Carta(3, 'Basto', false, 'p1_3basto')];

    const corteInfo = engine.iniciarCorte(0, 7);
    assert.ok(corteInfo);

    // Jugador 1 acomoda el 3 de Basto
    const ok = engine.colocarCarta(1, 'p1_3basto');
    assert.strictEqual(ok, true);

    // La escalera en p0.melds y corteInfo.melds debe ser [3, 4, 5, 6], NO [4, 5, 6, 3]
    const meldValores = p0.melds[0].map(c => c.valor);
    assert.deepStrictEqual(meldValores, [3, 4, 5, 6], 'La escalera colocada debe estar ordenada ascendentemente (3, 4, 5, 6)');
});

test('robarPozo nunca duplica la carta entre el pozo y la mano del jugador y no permite descarte inmediato', () => {
    const engine = new CongaEngine();
    engine.configurarPartida(2);
    // Vaciar pozo y colocar una carta conocida
    const cartaPozo = new Carta(7, 'Oro', false, 'test_oro_7');
    engine.discardPile = [cartaPozo];
    engine.fase = 'robar';
    engine.turnoSeat = 0;

    const initialHandLength = engine.players[0].hand.length;
    const robada = engine.robarPozo(0);

    assert.strictEqual(robada.id, 'test_oro_7');
    assert.strictEqual(engine.players[0].hand.length, initialHandLength + 1);
    assert.ok(engine.players[0].hand.some(c => c.id === 'test_oro_7'), 'La carta debe estar en la mano');
    assert.strictEqual(engine.discardPile.length, 0, 'El pozo debe quedar vacío');
    assert.ok(!engine.discardPile.some(c => c.id === 'test_oro_7'), 'La carta no debe existir en el pozo');
    assert.strictEqual(engine.fase, 'descartar');

    // Regla de Conga: no puede tirar la misma carta recién robada del pozo
    const idxRecienRobada = engine.players[0].hand.findIndex(c => c.id === 'test_oro_7');
    const descarteFallido = engine.descartarCarta(0, idxRecienRobada);
    assert.strictEqual(descarteFallido, null, 'No debe permitir descartar la carta recién levantada del pozo');
});

test('Simulación de partida completa verificando la invariante estricta de unicidad de cartas y fin de partida', () => {
    const engine = new CongaEngine({ limitePuntos: 30, deckSize: 48, conComodines: false });
    engine.configurarPartida(2);
    const bot0 = new CongaBot('Facil');
    const bot1 = new CongaBot('Facil');

    const TOTAL_CARDS = 48;
    let turnCount = 0;
    const MAX_TURNS = 200;

    while (!engine.partidoFinalizado && turnCount < MAX_TURNS) {
        turnCount++;
        const currentSeat = engine.turnoSeat;
        const currentBot = currentSeat === 0 ? bot0 : bot1;

        // Invariante de unicidad y conservación de cartas
        const allCardIds = [];
        engine.deck.forEach(c => allCardIds.push(c.id));
        engine.discardPile.forEach(c => allCardIds.push(c.id));
        engine.players.forEach(p => p.hand.forEach(c => allCardIds.push(c.id)));

        const idSet = new Set(allCardIds);
        assert.strictEqual(idSet.size, allCardIds.length, `No debe haber cartas duplicadas en el turno ${turnCount}`);
        assert.strictEqual(allCardIds.length, TOTAL_CARDS, `La suma de cartas debe ser exactamente ${TOTAL_CARDS}`);

        if (engine.fase === 'robar') {
            const decision = currentBot.decidirRobo(engine, currentSeat);
            if (decision === 'pozo' && engine.discardPile.length > 0) {
                engine.robarPozo(currentSeat);
            } else {
                engine.robarMazo(currentSeat);
            }
        } else if (engine.fase === 'descartar') {
            const player = engine.players[currentSeat];
            let cardIndexToDiscard = 0;
            if (engine.origenRobo === 'pozo' && engine.cartaRobada) {
                const safeIdx = player.hand.findIndex(c => c.id !== engine.cartaRobada.id);
                if (safeIdx !== -1) cardIndexToDiscard = safeIdx;
            }

            if (engine.puedeCortar(currentSeat, cardIndexToDiscard)) {
                engine.iniciarCorte(currentSeat, cardIndexToDiscard);
                engine.finalizarCorte();
                engine.verificarEliminaciones();
                if (!engine.partidoFinalizado) {
                    engine.iniciarRonda();
                }
            } else {
                engine.descartarCarta(currentSeat, cardIndexToDiscard);
            }
        }
    }

    assert.ok(turnCount > 0, 'La partida debe haber ejecutado múltiples turnos sin duplicar cartas');
});

console.log('\n========================================');
console.log(`🏁 RESULTADO: ${passedTests}/${totalTests} tests pasados.`);
console.log('========================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
