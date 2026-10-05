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
            await page.goto(filePath);

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
            await page.goto(filePath);

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
            await page.goto(filePath);

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
            await page.goto(filePath);

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
            await page.goto(filePath);

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
            await page.goto(filePath);

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
            await page.goto(filePath);

            await page.click('#btn-start-1v1');
            await page.waitForTimeout(600);

            const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
            const innerWidth = await page.evaluate(() => window.innerWidth);
            assert(scrollWidth <= innerWidth, 'No debe haber desborde horizontal en celular');

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
