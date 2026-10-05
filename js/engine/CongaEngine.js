// js/engine/CongaEngine.js
// Motor central de reglas de Conga Uruguaya / Chinchón

class Carta {
    constructor(valor, palo, esComodin = false, id = null) {
        this.valor = valor; // 1..12 (0 para comodín)
        this.palo = palo;   // 'Espada', 'Basto', 'Copa', 'Oro', 'Comodín'
        this.esComodin = esComodin;
        this.id = id || (esComodin ? `Comodin_${valor || 1}_${Math.random().toString(36).substring(2, 6)}` : `${palo}_${valor}`);
    }

    getPuntosSueltos() {
        if (this.esComodin) return 25;
        if (this.valor === 1) return 1;
        if (this.valor >= 2 && this.valor <= 9) return this.valor;
        if (this.valor >= 10) return 10; // Sota (10), Caballo (11), Rey (12)
        return this.valor;
    }

    getNombreCriollo() {
        if (this.esComodin) return "Comodín";
        const NOMBRES = {
            1: "As", 2: "Dos", 3: "Tres", 4: "Cuatro", 5: "Cinco", 6: "Seis",
            7: "Siete", 8: "Ocho", 9: "Nueve", 10: "Sota", 11: "Caballo", 12: "Rey"
        };
        return `${NOMBRES[this.valor] || this.valor} de ${this.palo}`;
    }

    getAssetUrl() {
        if (this.esComodin) return 'assets/cards_tatu/Comodin.png';
        const NOMBRES_VALORES = {
            1: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis',
            7: 'Siete', 8: 'Ocho', 9: 'Nueve', 10: 'Sota', 11: 'Caballo', 12: 'Rey'
        };
        const NOMBRES_PALOS = {
            'Espada': 'Espadas', 'Basto': 'Bastos', 'Copa': 'Copas', 'Oro': 'Oros'
        };
        const valName = NOMBRES_VALORES[this.valor];
        const paloName = NOMBRES_PALOS[this.palo];
        if (!valName || !paloName) return 'assets/cards_tatu/carta_reverso.png';
        return `assets/cards_tatu/${valName}_de_${paloName}.png`;
    }
}

class Jugador {
    constructor(seat, name, isBot = false) {
        this.seat = seat;
        this.name = name;
        this.isBot = isBot;
        this.hand = [];
        this.puntosAcumulados = 0;
        this.eliminado = false;
        this.reenganches = 0;
        this.melds = []; // Combinaciones formadas
        this.unmelded = []; // Cartas sueltas
        this.puntosSueltos = 0;
    }
}

class CongaEngine {
    constructor(config = {}) {
        this.config = {
            limitePuntos: config.limitePuntos || 100, // 50, 100 o 150
            deckSize: config.deckSize || 48,          // 40 o 48 cartas
            conComodines: config.conComodines !== false, // true por defecto (2 comodines)
            limiteCorte: config.limiteCorte || 5,    // 5 o 3 puntos máximos para cortar
            permitirReenganche: config.permitirReenganche !== false,
            nombreJugador: config.nombreJugador || "TÚ",
            ...config
        };

        this.numJugadores = 2;
        this.players = [];
        this.deck = [];
        this.discardPile = []; // Pozo de descarte
        this.turnoSeat = 0;
        this.manoSeat = 0; // Quien es el mano que sale primero
        this.fase = 'robar'; // 'robar' | 'descartar' | 'fin_ronda' | 'partido_finalizado'
        this.cartaRobada = null; // Última carta robada en el turno
        this.origenRobo = null;  // 'mazo' | 'pozo'
        this.rondaActual = 0;
        this.partidoIniciado = false;
        this.partidoFinalizado = false;
        this.ganadorPartido = null;
        this.ultimoCortador = null;
        this.resultadoRonda = null;
        this.historialRondas = [];
    }

    configurarPartida(numJugadores = 2, configOverrides = {}) {
        this.numJugadores = Math.max(2, Math.min(4, numJugadores));
        this.config = { ...this.config, ...configOverrides };
        this.players = [];
        
        for (let i = 0; i < this.numJugadores; i++) {
            const isBot = (i !== 0);
            const defaultName = (i === 0) ? this.config.nombreJugador : `Bot ${i === 1 ? 'Tatú' : (i === 2 ? 'Gaucho' : 'Pampero')}`;
            this.players.push(new Jugador(i, defaultName, isBot));
        }

        this.partidoIniciado = true;
        this.partidoFinalizado = false;
        this.ganadorPartido = null;
        this.rondaActual = 0;
        this.manoSeat = 0;
        this.historialRondas = [];
        
        this.iniciarRonda();
    }

