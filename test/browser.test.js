// test/browser.test.js
// Tests End-to-End en navegador real con Playwright para Conga Uruguaya

const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
    console.log('\n======================================================');
    console.log('🌐 INICIANDO TESTS E2E EN NAVEGADOR (CONGA URUGUAYA)');
    console.log('======================================================\n');

    const filePath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
    let browser;
    let total = 0;
    let passed = 0;

    async function runTest(name, fn) {
        total++;
        try {
            await fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ ${name}`);
            console.error(err);
        }
    }

    try {
        browser = await chromium.launch({ headless: true });

        // TEST 1: Carga y presencia de pantalla de inicio
        await runTest('Pantalla de inicio carga correctamente con opciones de juego', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            const startScreenVisible = await page.isVisible('#start-screen');
            assert.strictEqual(startScreenVisible, true);

            const btn1v1 = await page.$('#btn-start-1v1');
            const btn4p = await page.$('#btn-start-4p');
            assert(btn1v1 && btn4p, 'Los botones de modo de juego deben existir');

            await page.close();
        });

        // TEST 2: Iniciar partida 1 vs 1
        // TEST 2: Iniciar partida 1 vs 1
        await runTest('Clic en "1 vs 1" inicia la partida, el mano recibe 8 cartas y el pozo inicia vacío', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            const startScreenVisible = await page.isVisible('#start-screen');
            assert.strictEqual(startScreenVisible, false, 'La pantalla de inicio debe ocultarse');

            // El jugador es mano, por lo que recibe 8 cartas para salir descartando
            const cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 8, 'El mano debe tener 8 cartas');

            // Verificar que el pozo de descarte inicia vacío (sin imagen de carta)
            const discardBg = await page.evaluate(() => {
                return document.getElementById('discard-pile-element').style.backgroundImage;
            });
            assert(discardBg === 'none' || !discardBg, 'El pozo de descarte debe iniciar vacío');

            await page.close();
        });

        // TEST 3: Modo 4 Jugadores
        await runTest('Clic en "4 Jugadores" muestra los 3 rivales en el área superior', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-4p');
            await page.waitForTimeout(600);

            const oppBadges = await page.$$('#opponents-area .opponent-badge');
            assert.strictEqual(oppBadges.length, 3, 'Deben mostrarse 3 rivales en modo 4P');

            await page.close();
        });

        // TEST 4: Modales de Navegación (Reglamento, Guía, Marcador, Config)
        await runTest('Apertura y navegación de modales de Reglamento, Guía y Configuración', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(500);

            // Abrir Reglamento
            await page.click('#btn-reglamento');
            await page.waitForTimeout(200);
            assert.strictEqual(await page.isVisible('#modal-reglamento'), true);

            // Cerrar Reglamento
            await page.click('#modal-reglamento .modal-close-btn');
            await page.waitForTimeout(200);
            assert.strictEqual(await page.isVisible('#modal-reglamento'), false);

            // Abrir Guía de Combinaciones
            await page.click('#btn-guia');
            await page.waitForTimeout(200);
            assert.strictEqual(await page.isVisible('#modal-guia'), true);
            await page.click('#modal-guia .modal-close-btn');

            // Abrir Configuración
            await page.click('#btn-config');
            await page.waitForTimeout(200);
            assert.strictEqual(await page.isVisible('#modal-config'), true);
            await page.click('#modal-config .modal-close-btn');

            await page.close();
        });

        // TEST 5: Mecánica de juego: Mano de 8 cartas habilita descarte al seleccionar e inaugura el pozo
        await runTest('Mano de 8 cartas habilita descarte al seleccionar e inaugura el pozo', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            // Al ser mano, ya tiene 8 cartas
            const cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 8, 'El mano tiene 8 cartas para salir');

            // Seleccionar la primera carta
            await cards[0].click();
            await page.waitForTimeout(200);

            const isDescartarEnabled = await page.evaluate(() => {
                return !document.getElementById('btn-descartar').disabled;
            });
            assert.strictEqual(isDescartarEnabled, true, 'El botón descartar debe habilitarse al seleccionar una carta');

            // Descartar para inaugurar el pozo
            await page.click('#btn-descartar');
            await page.waitForTimeout(400);

            // La mano del mano se reduce a 7 y el pozo tiene la carta
            const cardsAfter = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cardsAfter.length, 7, 'La mano queda con 7 cartas');

            const discardBg = await page.evaluate(() => {
                return document.getElementById('discard-pile-element').style.backgroundImage;
            });
            assert(discardBg && discardBg !== 'none', 'El pozo debe tener la carta inaugurada');

            await page.close();
        });

        // TEST 6: Auto-ordenar mano
        await runTest('Botón Auto-ordenar funciona limpiamente', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            await page.click('#btn-auto-ordenar');
            await page.waitForTimeout(300);

            const cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 8, 'Deben mantenerse las 8 cartas ordenadas');

            await page.close();
        });

        // TEST 7: Mobile vertical layout
        await runTest('Mobile vertical (iPhone/Android) escala cartas y elementos sin desborde', async () => {
            const page = await browser.newPage({
                viewport: { width: 390, height: 844 },
                isMobile: true,
                hasTouch: true
            });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
            const innerWidth = await page.evaluate(() => window.innerWidth);
            assert(scrollWidth <= innerWidth, 'No debe haber desborde horizontal en celular');

            await page.close();
        });

        // TEST 8: Reordenamiento manual de cartas por arrastre (drag-and-drop con pointer/mouse)
        await runTest('Arrastre manual de carta con mouse/touch reordena las cartas en la mano', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            // Obtener el ID inicial de las cartas
            const initialOrder = await page.evaluate(() => {
                return window.engine.players[0].hand.map(c => c.id);
            });

            const cards = await page.$$('#player-hand-fan .hand-card');
            const box0 = await cards[0].boundingBox();
            const box2 = await cards[2].boundingBox();

            assert(box0 && box2, 'Las cartas deben tener dimensiones válidas');

            // Arrastrar con mouse de la posición de la carta 0 a la posición de la carta 2
            await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
            await page.mouse.down();
            await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 12 });
            await page.waitForTimeout(100);
            await page.mouse.up();
            await page.waitForTimeout(300);

            const newOrder = await page.evaluate(() => {
                return window.engine.players[0].hand.map(c => c.id);
            });

            // La carta que estaba en índice 0 ahora debe haberse movido de la primera posición
            assert.notStrictEqual(newOrder[0], initialOrder[0], 'La carta 0 original debe haberse desplazado');
            assert.strictEqual(newOrder.length, initialOrder.length, 'La cantidad de cartas debe mantenerse');

            await page.close();
        });

        // TEST 9: Puntos en esquinas de cartas ocultos por defecto y configurables
        await runTest('Puntos en la esquina de cada carta quedan ocultos por defecto y son configurables', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            // 1. Por defecto, ninguna carta debe tener el badge de puntos en la esquina
            let badges = await page.$$('#player-hand-fan .card-meld-badge');
            assert.strictEqual(badges.length, 0, 'Por defecto los puntos en las cartas deben estar ocultos');

            // 2. Abrir configuración y activar la opción
            await page.click('#btn-config');
            await page.waitForTimeout(200);

            const isChecked = await page.isChecked('#cfg-mostrar-puntos');
            assert.strictEqual(isChecked, false, 'El checkbox debe estar desmarcado por defecto');

            await page.check('#cfg-mostrar-puntos');
            await page.click('#btn-guardar-config');
            await page.waitForTimeout(300);

            // 3. Tras activar la opción y guardar, cada carta debe mostrar su badge
            badges = await page.$$('#player-hand-fan .card-meld-badge');
            const handCount = await page.evaluate(() => window.engine.players[0].hand.length);
            assert.strictEqual(badges.length, handCount, 'Debe mostrar badges de puntos/juego para todas las cartas de la mano tras activarlo en configuración');

            // 4. Volver a desactivar y guardar
            await page.click('#btn-config');
            await page.waitForTimeout(200);
            await page.uncheck('#cfg-mostrar-puntos');
            await page.click('#btn-guardar-config');
            await page.waitForTimeout(300);

            badges = await page.$$('#player-hand-fan .card-meld-badge');
            assert.strictEqual(badges.length, 0, 'Los puntos deben volver a ocultarse');

            await page.close();
        });

        // TEST 10: Cartas bajadas en la mesa al cortar y colocación interactiva de cartas
        await runTest('Al cortar, se muestran las cartas del cortador en la mesa y se habilita la colocación de cartas', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(500);

            // Simular corte del bot con escalera 4-5-6 de Oro y 2 pts sueltos
            await page.evaluate(() => {
                window.engine.players[1].hand = [
                    new window.Carta(4, 'Oro', false, 'b_4oro'),
                    new window.Carta(5, 'Oro', false, 'b_5oro'),
                    new window.Carta(6, 'Oro', false, 'b_6oro'),
                    new window.Carta(2, 'Espada', false, 'b_2espada'),
                    new window.Carta(12, 'Copa', false, 'b_12copa')
                ];
                window.engine.players[0].hand = [
                    new window.Carta(7, 'Oro', false, 'p_7oro'),
                    new window.Carta(11, 'Basto', false, 'p_11basto')
                ];
                window.engine.turnoSeat = 1;
                window.engine.fase = 'descartar';
                window.iniciarFaseAcomodoUI(1, 4);
            });

            await page.waitForTimeout(300);

            // 1. La mesa de cartas bajadas (#table-melds-area) debe ser visible
            const meldsAreaVisible = await page.isVisible('#table-melds-area');
            assert.strictEqual(meldsAreaVisible, true, 'La sección #table-melds-area debe ser visible al cortar');

            // 2. Debe renderizar grupos de juego del cortador
            const meldCards = await page.$$('#table-melds-container .meld-card-mini');
            assert(meldCards.length >= 3, 'Deben mostrarse las cartas del juego del cortador');

            // 3. Las cartas de los rivales deben revelarse boca arriba (.mini-card-front)
            const rivalFrontCards = await page.$$('#opponents-area .mini-card-front');
            assert(rivalFrontCards.length > 0, 'Las cartas del rival deben revelarse boca arriba al cortar');

            // 4. La carta 7 de Oro del jugador humano debe tener clase .card-placeable y badge COLOCAR
            const placeableCards = await page.$$('#player-hand-fan .card-placeable');
            assert.strictEqual(placeableCards.length, 1, 'Debe haber exactamente 1 carta para colocar (7 de Oro)');

            const badgeColocar = await page.$('#player-hand-fan .badge-colocar');
            assert(badgeColocar !== null, 'Debe mostrar el badge "➕ COLOCAR"');

            // 5. Botones de colocación deben estar visibles
            const btnColocarVisible = await page.isVisible('#btn-acomodar-todas');
            const btnConfirmarVisible = await page.isVisible('#btn-confirmar-corte');
            assert.strictEqual(btnColocarVisible, true, 'El botón #btn-acomodar-todas debe ser visible');
            assert.strictEqual(btnConfirmarVisible, true, 'El botón #btn-confirmar-corte debe ser visible');

            // 6. Clic en la carta colocable para agregarla al juego del cortador
            await placeableCards[0].click();
            await page.waitForTimeout(200);

            // 7. La carta acomodada debe figurar con la clase .card-acomodada
            const acomodadas = await page.$$('#table-melds-container .card-acomodada');
            assert(acomodadas.length >= 1, 'La carta colocada debe aparecer destacada en la mesa');

            // 8. Confirmar corte y verificar apertura del modal de fin de ronda
            await page.click('#btn-confirmar-corte');
            await page.waitForTimeout(300);

            const modalFinRondaVisible = await page.isVisible('#modal-fin-ronda');
            assert.strictEqual(modalFinRondaVisible, true, 'El modal de fin de ronda debe mostrarse');

            await page.close();
        });

        // TEST 11: Volumen físico del mazo y eliminación del número de cartas
        await runTest('El mazo no muestra número de cartas y su volumen/bordes reflejan la cantidad a simple vista', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(500);

            // 1. Verificar que el número de cartas del mazo no existe en el DOM
            const deckCounterEl = await page.$('#deck-counter');
            assert.strictEqual(deckCounterEl, null, 'El elemento #deck-counter no debe existir en el mazo');

            // 2. Verificar que con mazo completo (p. ej. 35 cartas) tiene un volumen amplio de sombras
            const shadowFull = await page.evaluate(() => {
                window.actualizarVolumenMazo(35, false);
                return document.getElementById('deck-pile-element').style.boxShadow;
            });
            const parseShadowLayers = (str) => str ? str.split(/,(?![^(]*\))/).map(s => s.trim()) : [];

            assert(shadowFull.includes('px'), 'Debe tener sombras escalonadas');
            assert(parseShadowLayers(shadowFull).length > 10, 'Un mazo con 35 cartas debe tener múltiples capas de volumen (>10 capas)');

            // 3. Verificar que con 4 cartas se ven exactamente los bordes de esas cartas (3 capas debajo de la superior)
            const shadow4 = await page.evaluate(() => {
                window.actualizarVolumenMazo(4, false);
                return document.getElementById('deck-pile-element').style.boxShadow;
            });
            // Cada capa debajo aporta 2 entradas de box-shadow (borde claro + línea oscura) + 1 sombra difusa final
            // 3 capas * 2 + 1 = 7 entradas
            assert.strictEqual(parseShadowLayers(shadow4).length, 7, 'Con 4 cartas deben apreciarse exactamente 3 bordes de cartas debajo');

            // 4. Con 1 carta única: plana en la mesa, solo 1 sombra difusa base (sin bordes debajo)
            const shadow1 = await page.evaluate(() => {
                window.actualizarVolumenMazo(1, false);
                return document.getElementById('deck-pile-element').style.boxShadow;
            });
            assert.strictEqual(parseShadowLayers(shadow1).length, 1, 'Con 1 carta solo debe proyectar sombra base sin bordes debajo');

            // 5. Con 0 cartas: mazo vacío (opaco, sin sombra, borde punteado)
            const emptyStyle = await page.evaluate(() => {
                window.actualizarVolumenMazo(0, false);
                const el = document.getElementById('deck-pile-element');
                return {
                    boxShadow: el.style.boxShadow,
                    border: el.style.border,
                    opacity: el.style.opacity
                };
            });
            assert.strictEqual(emptyStyle.boxShadow, 'none', 'Mazo vacío no proyecta volumen');
            assert(emptyStyle.border.includes('dashed'), 'Mazo vacío se muestra como ranura punteada');

            await page.close();
        });

        // TEST 12: Reenganche en 1 vs 1 muestra botón y reengancha al jugador al partido
        await runTest('Reenganche en 1 vs 1 muestra botón y permite reenganchar al jugador', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(500);

            // Simular eliminación del jugador humano (105 pts) vs Bot Tatú (65 pts)
            const result = await page.evaluate(() => {
                window.engine.players[0].puntosAcumulados = 105;
                window.engine.players[1].puntosAcumulados = 65;
                window.engine.verificarEliminaciones();
                window.engine.fase = 'fin_ronda';
                window.engine.resultadoRonda = {
                    ronda: 1,
                    cortadorSeat: 1,
                    detalles: [
                        { seat: 1, name: 'Bot Tatú', puntosRonda: 5, motivo: 'Corte exitoso (+5 Pts)' },
                        { seat: 0, name: 'TÚ', puntosRonda: 25, motivo: '+25 Puntos sueltos' }
                    ]
                };
                window.renderJuego();

                const btnReenganchar = document.getElementById('btn-reenganchar');
                const modalVisible = document.getElementById('modal-fin-ronda').style.display === 'flex';
                const btnVisible = btnReenganchar.style.display !== 'none';
                const btnText = btnReenganchar.innerText;

                // Hacer clic en reengancharse
                btnReenganchar.click();

                return {
                    modalVisible,
                    btnVisible,
                    btnText,
                    jugadorEliminado: window.engine.players[0].eliminado,
                    jugadorPuntos: window.engine.players[0].puntosAcumulados,
                    partidoFinalizado: window.engine.partidoFinalizado
                };
            });

            assert.strictEqual(result.modalVisible, true, 'El modal de fin de ronda debe estar visible');
            assert.strictEqual(result.btnVisible, true, 'El botón de reengancharse debe estar visible');
            assert(result.btnText.includes('65 pts'), 'Debe ofrecer reenganche con los puntos del rival (65 pts)');
            assert.strictEqual(result.jugadorEliminado, false, 'El jugador ya no debe estar eliminado');
            assert.strictEqual(result.jugadorPuntos, 65, 'El jugador debe tener 65 puntos tras reengancharse');
            assert.strictEqual(result.partidoFinalizado, false, 'El partido debe continuar activo');

            await page.close();
        });

        // TEST 13: Descarte por doble clic (PC) y doble tap (Mobile)
        await runTest('Doble clic con mouse o doble tap en pantalla táctil descarta la carta directamente', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            let cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 8, 'Inicia con 8 cartas');

            // 1. Simular doble clic de mouse en la primera carta
            await cards[0].dblclick();
            await page.waitForTimeout(400);

            // Tras descartar por doble clic, la mano pasa a 7 cartas
            cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 7, 'Tras doble clic se descarta y quedan 7 cartas');

            // 2. Simular doble tap táctil (dos clicks consecutivos dentro de 200ms)
            // Ponemos al jugador en fase descartar con 8 cartas
            await page.evaluate(() => {
                window.engine.turnoSeat = 0;
                window.engine.fase = 'descartar';
                window.engine.players[0].hand.push(new window.Carta(1, 'Espada', false, 'test_double_tap'));
                window.renderJuego();
            });
            await page.waitForTimeout(200);

            cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 8);

            // Dos clicks rápidos sucesivos (doble tap)
            await page.click('#player-hand-fan .hand-card');
            await page.waitForTimeout(100);
            await page.click('#player-hand-fan .hand-card');
            await page.waitForTimeout(400);

            cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 7, 'Tras doble tap se descarta y quedan 7 cartas');

            await page.close();
        });

        // TEST 14: Seleccionar carta habilita botón Cortar cuando se cumplen las condiciones
        await runTest('Seleccionar carta habilita botón Cortar cuando están dadas las condiciones y permite cortar', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(500);

            // Configurar mano que pueda cortar: escalera 4-5-6 Espada (meld) + 1-2-3 Oro (meld) + 2 Copa (2 pts deadwood) + 12 Basto (descarte)
            await page.evaluate(() => {
                window.engine.players[0].hand = [
                    new window.Carta(4, 'Espada', false, 'c_4esp'),
                    new window.Carta(5, 'Espada', false, 'c_5esp'),
                    new window.Carta(6, 'Espada', false, 'c_6esp'),
                    new window.Carta(1, 'Oro', false, 'c_1oro'),
                    new window.Carta(2, 'Oro', false, 'c_2oro'),
                    new window.Carta(3, 'Oro', false, 'c_3oro'),
                    new window.Carta(2, 'Copa', false, 'c_2copa'),
                    new window.Carta(12, 'Basto', false, 'c_12basto')
                ];
                window.engine.turnoSeat = 0;
                window.engine.fase = 'descartar';
                window.renderJuego();
            });
            await page.waitForTimeout(300);

            // Antes de seleccionar carta, el botón cortar está deshabilitado
            let btnCortarDisabled = await page.evaluate(() => document.getElementById('btn-cortar').disabled);
            assert.strictEqual(btnCortarDisabled, true, 'El botón cortar debe estar deshabilitado sin carta seleccionada');

            // Seleccionar la carta índice 7 (12 de Basto) para descartar
            const cards = await page.$$('#player-hand-fan .hand-card');
            await cards[7].click();
            await page.waitForTimeout(300);

            // El botón cortar ahora debe estar habilitado y tener la clase can-cut
            const cutStatus = await page.evaluate(() => {
                const btn = document.getElementById('btn-cortar');
                return {
                    disabled: btn.disabled,
                    hasCanCut: btn.classList.contains('can-cut'),
                    text: btn.innerText
                };
            });

            assert.strictEqual(cutStatus.disabled, false, 'El botón cortar debe habilitarse');
            assert.strictEqual(cutStatus.hasCanCut, true, 'El botón cortar debe tener la clase can-cut');
            assert(cutStatus.text.includes('2 pts'), 'Debe reflejar que corta con 2 pts');

            // Clic en el botón cortar para iniciar corte
            await page.click('#btn-cortar');
            await page.waitForTimeout(400);

            // Debe haber pasado a fase acomodo y mostrar la mesa de corte
            const meldsAreaVisible = await page.isVisible('#table-melds-area');
            assert.strictEqual(meldsAreaVisible, true, 'Al cortar se entra en la fase de acomodo y se muestra la mesa');

            // 1. El centro de mesa (mazo/pozo) se oculta dinámicamente para que no empuje los botones fuera de pantalla
            const centerTableDisplay = await page.evaluate(() => document.getElementById('center-table').style.display);
            assert.strictEqual(centerTableDisplay, 'none', 'El centro de mesa debe ocultarse durante corte para mantener layout compacto');

            // 2. El botón "Ver Resultados" en la mesa debe estar visible y habilitado
            const btnVerMesaVisible = await page.isVisible('#btn-ver-resultados-mesa');
            assert.strictEqual(btnVerMesaVisible, true, 'El botón #btn-ver-resultados-mesa debe ser visible');

            // 3. El banner debe tener clase banner-interactive y responder a clic
            const isBannerInteractive = await page.evaluate(() => document.getElementById('turn-status-banner').classList.contains('banner-interactive'));
            assert.strictEqual(isBannerInteractive, true, 'El banner debe ser interactivo al cortar');

            // 4. Hacer clic en el banner abre el modal de fin de ronda
            await page.click('#turn-status-banner');
            await page.waitForTimeout(400);

            let modalVisible = await page.isVisible('#modal-fin-ronda');
            assert.strictEqual(modalVisible, true, 'Hacer clic en la leyenda del banner debe abrir el modal de resultados');

            // 5. El botón Siguiente Mano en el modal debe estar visible
            const btnSiguienteVisible = await page.isVisible('#btn-cerrar-fin-ronda');
            assert.strictEqual(btnSiguienteVisible, true, 'El botón Siguiente Mano debe estar visible en el modal');

            // 6. Hacer clic en "Siguiente Mano" inicia la nueva ronda y restaura el juego dinámicamente
            await page.click('#btn-cerrar-fin-ronda');
            await page.waitForTimeout(500);

            modalVisible = await page.isVisible('#modal-fin-ronda');
            assert.strictEqual(modalVisible, false, 'El modal debe cerrarse');

            const nextRoundFase = await page.evaluate(() => window.engine.fase);
            assert(nextRoundFase === 'descartar' || nextRoundFase === 'robar', 'Debe haber comenzado la siguiente ronda');

            const centerTableRestored = await page.evaluate(() => document.getElementById('center-table').style.display);
            assert.strictEqual(centerTableRestored, 'flex', 'El centro de mesa debe restaurarse para la nueva ronda');

            await page.close();
        });

        // TEST 15: Botones dicen 'Robar del Mazo' y 'Robar del Pozo', rival no muestra leyenda 'pts / carta', y escalado dinámico por resolución
        await runTest('Botones de robo con texto completo, puntaje limpio de rival y escalado dinámico por resolución', async () => {
            const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            // 1. Verificar texto de los botones de robar
            const txtRobarMazo = await page.innerText('#btn-robar-mazo');
            const txtRobarPozo = await page.innerText('#btn-robar-pozo');
            assert(txtRobarMazo.includes('Robar del Mazo'), `El botón debe decir "Robar del Mazo", recibido: "${txtRobarMazo}"`);
            assert(txtRobarPozo.includes('Robar del Pozo'), `El botón debe decir "Robar del Pozo", recibido: "${txtRobarPozo}"`);

            // 2. Iniciar partida 1v1 en resolución Full HD
            await page.click('#btn-start-1v1');
            await page.waitForTimeout(400);

            // 3. Verificar que el puntaje del bot rival no tenga "cartas" ni "pts / carta"
            const oppScoreText = await page.innerText('.opponent-score');
            assert(!oppScoreText.includes('carta'), `La leyenda no debe contener "carta", recibido: "${oppScoreText}"`);
            assert(!oppScoreText.includes('/'), `La leyenda no debe contener "/", recibido: "${oppScoreText}"`);
            assert(oppScoreText.endsWith('pts'), `La leyenda debe terminar en "pts", recibido: "${oppScoreText}"`);

            // 4. Verificar variables CSS de escalado dinámico en Full HD (1920x1080)
            const desktopCardW = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--card-w').trim());
            const desktopOppCardW = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--opp-card-w').trim());
            assert.strictEqual(desktopCardW, '142px', 'El ancho de cartas en escritorio 1080p debe ser 142px');
            assert.strictEqual(desktopOppCardW, '40px', 'El ancho de cartas de rivales en escritorio debe ser 40px');

            // 5. Cambio de resolución a Laptop (1366x768)
            await page.setViewportSize({ width: 1366, height: 768 });
            await page.waitForTimeout(200);
            const laptopCardW = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--card-w').trim());
            assert.strictEqual(laptopCardW, '128px', 'El ancho de cartas en laptop debe ser 128px');

            // 6. Cambio de resolución a Mobile (390x844)
            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForTimeout(200);
            const mobileCardW = await page.evaluate(() => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')));
            assert(mobileCardW <= 85, `El ancho de cartas en móvil debe ser <= 85px, recibido: ${mobileCardW}px`);

            await page.close();
        });

        // TEST 16: Multijugador Online solicita nombre/apodo al crear o unirse a sala, y en la partida la leyenda muestra 'Rival' o el nombre elegido sin decir 'TÚ'
        await runTest('Online solicita nombre estilo poker y la leyenda en mesa muestra Rival o el apodo elegido sin decir TÚ', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            // 1. Selector de apodo en el lobby
            const lobbyNickInput = await page.$('#input-lobby-nombre');
            assert(lobbyNickInput, 'Debe existir el input de apodo en el lobby');
            await page.fill('#input-lobby-nombre', 'Martín_UY');
            await page.waitForTimeout(100);

            // 2. Al abrir Crear Sala, se pide el apodo prellenado
            await page.click('#btn-crear-online');
            await page.waitForTimeout(300);
            const formCrearVisible = await page.isVisible('#form-crear-sala');
            assert.strictEqual(formCrearVisible, true, 'El formulario para crear sala debe ser visible');
            const crearNomVal = await page.inputValue('#input-crear-nombre');
            assert.strictEqual(crearNomVal, 'Martín_UY', 'El apodo ingresado en el lobby debe sincronizarse en Crear Sala');

            // Cerrar modal
            await page.click('#modal-sala .modal-close-btn');
            await page.waitForTimeout(200);

            // 3. Al abrir Unirse a Sala, se pide el apodo y el código
            await page.click('#btn-unirse-online');
            await page.waitForTimeout(300);
            const formUnirseVisible = await page.isVisible('#form-unirse-sala');
            assert.strictEqual(formUnirseVisible, true, 'El formulario de unirse debe ser visible');
            const unirseNomVal = await page.inputValue('#input-unirse-nombre');
            assert.strictEqual(unirseNomVal, 'Martín_UY', 'El apodo debe sincronizarse en Unirse a Sala');
            const codeInputExists = await page.$('#input-codigo-sala');
            assert(codeInputExists, 'Debe existir el campo de código de sala');

            // Cerrar modal
            await page.click('#modal-sala .modal-close-btn');
            await page.waitForTimeout(200);

            // 4. Simulación de partida online con rival con nombre elegido ("Gonzalo")
            await page.evaluate(() => {
                window.modoJuego = 'multiplayer';
                window.miSeat = 1; // El usuario local es el Invitado
                window.miRol = 'invitado';
                document.getElementById('start-screen').style.display = 'none';

                window.aplicarEstadoJuegoRemoto({
                    rondaActual: 1,
                    turnoSeat: 0, // Turno del Anfitrión (Rival)
                    fase: 'robar',
                    deckCount: 35,
                    discardPile: [{ valor: 1, palo: 'Espada', esComodin: false, id: 'c1' }],
                    players: [
                        { seat: 0, name: 'Gonzalo', hand: [{},{},{},{},{},{},{}], puntosAcumulados: 12 },
                        { seat: 1, name: 'Martín_UY', hand: [{},{},{},{},{},{},{}], puntosAcumulados: 5 }
                    ]
                });
            });
            await page.waitForTimeout(300);

            // La leyenda del banner debe decir "Turno de Gonzalo..." y NO "Turno de TÚ..."
            const turnText = await page.innerText('#turn-text');
            assert(turnText.includes('Gonzalo'), `La leyenda debe mencionar a Gonzalo, recibido: "${turnText}"`);
            assert(!turnText.includes('TÚ'), `La leyenda NO debe decir TÚ cuando juega el rival, recibido: "${turnText}"`);

            // La caja del rival debe decir Gonzalo
            const oppNameText = await page.innerText('.opponent-name');
            assert(oppNameText.includes('Gonzalo'), `El badge del oponente debe decir Gonzalo, recibido: "${oppNameText}"`);

            // 5. Simulación cuando el rival no tiene nombre o tiene 'TÚ': debe decir 'Rival'
            await page.evaluate(() => {
                window.aplicarEstadoJuegoRemoto({
                    rondaActual: 1,
                    turnoSeat: 0,
                    fase: 'robar',
                    deckCount: 35,
                    discardPile: [{ valor: 1, palo: 'Espada', esComodin: false, id: 'c1' }],
                    players: [
                        { seat: 0, name: 'TÚ', hand: [{},{},{},{},{},{},{}], puntosAcumulados: 0 },
                        { seat: 1, name: 'Martín_UY', hand: [{},{},{},{},{},{},{}], puntosAcumulados: 0 }
                    ]
                });
            });
            await page.waitForTimeout(300);

            const turnTextFallback = await page.innerText('#turn-text');
            assert(turnTextFallback.includes('Rival'), `La leyenda debe decir 'Rival' si el rival no tiene nombre, recibido: "${turnTextFallback}"`);
            assert(!turnTextFallback.includes('TÚ'), `La leyenda jamás debe decir 'TÚ' para el rival, recibido: "${turnTextFallback}"`);

            const oppNameFallback = await page.innerText('.opponent-name');
            assert(oppNameFallback.includes('Rival'), `El badge del oponente debe decir 'Rival', recibido: "${oppNameFallback}"`);

            await page.close();
        });

        await runTest('Menú hamburguesa en vista móvil agrupa opciones y se sincroniza con estado de juego', async () => {
            const page = await browser.newPage();
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto(filePath);
            await page.waitForTimeout(300);

            // 1. Iniciar partida para entrar a la mesa
            await page.click('#btn-start-1v1');
            await page.waitForTimeout(300);

            // 2. En móvil, las acciones de escritorio están ocultas y el menú hamburguesa es visible
            const desktopDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('desktop-top-actions')).display);
            assert.strictEqual(desktopDisplay, 'none', 'Los botones de escritorio deben estar ocultos en móvil');

            const hamburgerDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('mobile-menu-container')).display);
            assert.notStrictEqual(hamburgerDisplay, 'none', 'El contenedor del menú hamburguesa debe ser visible en móvil');

            // 3. Abrir menú hamburguesa
            await page.click('#btn-menu-hamburguesa');
            await page.waitForTimeout(200);
            const dropdownDisplay = await page.evaluate(() => document.getElementById('dropdown-menu-hamburguesa').style.display);
            assert.strictEqual(dropdownDisplay, 'flex', 'El dropdown del menú debe abrirse con display: flex');

            // Durante la partida, el botón Salir del dropdown está visible
            const salirPartidaDisplay = await page.evaluate(() => document.getElementById('h-btn-salir').style.display);
            assert.strictEqual(salirPartidaDisplay, 'flex', 'El botón salir debe estar visible durante la partida');

            // 4. Probar opción Reglamento desde el menú móvil
            await page.click('#h-btn-reglamento');
            await page.waitForTimeout(200);
            const modalReglas = await page.evaluate(() => document.getElementById('modal-reglamento').style.display);
            assert.strictEqual(modalReglas, 'flex', 'El modal de reglamento debe abrirse desde el menú hamburguesa');
            await page.click('#modal-reglamento .modal-close-btn');
            await page.waitForTimeout(200);

            // 5. Salir al lobby desde el menú móvil
            await page.click('#btn-menu-hamburguesa');
            await page.waitForTimeout(200);
            await page.click('#h-btn-salir');
            await page.waitForTimeout(300);

            const startScreenDisplay = await page.evaluate(() => document.getElementById('start-screen').style.display);
            assert.strictEqual(startScreenDisplay, 'flex', 'Al pulsar salir desde el menú móvil debe volver a la pantalla de inicio');

            await page.close();
        });

        await runTest('Leyenda de turno en descarte solo incluye "o cortar" si se cumplen las condiciones para cortar', async () => {
            const page = await browser.newPage();
            await page.goto(filePath);
            await page.waitForTimeout(300);
            await page.click('#btn-start-1v1');
            await page.waitForTimeout(300);

            // Mano que NO puede cortar (altos puntos sueltos sin juegos suficientes)
            await page.evaluate(() => {
                const engine = window.engine;
                engine.fase = 'descartar';
                engine.turnoSeat = 0;
                engine.discardPile = [{ valor: 1, palo: 'Basto', esComodin: false, id: 'disc_1' }];
                engine.players[0].hand = [
                    new window.Carta(1, 'Espada', false, 't1'),
                    new window.Carta(4, 'Oro', false, 't2'),
                    new window.Carta(7, 'Copa', false, 't3'),
                    new window.Carta(10, 'Basto', false, 't4'),
                    new window.Carta(11, 'Espada', false, 't5'),
                    new window.Carta(12, 'Oro', false, 't6'),
                    new window.Carta(3, 'Copa', false, 't7'),
                    new window.Carta(8, 'Basto', false, 't8')
                ];
                window.renderJuego();
            });
            await page.waitForTimeout(200);

            let turnText = await page.innerText('#turn-text');
            assert(turnText.includes('descartar'), 'Debe indicar que seleccione una carta para descartar');
            assert(!turnText.includes('cortar'), `NO debe mencionar cortar si el jugador no puede cortar, recibido: "${turnText}"`);

            // Mano que SÍ puede cortar (escalera 4,5,6 y trío 1,1,1 + carta descarte)
            await page.evaluate(() => {
                const engine = window.engine;
                engine.players[0].hand = [
                    new window.Carta(4, 'Espada', false, 'c1'),
                    new window.Carta(5, 'Espada', false, 'c2'),
                    new window.Carta(6, 'Espada', false, 'c3'),
                    new window.Carta(1, 'Oro', false, 'c4'),
                    new window.Carta(1, 'Copa', false, 'c5'),
                    new window.Carta(1, 'Basto', false, 'c6'),
                    new window.Carta(2, 'Oro', false, 'c7'),
                    new window.Carta(12, 'Basto', false, 'c8') // Al descartar esta, queda en 2 pts (<= 5)
                ];
                window.renderJuego();
            });
            await page.waitForTimeout(200);

            turnText = await page.innerText('#turn-text');
            assert(turnText.includes('cortar'), `Debe mencionar cortar cuando puede cortar, recibido: "${turnText}"`);

            await page.close();
        });

        await runTest('Arrastre de carta hacia el pozo activa highlight y descarta la carta de forma fiable', async () => {
            const page = await browser.newPage();
            await page.goto(filePath);
            await page.waitForTimeout(300);
            await page.click('#btn-start-1v1');
            await page.waitForTimeout(300);

            // Preparar turno de descarte del jugador 0 con 8 cartas y pozo con 1 carta
            await page.evaluate(() => {
                const engine = window.engine;
                engine.turnoSeat = 0;
                engine.fase = 'descartar';
                engine.discardPile = [{ valor: 10, palo: 'Copa', esComodin: false, id: 'pozo_inicial' }];
                window.renderJuego();
            });
            await page.waitForTimeout(200);

            const cardHandle = await page.$('.hand-card:first-child');
            assert(cardHandle, 'Debe existir la primera carta en mano');
            const cardBox = await cardHandle.boundingBox();

            const discardHandle = await page.$('#discard-pile-container');
            assert(discardHandle, 'Debe existir el pozo de descarte');
            const discardBox = await discardHandle.boundingBox();

            // 1. Mover mouse a la carta y presionar botón principal
            await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
            await page.mouse.down();

            // 2. Arrastrar hacia arriba a la zona del pozo de descarte
            await page.mouse.move(discardBox.x + discardBox.width / 2, discardBox.y + discardBox.height / 2, { steps: 5 });
            await page.waitForTimeout(100);

            // 3. Verificar que el pozo adquirió la clase visual 'highlight-drop-target'
            const hasHighlight = await page.evaluate(() => {
                return document.getElementById('discard-pile-container').classList.contains('highlight-drop-target');
            });
            assert.strictEqual(hasHighlight, true, 'El pozo debe resaltar con highlight-drop-target durante el arrastre');

            // 4. Soltar el mouse sobre el pozo
            await page.mouse.up();
            await page.waitForTimeout(300);

            // 5. Verificar que el descarte se ejecutó exitosamente: mano pasa de 8 a 7 cartas
            const handCount = await page.evaluate(() => window.engine.players[0].hand.length);
            assert.strictEqual(handCount, 7, 'La mano debe tener 7 cartas tras el descarte por arrastre');

            // La clase highlight debe haberse removido tras el drop
            const highlightCleared = await page.evaluate(() => {
                return !document.getElementById('discard-pile-container').classList.contains('highlight-drop-target');
            });
            assert.strictEqual(highlightCleared, true, 'La clase highlight-drop-target debe limpiarse al soltar');

            await page.close();
        });

        await runTest('Sincronización remota online previene duplicación de carta al robar del pozo', async () => {
            const page = await browser.newPage();
            await page.goto(filePath);
            await page.waitForTimeout(300);

            // Simular recepción de estado remoto donde el jugador 0 robó la única carta del pozo
            // En Firebase, discardPile queda vacío y por tanto undefined en el payload JSON
            await page.evaluate(() => {
                const cartaRobadaPozo = { valor: 5, palo: 'Espada', esComodin: false, id: 'c_espada_5' };
                window.aplicarEstadoJuegoRemoto({
                    rondaActual: 1,
                    turnoSeat: 0,
                    fase: 'descartar',
                    deckCount: 34,
                    // discardPile omitido intencionalmente simulando eliminación de array vacío por Firebase
                    players: [
                        {
                            seat: 0,
                            name: 'Jugador_1',
                            puntosAcumulados: 0,
                            hand: [
                                { valor: 1, palo: 'Oro', id: 'c1' },
                                { valor: 2, palo: 'Oro', id: 'c2' },
                                { valor: 3, palo: 'Oro', id: 'c3' },
                                { valor: 4, palo: 'Oro', id: 'c4' },
                                { valor: 5, palo: 'Oro', id: 'c5' },
                                { valor: 6, palo: 'Oro', id: 'c6' },
                                { valor: 7, palo: 'Oro', id: 'c7' },
                                cartaRobadaPozo // 8va carta recién robada del pozo
                            ]
                        },
                        {
                            seat: 1,
                            name: 'Rival_2',
                            puntosAcumulados: 0,
                            hand: [{},{},{},{},{},{},{}]
                        }
                    ]
                });
            });
            await page.waitForTimeout(200);

            const checkResult = await page.evaluate(() => {
                const eng = window.engine;
                const pozoLen = eng.discardPile.length;
                const hasPozoCardInHand = eng.players[0].hand.some(c => c.id === 'c_espada_5');
                const hasHandCardInPozo = eng.discardPile.some(c => c.id === 'c_espada_5');
                return { pozoLen, hasPozoCardInHand, hasHandCardInPozo };
            });

            assert.strictEqual(checkResult.pozoLen, 0, 'El pozo debe quedar vacío cuando no vienen cartas');
            assert.strictEqual(checkResult.hasPozoCardInHand, true, 'La carta debe estar en la mano del jugador');
            assert.strictEqual(checkResult.hasHandCardInPozo, false, 'La carta NUNCA debe estar duplicada en el pozo');

            await page.close();
        });

        await runTest('El botón flotante de chat solo se habilita cuando se elige partida online y los jugadores ya están en la sala', async () => {
            const page = await browser.newPage();
            await page.goto(filePath);
            await page.waitForTimeout(300);

            // 1. En el lobby / inicio: el botón flotante debe estar oculto
            let floatDisplay = await page.evaluate(() => document.getElementById('floating-chat-btn').style.display);
            assert.strictEqual(floatDisplay, 'none', 'En el lobby de inicio el botón flotante de chat debe estar oculto');

            // 2. En modo 1v1 contra el bot: debe permanecer oculto
            await page.click('#btn-start-1v1');
            await page.waitForTimeout(200);
            floatDisplay = await page.evaluate(() => document.getElementById('floating-chat-btn').style.display);
            assert.strictEqual(floatDisplay, 'none', 'En modo 1 vs 1 contra el bot el botón flotante de chat debe estar oculto');

            // 3. Salir al lobby
            await page.click('#btn-salir');
            await page.waitForTimeout(200);

            // 4. Habilitar cuando hay partida online con jugadores en sala
            await page.evaluate(() => {
                window.ChatManager.habilitarChat(true, 'SALA-1234');
            });
            floatDisplay = await page.evaluate(() => document.getElementById('floating-chat-btn').style.display);
            assert.strictEqual(floatDisplay, 'flex', 'Al ingresar a sala online con jugadores el botón flotante debe mostrarse');

            // 5. El puntito inicial debe ser verde (pronto para interactuar)
            const dotClass = await page.evaluate(() => document.getElementById('chat-status-dot').className);
            assert(dotClass.includes('dot-verde'), 'El puntito debe ser de color verde cuando está pronto para interactuar');

            await page.close();
        });

        await runTest('Ventana de chat compacta y dinámica con cierre fácil (botón ✕, clic afuera en mesa y Escape)', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.goto(filePath);
            await page.waitForTimeout(300);
            await page.click('#btn-start-1v1');
            await page.waitForTimeout(300);

            // Habilitar chat online
            await page.evaluate(() => window.ChatManager.habilitarChat(true, 'SALA-TEST'));

            // 1. Abrir desde botón flotante y verificar dimensiones compactas
            await page.click('#floating-chat-btn');
            await page.waitForTimeout(200);

            const dimensions = await page.evaluate(() => {
                const drawer = document.getElementById('chat-drawer');
                const rect = drawer.getBoundingClientRect();
                return {
                    display: drawer.style.display,
                    width: rect.width,
                    height: rect.height
                };
            });
            assert.strictEqual(dimensions.display, 'flex', 'El chat drawer debe abrirse con display: flex');
            assert(dimensions.width <= 330, `El ancho de la ventana debe ser compacto (<= 330px), medido: ${dimensions.width}`);
            assert(dimensions.height <= 420, `La altura de la ventana debe ser compacta (<= 420px), medido: ${dimensions.height}`);

            // 2. Cerrar haciendo clic afuera (en el centro de la mesa)
            await page.click('#center-table');
            await page.waitForTimeout(200);
            let isChatOpen = await page.evaluate(() => document.getElementById('chat-drawer').style.display);
            assert.strictEqual(isChatOpen, 'none', 'El chat debe cerrarse fácilmente al hacer clic afuera en la mesa');

            // 3. Abrir nuevamente y cerrar con tecla Escape
            await page.click('#floating-chat-btn');
            await page.waitForTimeout(200);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
            isChatOpen = await page.evaluate(() => document.getElementById('chat-drawer').style.display);
            assert.strictEqual(isChatOpen, 'none', 'El chat debe cerrarse fácilmente con la tecla Escape');

            // 4. Abrir nuevamente y cerrar con el botón ✕
            await page.click('#floating-chat-btn');
            await page.waitForTimeout(200);
            await page.click('#btn-close-chat');
            await page.waitForTimeout(200);
            isChatOpen = await page.evaluate(() => document.getElementById('chat-drawer').style.display);
            assert.strictEqual(isChatOpen, 'none', 'El chat debe cerrarse con el botón ✕');

            await page.close();
        });

        await runTest('Envío de mensajes, reacciones y puntito amarillo en el icono cuando hay chats sin leer', async () => {
            const page = await browser.newPage();
            await page.goto(filePath);
            await page.waitForTimeout(300);

            await page.evaluate(() => window.ChatManager.habilitarChat(true, 'SALA-TEST'));

            // 1. Abrir chat y enviar mensaje de texto
            await page.click('#floating-chat-btn');
            await page.waitForTimeout(200);

            await page.fill('#chat-input-field', '¡Buena suerte en la mano!');
            await page.click('#btn-chat-send');
            await page.waitForTimeout(200);

            const msgText = await page.innerText('#chat-messages-container');
            assert(msgText.includes('¡Buena suerte en la mano!'), 'El mensaje enviado debe aparecer en el historial del chat');

            // 2. Enviar reacción rápida con 1 tap
            await page.click('.quick-reaction-btn:first-child');
            await page.waitForTimeout(200);
            const historyWithReaction = await page.innerText('#chat-messages-container');
            assert(historyWithReaction.includes('Buena jugada'), 'La reacción rápida debe agregarse al historial');

            // 3. Cerrar chat y simular mensaje entrante de rival
            await page.click('#btn-close-chat');
            await page.waitForTimeout(200);

            await page.evaluate(() => {
                window.ChatManager.recibirMensaje({
                    id: 'test_rival_msg_1',
                    seat: 1,
                    nombre: 'Rival',
                    texto: '¡Ojo con ese descarte compadre!',
                    tipo: 'texto',
                    ts: Date.now()
                });
            });
            await page.waitForTimeout(200);

            // El puntito en la esquina superior derecha debe ser AMARILLO
            const dotClass = await page.evaluate(() => document.getElementById('chat-status-dot').className);
            assert(dotClass.includes('dot-amarillo'), 'El puntito debe ser amarillo cuando hay chats sin leer');

            // Badge de no leídos debe mostrar 1
            const badgeText = await page.innerText('#chat-unread-badge');
            assert.strictEqual(badgeText, '1', 'El badge de mensajes no leídos debe marcar 1');

            // Bocadillo flotante en mesa
            const bubbleEl = await page.$('.speech-bubble-pop');
            assert.ok(bubbleEl, 'Debe aparecer un bocadillo flotante de chat en la mesa cuando el chat está cerrado');

            // Al abrir el chat, el puntito debe volver a VERDE
            await page.click('#floating-chat-btn');
            await page.waitForTimeout(200);
            const dotClassAfter = await page.evaluate(() => document.getElementById('chat-status-dot').className);
            assert(dotClassAfter.includes('dot-verde'), 'El puntito debe volver a verde al abrir y leer los mensajes');

            await page.close();
        });

        await runTest('Llamada de voz WebRTC muestra puntito rojo en icono y controles de audio', async () => {
            const page = await browser.newPage();
            await page.goto(filePath);
            await page.waitForTimeout(300);

            await page.evaluate(() => window.ChatManager.habilitarChat(true, 'SALA-TEST'));

            // Mockear getUserMedia para el entorno headless sin hardware físico de micrófono
            await page.evaluate(() => {
                if (!navigator.mediaDevices) navigator.mediaDevices = {};
                navigator.mediaDevices.getUserMedia = async () => {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const dst = ctx.createMediaStreamDestination();
                    osc.connect(dst);
                    osc.start();
                    return dst.stream;
                };
            });

            // 1. Abrir chat y unirse a la llamada de voz
            await page.click('#floating-chat-btn');
            await page.waitForTimeout(200);

            await page.click('#btn-voice-join');
            await page.waitForTimeout(300);

            // Puntito debe ser ROJO e icono debe ser de llamada
            const voiceDotClass = await page.evaluate(() => document.getElementById('chat-status-dot').className);
            assert(voiceDotClass.includes('dot-rojo'), 'El puntito debe ser ROJO cuando se encuentra activa una llamada');

            const iconText = await page.innerText('#floating-chat-btn .chat-icon');
            assert.strictEqual(iconText, '📞', 'El icono del botón flotante debe cambiar a llamada activa');

            // 2. Silenciar micrófono
            await page.click('#btn-voice-mute');
            await page.waitForTimeout(150);
            let muteText = await page.innerText('#btn-voice-mute');
            assert.strictEqual(muteText, '🔇', 'El icono del botón debe cambiar a micrófono silenciado');

            // Desilenciar micrófono
            await page.click('#btn-voice-mute');
            await page.waitForTimeout(150);
            muteText = await page.innerText('#btn-voice-mute');
            assert.strictEqual(muteText, '🎙️', 'El icono del botón debe volver a micrófono activo');

            // 3. Silenciar altavoz (deafen)
            await page.click('#btn-voice-deafen');
            await page.waitForTimeout(150);
            let deafenText = await page.innerText('#btn-voice-deafen');
            assert.strictEqual(deafenText, '🔈', 'El icono debe indicar altavoz silenciado');

            // 4. Colgar llamada
            await page.click('#btn-voice-hangup');
            await page.waitForTimeout(200);

            // El puntito debe volver a VERDE e icono a 💬
            const dotAfterHangup = await page.evaluate(() => document.getElementById('chat-status-dot').className);
            assert(dotAfterHangup.includes('dot-verde'), 'El puntito debe volver a VERDE al colgar la llamada');

            const iconAfterHangup = await page.innerText('#floating-chat-btn .chat-icon');
            assert.strictEqual(iconAfterHangup, '💬', 'El icono debe volver a 💬 al colgar la llamada');

            await page.close();
        });

    } finally {
        if (browser) await browser.close();
    }

    console.log('\n======================================================');
    console.log(`🏁 RESULTADO BROWSER: ${passed}/${total} tests pasados con éxito.`);
    console.log('======================================================\n');

    if (passed !== total) {
        process.exit(1);
    }
})();
