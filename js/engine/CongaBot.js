// js/engine/CongaBot.js
// Inteligencia Artificial táctica para la Conga Uruguaya

class CongaBot {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty; // 'facil' | 'normal' | 'experto'
    }

    // Decide si alzar del pozo de descarte o del mazo oculto
    decidirRobo(engine, botSeat) {
        const bot = engine.players[botSeat];
        const topDiscard = engine.discardPile[engine.discardPile.length - 1];

        if (!topDiscard) return 'mazo';

        // Evaluar mano actual (7 cartas)
        const estadoActual = engine.detectarMejoresMelds(bot.hand);
        const ptsActuales = estadoActual.puntosSueltos;

        // Evaluar qué pasaría si robara del pozo (mano de 8 cartas)
        const manoConPozo = [...bot.hand, topDiscard];

        let menorPuntosConPozo = Infinity;
        let mejoraMeld = false;

        // Simular descartar cada una de las 8 cartas para ver el mejor resultado
        for (let i = 0; i < manoConPozo.length; i++) {
            // No podemos levantar del pozo y tirar exactamente la misma carta en el mismo turno
            if (manoConPozo[i] === topDiscard) continue;

            const manoSimulada = manoConPozo.filter((_, idx) => idx !== i);
            const analysis = engine.detectarMejoresMelds(manoSimulada);

            if (analysis.puntosSueltos < menorPuntosConPozo) {
                menorPuntosConPozo = analysis.puntosSueltos;
            }
            if (analysis.melds.length > estadoActual.melds.length || analysis.esConga || analysis.esCorteCero) {
                mejoraMeld = true;
            }
        }

        // Si la carta del pozo reduce los puntos sueltos o arma un juego nuevo -> ROBAR POZO
        if (menorPuntosConPozo < ptsActuales || mejoraMeld) {
            return 'pozo';
        }

        // Caso táctico: si la carta del pozo hace pareja con una carta aislada del bot y el descarte es bajo
        if (this.difficulty === 'experto') {
            const hacePareja = bot.hand.some(c => 
                (c.palo === topDiscard.palo && Math.abs(c.valor - topDiscard.valor) === 1) || 
                (c.valor === topDiscard.valor && c.palo !== topDiscard.palo)
            );
            if (hacePareja && topDiscard.getPuntosSueltos() <= 5 && Math.random() < 0.4) {
                return 'pozo';
            }
        }

        return 'mazo';
    }

    // Decide qué carta descartar de las 8 que tiene en la mano y si debe cortar
    decidirJugadaDescarte(engine, botSeat) {
        const bot = engine.players[botSeat];
        if (bot.hand.length !== 8) return null;

        let mejorIndiceDescarte = 0;
        let menorPuntosSueltos = Infinity;
        let mejorAnalysis = null;

        for (let i = 0; i < bot.hand.length; i++) {
            const manoSimulada = bot.hand.filter((_, idx) => idx !== i);
            const analysis = engine.detectarMejoresMelds(manoSimulada);
            const pts = analysis.puntosSueltos;

            // Ponderación: menor puntos sueltos es lo primordial
            // Desempate: tirar la carta que individualmente suma más puntos (Rey, Caballo, etc.)
            const cartaDescartada = bot.hand[i];
            const valorDescarte = cartaDescartada.getPuntosSueltos();

            let score = pts * 100 - valorDescarte;

            if (analysis.esCongaLimpia) score = -100000;
            else if (analysis.esCongaConComodin) score = -50000;
            else if (analysis.esCorteCero) score = -10000;

            if (score < menorPuntosSueltos) {
                menorPuntosSueltos = score;
                mejorIndiceDescarte = i;
                mejorAnalysis = analysis;
            }
        }

        // Evaluar si corresponde CORTAR
        let debeCortar = false;
        if (mejorAnalysis) {
            const ptsFinales = mejorAnalysis.puntosSueltos;
            const limCorte = engine.config.limiteCorte || 5;

            if (ptsFinales <= limCorte || mejorAnalysis.esConga) {
                if (mejorAnalysis.esConga || mejorAnalysis.esCorteCero) {
                    debeCortar = true; // Corte en 0 o Conga se corta de inmediato
                } else if (ptsFinales <= 3) {
                    debeCortar = true; // <= 3 puntos es muy seguro cortar
                } else if (ptsFinales <= limCorte) {
                    // Entre 4 y 5 puntos: cortar a menos que en modo experto busque ligar todas
                    debeCortar = (this.difficulty !== 'experto' || Math.random() < 0.75);
                }
            }
        }

        return {
            cardIndex: mejorIndiceDescarte,
            carta: bot.hand[mejorIndiceDescarte],
            analysis: mejorAnalysis,
            cortar: debeCortar
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CongaBot };
} else {
    window.CongaBot = CongaBot;
}