    crearMazo() {
        const palos = ['Espada', 'Basto', 'Copa', 'Oro'];
        const mazo = [];
        const valores = (this.config.deckSize === 40) ? [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        for (const palo of palos) {
            for (const val of valores) {
                mazo.push(new Carta(val, palo, false));
            }
        }

        if (this.config.conComodines) {
            mazo.push(new Carta(0, 'Comodín', true, 'Comodin_1'));
            mazo.push(new Carta(0, 'Comodín', true, 'Comodin_2'));
        }

        return mazo;
    }

    mezclarMazo(mazo) {
        for (let i = mazo.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
        }
        return mazo;
    }

    iniciarRonda() {
        this.rondaActual++;
        this.deck = this.mezclarMazo(this.crearMazo());
        this.discardPile = [];
        this.fase = 'robar';
        this.cartaRobada = null;
        this.origenRobo = null;
        this.ultimoCortador = null;
        this.resultadoRonda = null;

        // Limpiar manos de los jugadores activos
        this.players.forEach(p => {
            p.hand = [];
            p.melds = [];
            p.unmelded = [];
            p.puntosSueltos = 0;
        });

        // Repartir 7 cartas a cada jugador no eliminado
        for (let r = 0; r < 7; r++) {
            for (let s = 0; s < this.numJugadores; s++) {
                const p = this.players[s];
                if (!p.eliminado && this.deck.length > 0) {
                    p.hand.push(this.deck.pop());
                }
            }
        }

        // Poner la primera carta boca arriba en el pozo de descarte
        if (this.deck.length > 0) {
            this.discardPile.push(this.deck.pop());
        }

        // Turno inicial: empieza el mano de la ronda
        this.turnoSeat = this.manoSeat;
        while (this.players[this.turnoSeat].eliminado) {
            this.turnoSeat = (this.turnoSeat + 1) % this.numJugadores;
        }

        // Actualizar melds de cada jugador
        this.actualizarMeldsTodos();
    }

    actualizarMeldsTodos() {
        this.players.forEach(p => {
            if (!p.eliminado) {
                const analysis = this.detectarMejoresMelds(p.hand);
                p.melds = analysis.melds;
                p.unmelded = analysis.unmelded;
                p.puntosSueltos = analysis.puntosSueltos;
            }
        });
    }

    // Recargar mazo cuando se agota usando el pozo de descarte (dejando la última visible)
    reciclarMazoSiEsNecesario() {
        if (this.deck.length === 0) {
            if (this.discardPile.length <= 1) return false; // No hay cartas suficientes
            const topDiscard = this.discardPile.pop();
            this.deck = this.mezclarMazo(this.discardPile);
            this.discardPile = [topDiscard];
            return true;
        }
        return true;
    }

    robarMazo(seat) {
        if (this.fase !== 'robar' || this.turnoSeat !== seat) return null;
        this.reciclarMazoSiEsNecesario();
        if (this.deck.length === 0) return null;

        const carta = this.deck.pop();
        this.players[seat].hand.push(carta);
        this.cartaRobada = carta;
        this.origenRobo = 'mazo';
        this.fase = 'descartar';
        this.actualizarMeldsTodos();
        return carta;
    }

    robarPozo(seat) {
        if (this.fase !== 'robar' || this.turnoSeat !== seat) return null;
        if (this.discardPile.length === 0) return null;

        const carta = this.discardPile.pop();
        this.players[seat].hand.push(carta);
        this.cartaRobada = carta;
        this.origenRobo = 'pozo';
        this.fase = 'descartar';
        this.actualizarMeldsTodos();
        return carta;
    }

    descartarCarta(seat, cardIndex) {
        if (this.fase !== 'descartar' || this.turnoSeat !== seat) return null;
        const player = this.players[seat];
        if (cardIndex < 0 || cardIndex >= player.hand.length) return null;

        const [carta] = player.hand.splice(cardIndex, 1);
        this.discardPile.push(carta);
        this.cartaRobada = null;
        this.origenRobo = null;

        this.actualizarMeldsTodos();

        // Pasar turno al siguiente jugador activo
        this.avanzarTurno();
        return carta;
    }

    avanzarTurno() {
        this.fase = 'robar';
        let nextSeat = (this.turnoSeat + 1) % this.numJugadores;
        while (this.players[nextSeat].eliminado) {
            nextSeat = (nextSeat + 1) % this.numJugadores;
        }
        this.turnoSeat = nextSeat;
    }

    // -------------------------------------------------------------
    // ALGORITMO DETECCIÓN DE COMBINACIONES (MELDS)
    // -------------------------------------------------------------

    esEscaleraValida(cartas) {
        if (cartas.length < 3) return false;
        
        let comodinesCount = cartas.filter(c => c.esComodin).length;
        const naturales = cartas.filter(c => !c.esComodin);
        
        if (naturales.length === 0) return false; // Solo comodines no es escalera

        // Todas las cartas naturales deben ser del mismo palo
        const primerPalo = naturales[0].palo;
        if (!naturales.every(c => c.palo === primerPalo)) return false;

        // Ordenar cartas naturales por valor ascendente
        const vals = naturales.map(c => c.valor).sort((a, b) => a - b);

        // En la baraja española de 40 cartas: [1,2,3,4,5,6,7, 10,11,12]
        // Si hay salto de 7 a 10 en baraja de 40 cartas, son consecutivas.
        const es40 = (this.config.deckSize === 40);

        const getConsecutivoDist = (v1, v2) => {
            if (v1 === v2) return -1; // Duplicado no permitido en escalera
            if (es40 && v1 === 7 && v2 === 10) return 1; // Salto válido en 40 cartas
            return v2 - v1;
        };

        // Verificar que los huecos puedan ser cubiertos por comodines
        let comodinesDisponibles = comodinesCount;
        for (let i = 0; i < vals.length - 1; i++) {
            const dist = getConsecutivoDist(vals[i], vals[i + 1]);
            if (dist < 1) return false; // Repetido
            const huecos = dist - 1;
            if (huecos > comodinesDisponibles) return false;
            comodinesDisponibles -= huecos;
        }

        // Si sobran comodines, pueden ir al principio o al final si no se exceden los límites (1 a 12)
        return true;
    }

    esPiernaValida(cartas) {
        if (cartas.length < 3 || cartas.length > 4) return false;

        const naturales = cartas.filter(c => !c.esComodin);
        const comodinesCount = cartas.filter(c => c.esComodin).length;

        if (naturales.length === 0) return false;
        if (comodinesCount > 1) return false; // Máximo 1 comodín por pierna tradicional

        // Todas las naturales deben tener el mismo número
        const primerValor = naturales[0].valor;
        if (!naturales.every(c => c.valor === primerValor)) return false;

        // Todas las naturales deben ser de palos diferentes
        const palosSet = new Set(naturales.map(c => c.palo));
        if (palosSet.size !== naturales.length) return false;

        return true;
    }

    // Encuentra la mejor partición de la mano en combinaciones válidas que minimice los puntos sueltos
    detectarMejoresMelds(cards) {
        if (!cards || cards.length === 0) {
            return { melds: [], unmelded: [], puntosSueltos: 0, esConga: false, esCongaLimpia: false, esCorteCero: false };
        }

        // Caso especial: ¡CONGA / CHINCHÓN! (7 cartas consecutivas del mismo palo)
        if (cards.length === 7 && this.esEscaleraValida(cards)) {
            const tieneComodin = cards.some(c => c.esComodin);
            return {
                melds: [cards],
                unmelded: [],
                puntosSueltos: 0,
                esConga: true,
                esCongaLimpia: !tieneComodin,
                esCongaConComodin: tieneComodin,
                esCorteCero: true
            };
        }

        // Encontrar todos los subconjuntos válidos posibles de longitud 3 a 7
        const todosMeldsValidos = [];
        const n = cards.length;

        // Generar subconjuntos de 3, 4, 5, 6, 7
        const combinacionesIndices = (arr, k) => {
            if (k === 0) return [[]];
            if (arr.length === 0) return [];
            const head = arr[0];
            const tail = arr.slice(1);
            const conHead = combinacionesIndices(tail, k - 1).map(c => [head, ...c]);
            const sinHead = combinacionesIndices(tail, k);
            return [...conHead, ...sinHead];
        };

        const indices = Array.from({ length: n }, (_, i) => i);

        for (let len = 3; len <= Math.min(n, 7); len++) {
            const combos = combinacionesIndices(indices, len);
            for (const combo of combos) {
                const subconjunto = combo.map(i => cards[i]);
                if (this.esEscaleraValida(subconjunto) || this.esPiernaValida(subconjunto)) {
                    todosMeldsValidos.push({
                        indices: new Set(combo),
                        cartas: subconjunto
                    });
                }
            }
        }

        // Buscar combinaciones de melds disjuntos (sin solapamiento de cartas)
        // Posibilidades: 0 melds, 1 meld, 2 melds (ej 3+3, 3+4, 4+3, etc.)
        let mejorSolucion = {
            melds: [],
            unmelded: [...cards],
            puntosSueltos: cards.reduce((sum, c) => sum + c.getPuntosSueltos(), 0),
            esConga: false,
            esCongaLimpia: false,
            esCongaConComodin: false,
            esCorteCero: false
        };

        const evaluarParticion = (meldsArr) => {
            const usados = new Set();
            for (const m of meldsArr) {
                for (const idx of m.indices) {
                    usados.add(idx);
                }
            }
            const unmelded = cards.filter((_, idx) => !usados.has(idx));
            const puntosSueltos = unmelded.reduce((sum, c) => sum + c.getPuntosSueltos(), 0);
            const meldsCartas = meldsArr.map(m => m.cartas);

            const esCorteCero = (unmelded.length === 0);

            if (puntosSueltos < mejorSolucion.puntosSueltos || 
               (puntosSueltos === mejorSolucion.puntosSueltos && unmelded.length < mejorSolucion.unmelded.length)) {
                mejorSolucion = {
                    melds: meldsCartas,
                    unmelded,
                    puntosSueltos,
                    esConga: false,
                    esCongaLimpia: false,
                    esCongaConComodin: false,
                    esCorteCero
                };
            }
        };

        // Evaluar 1 solo meld
        for (let i = 0; i < todosMeldsValidos.length; i++) {
            evaluarParticion([todosMeldsValidos[i]]);

            // Evaluar 2 melds disjuntos
            for (let j = i + 1; j < todosMeldsValidos.length; j++) {
                const m1 = todosMeldsValidos[i];
                const m2 = todosMeldsValidos[j];
                let solapados = false;
                for (const idx of m1.indices) {
                    if (m2.indices.has(idx)) {
                        solapados = true;
                        break;
                    }
                }
                if (!solapados) {
                    evaluarParticion([m1, m2]);
                }
            }
        }

        return mejorSolucion;
    }

    // -------------------------------------------------------------
    // ACCIÓN DE CORTAR / CERRAR
    // -------------------------------------------------------------

    puedeCortar(seat, descartandoIndex = null) {
        if (this.fase !== 'descartar' || this.turnoSeat !== seat) return false;
        const player = this.players[seat];

        // Para cortar, el jugador debe descartar 1 carta de sus 8, quedando con 7 cartas
        if (descartandoIndex !== null) {
            const manoSimulada = player.hand.filter((_, i) => i !== descartandoIndex);
            const analysis = this.detectarMejoresMelds(manoSimulada);
            return (analysis.puntosSueltos <= this.config.limiteCorte || analysis.esConga);
        } else {
            // Evaluar si alguna de las 8 cartas al descartarse permite cortar
            for (let i = 0; i < player.hand.length; i++) {
                if (this.puedeCortar(seat, i)) return true;
            }
        }
        return false;
    }

    cortar(seat, cardIndexDescarte) {
        if (!this.puedeCortar(seat, cardIndexDescarte)) return false;

        const player = this.players[seat];
        const [cartaDescarte] = player.hand.splice(cardIndexDescarte, 1);
        this.discardPile.push(cartaDescarte);

        this.ultimoCortador = seat;
        this.fase = 'fin_ronda';

        // Procesar melds finales de todos
        this.actualizarMeldsTodos();

        // Aplicar fase de acomodo (layoffs) si el cortador NO cortó en 0 (-10 o Conga)
        const cortadorAnalysis = this.detectarMejoresMelds(player.hand);
        
        if (!cortadorAnalysis.esCorteCero && !cortadorAnalysis.esConga) {
            this.aplicarAcomodoCartas(seat);
        }

        // Calcular puntajes de la ronda
        this.calcularPuntajesRonda(cortadorAnalysis);

        return true;
    }

    // Layoffs: otros jugadores pueden ligar cartas sueltas en las combinaciones del cortador
    aplicarAcomodoCartas(cortadorSeat) {
        const cortador = this.players[cortadorSeat];
        const meldsCortador = cortador.melds;

        this.players.forEach(p => {
            if (p.seat !== cortadorSeat && !p.eliminado) {
                const unmeldedRestantes = [];
                for (const c of p.unmelded) {
                    let acomodada = false;
                    for (const meld of meldsCortador) {
                        // Intentar agregar la carta al meld existente
                        const candidata = [...meld, c];
                        if (this.esEscaleraValida(candidata) || this.esPiernaValida(candidata)) {
                            meld.push(c);
                            acomodada = true;
                            break;
                        }
                    }
                    if (!acomodada) {
                        unmeldedRestantes.push(c);
                    }
                }
                p.unmelded = unmeldedRestantes;
                p.puntosSueltos = unmeldedRestantes.reduce((sum, x) => sum + x.getPuntosSueltos(), 0);
            }
        });
    }

    calcularPuntajesRonda(cortadorAnalysis) {
        const cortador = this.players[this.ultimoCortador];
        const ptsCortador = cortador.puntosSueltos;
        const detalles = [];

        let victoriaDirecta = false;
        let pasaronAlCortador = false;
        let quienPasoAlCortador = null;

        // Caso 1: ¡CONGA LIMPIA (CHINCHÓN)! -> Gana la partida inmediatamente
        if (cortadorAnalysis.esCongaLimpia) {
            victoriaDirecta = true;
            this.partidoFinalizado = true;
            this.ganadorPartido = cortador.seat;
            detalles.push({
                seat: cortador.seat,
                name: cortador.name,
                puntosRonda: 0,
                motivo: "¡CONGA LIMPIA! Victoria directa del partido 🏆"
            });
        } 
        // Caso 2: Conga con Comodín -> -25 Puntos de premio
        else if (cortadorAnalysis.esCongaConComodin) {
            cortador.puntosAcumulados = Math.max(0, cortador.puntosAcumulados - 25);
            detalles.push({
                seat: cortador.seat,
                name: cortador.name,
                puntosRonda: -25,
                motivo: "¡Conga con Comodín! (-25 Pts de premio)"
            });
        }
        // Caso 3: Corte en 0 (Todas ligadas) -> -10 Puntos de premio
        else if (cortadorAnalysis.esCorteCero) {
            cortador.puntosAcumulados = Math.max(0, cortador.puntosAcumulados - 10);
            detalles.push({
                seat: cortador.seat,
                name: cortador.name,
                puntosRonda: -10,
                motivo: "¡Corte Limpio (0 puntos)! (-10 Pts de premio)"
            });
        }
        // Caso 4: Corte con cartas sueltas (1 a 5 pts)
        else {
            // Verificar si algún rival empató o tuvo menos puntos que el cortador ("lo pasaron")
            const rivales = this.players.filter(p => p.seat !== this.ultimoCortador && !p.eliminado);
            for (const r of rivales) {
                if (r.puntosSueltos <= ptsCortador) {
                    pasaronAlCortador = true;
                    quienPasoAlCortador = r.seat;
                    break;
                }
            }

            if (pasaronAlCortador) {
                // Penalización al cortador: sus puntos + 10 pts de recargo por corte fallido
                const castigo = ptsCortador + 10;
                cortador.puntosAcumulados += castigo;
                detalles.push({
                    seat: cortador.seat,
                    name: cortador.name,
                    puntosRonda: castigo,
                    motivo: `Corte fallido (+${ptsCortador} + 10 de castigo = +${castigo} Pts) 💀`
                });
            } else {
                cortador.puntosAcumulados += ptsCortador;
                detalles.push({
                    seat: cortador.seat,
                    name: cortador.name,
                    puntosRonda: ptsCortador,
                    motivo: `Corte exitoso (+${ptsCortador} Pts)`
                });
            }
        }

        // Puntos de los demás jugadores
        this.players.forEach(p => {
            if (p.seat !== this.ultimoCortador && !p.eliminado) {
                let ptsSumar = p.puntosSueltos;
                let motivo = `+${ptsSumar} Puntos sueltos`;

                // Si pasaron al cortador, el rival que lo pasó se anota 0 puntos
                if (pasaronAlCortador && p.seat === quienPasoAlCortador) {
                    ptsSumar = 0;
                    motivo = "¡Le ganaste al cortador! (0 Pts)";
                }

                p.puntosAcumulados += ptsSumar;
                detalles.push({
                    seat: p.seat,
                    name: p.name,
                    puntosRonda: ptsSumar,
                    motivo
                });
            }
        });

        // Verificar eliminaciones por superar el límite de puntos
        this.verificarEliminaciones();

        this.resultadoRonda = {
            ronda: this.rondaActual,
            cortadorSeat: this.ultimoCortador,
            esCongaLimpia: cortadorAnalysis.esCongaLimpia,
            esCongaConComodin: cortadorAnalysis.esCongaConComodin,
            esCorteCero: cortadorAnalysis.esCorteCero,
            pasaronAlCortador,
            detalles,
            victoriaDirecta
        };

        this.historialRondas.push(this.resultadoRonda);

        // Si el partido no terminó, rotar el mano para la siguiente ronda
        if (!this.partidoFinalizado) {
            this.manoSeat = (this.manoSeat + 1) % this.numJugadores;
            while (this.players[this.manoSeat].eliminado) {
                this.manoSeat = (this.manoSeat + 1) % this.numJugadores;
            }
        }
    }

    verificarEliminaciones() {
        if (this.partidoFinalizado) return;

        const activos = this.players.filter(p => !p.eliminado);
        
        activos.forEach(p => {
            if (p.puntosAcumulados > this.config.limitePuntos) {
                p.eliminado = true;
            }
        });

        const sobrevivientes = this.players.filter(p => !p.eliminado);

        if (sobrevivientes.length === 1) {
            this.partidoFinalizado = true;
            this.ganadorPartido = sobrevivientes[0].seat;
        } else if (sobrevivientes.length === 0) {
            // En caso raro de que todos superen en la misma ronda, gana el que tiene menor puntaje
            let menorPuntos = Infinity;
            let ganador = null;
            this.players.forEach(p => {
                if (p.puntosAcumulados < menorPuntos) {
                    menorPuntos = p.puntosAcumulados;
                    ganador = p.seat;
                }
            });
            this.partidoFinalizado = true;
            this.ganadorPartido = ganador;
        }
    }

    // Reenganche: permite volver a entrar al juego con el puntaje del jugador que va peor
    puedeReenganchar(seat) {
        if (!this.config.permitirReenganche || this.partidoFinalizado) return false;
        const p = this.players[seat];
        if (!p || !p.eliminado || p.reenganches >= 1) return false;

        const activos = this.players.filter(x => !x.eliminado);
        return activos.length >= 1;
    }

    reenganchar(seat) {
        if (!this.puedeReenganchar(seat)) return false;
        const p = this.players[seat];

        // Obtener el puntaje más alto entre los que no están eliminados
        const activos = this.players.filter(x => !x.eliminado);
        const maxPuntos = Math.max(...activos.map(x => x.puntosAcumulados));

        p.puntosAcumulados = maxPuntos;
        p.eliminado = false;
        p.reenganches += 1;

        // Si solo quedaba 1 jugador y se canceló la finalización
        this.partidoFinalizado = false;
        this.ganadorPartido = null;

        return true;
    }

    // Auto-organiza la mano de un jugador agrupando sus melds primero y cartas sueltas al final
    autoOrganizarMano(cards) {
        const analysis = this.detectarMejoresMelds(cards);
        const organizadas = [];
        
        // Agregar cartas de los melds en orden
        analysis.melds.forEach(m => {
            // Ordenar meld por valor ascendente
            const sortedMeld = [...m].sort((a, b) => (a.esComodin ? -1 : a.valor) - (b.esComodin ? -1 : b.valor));
            organizadas.push(...sortedMeld);
        });

        // Agregar cartas sueltas ordenadas por valor
        const sortedUnmelded = [...analysis.unmelded].sort((a, b) => a.getPuntosSueltos() - b.getPuntosSueltos());
        organizadas.push(...sortedUnmelded);

        return organizadas;
    }
}

// Exportar para Node.js (Tests) y Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Carta, Jugador, CongaEngine };
} else {
    window.Carta = Carta;
    window.Jugador = Jugador;
    window.CongaEngine = CongaEngine;
}
