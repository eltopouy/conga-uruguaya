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
        await runTest('Clic en "1 vs 1" inicia la partida, reparte 7 cartas y muestra el pozo', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            const startScreenVisible = await page.isVisible('#start-screen');
            assert.strictEqual(startScreenVisible, false, 'La pantalla de inicio debe ocultarse');

            // Verificar 7 cartas en mano
            const cards = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cards.length, 7, 'El jugador debe tener 7 cartas');

            // Verificar que el pozo de descarte tiene carta visible
            const discardBg = await page.evaluate(() => {
                return document.getElementById('discard-pile-element').style.backgroundImage;
            });
            assert(discardBg && discardBg !== 'none', 'El pozo de descarte debe mostrar una carta');

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

        // TEST 5: Mecánica de juego: Robar carta incrementa mano a 8
        await runTest('Robar del mazo pasa la mano a 8 cartas y habilita botón descartar al seleccionar', async () => {
            const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.route('**/*.firebaseio.com/**', route => route.abort());
            await page.goto(filePath, { waitUntil: 'domcontentloaded' });

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            // Robar del mazo
            await page.click('#btn-robar-mazo');
            await page.waitForTimeout(300);

            const cardsAfterDraw = await page.$$('#player-hand-fan .hand-card');
            assert.strictEqual(cardsAfterDraw.length, 8, 'El jugador debe tener 8 cartas tras robar');

            // Seleccionar la primera carta
            await cardsAfterDraw[0].click();
            await page.waitForTimeout(200);

            const isDescartarEnabled = await page.evaluate(() => {
                return !document.getElementById('btn-descartar').disabled;
            });
            assert.strictEqual(isDescartarEnabled, true, 'El botón descartar debe habilitarse al seleccionar una carta');

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
            assert.strictEqual(cards.length, 7, 'Deben mantenerse las 7 cartas ordenadas');

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
            assert.strictEqual(newOrder.length, 7, 'La cantidad de cartas debe seguir siendo 7');

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
            assert.strictEqual(badges.length, 7, 'Debe mostrar 7 badges de puntos/juego tras activarlo en configuración');

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
