# 🎴 Conga Uruguaya Premium

Simulador profesional del juego tradicional de naipes **Conga Uruguaya**, desarrollado con cartas españolas tradicionales, Inteligencia Artificial táctica y Multijugador en tiempo real con Firebase.

---

## 🧉 Características Principales

* **Mazo de Cartas Españolas Completo:** 40 o 48 cartas con ilustraciones criollas clásicas más 2 comodines opcionales.
* **Motor de Reglas y Combinaciones:**
  * Detección automática óptima de **Escaleras (Runs)** y **Piernas / Tríos / Cuartetos (Sets)**.
  * Soporte para sustitución de **Comodines**.
  * **¡CONGA LIMPIA! (7 Cartas seguidas):** 7 cartas consecutivas del mismo palo sin comodín (victoria inmediata).
  * **Conga con Comodín:** -25 puntos de premio.
  * **Corte en 0 (Limpio):** -10 puntos de premio.
  * **Corte con cartas sueltas:** corte con 5 puntos o menos.
  * **Acomodo de cartas (Layoffs):** los rivales pueden ligar cartas en las combinaciones del cortador.
  * **Castigo por corte fallido:** si un rival empata o supera al cortador, el cortador sufre un recargo de +10 pts y el rival suma 0 pts.
  * **Eliminación y Reenganche:** límite de 100 puntos acumulados, eliminación al pasarse y reenganche táctico.
* **Inteligencia Artificial Táctica (CongaBot):**
  * Evalúa el pozo de descarte vs. mazo de robo.
  * Descarte inteligente minimizando deadwood y priorizando soltar cartas altas innecesarias.
  * Corte automático y seguro.
* **Multijugador Online en Tiempo Real (Firebase):**
  * Creación de salas privadas con código PIN y salas públicas en lobby en vivo.
  * Protección anti-trampas (las manos de los rivales se ocultan en red hasta que alguien corta).
  * Heartbeat y reconexión automática.
* **Audio Procedural Web Audio API:**
  * Efectos sonoros de deslizamiento, golpe sobre el paño, campanadas de corte y fanfarria de victoria que funcionan 100% offline.
* **Diseño UI/UX Casino:**
  * Paño verde de fieltro con texturas y bordes de madera.
  * Cartas en abanico con etiquetas interactivas de `LIGADA` y `SUELTA`.
  * Botón de **Auto-ordenar** para organizar la mano instantáneamente.
  * Adaptabilidad completa para celulares (vertical y horizontal) y computadoras.
* **PWA & Offline:** Soporte para instalación como aplicación web nativa (Service Worker).

---

## 🌐 Jugar Online

Puedes jugar directamente desde el navegador en GitHub Pages:
👉 **[https://eltopouy.github.io/conga-uruguaya/](https://eltopouy.github.io/conga-uruguaya/)**

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con 41 pruebas automatizadas:
* **24 Tests Unitarios:** Validación de mazo, combinaciones, algoritmo de melds, corte, acomodo, puntuaciones y bot.
* **9 Tests de Simulación E2E:** Flujo completo 1v1 y 4P, reordenamiento manual de mano, audio, manifiesto y service worker.
* **8 Tests en Navegador Real (Playwright):** Renderizado, interfaz gráfica, modales, arrastre interactivo con mouse/touch y responsividad mobile.

Ejecutar pruebas:
```bash
npm test         # Pruebas unitarias y de simulación
npm run test:all # Suite completa incluyendo Playwright
```

---

## 📜 Licencia

MIT License - Desarrollado por Andrés Franchi Ugartemendía.
