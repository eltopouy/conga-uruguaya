// js/chatmanager.js
// Gestor de Chat en Tiempo Real y Llamadas de Voz WebRTC P2P para Conga Uruguaya

(function () {
    class ChatManager {
        constructor() {
            this.isOpen = false;
            this.unreadCount = 0;
            this.messages = [];
            this.listenersAttached = false;
            this.chatSubscriptionActive = false;

            // Estado de Voz (WebRTC)
            this.voice = {
                active: false,
                connecting: false,
                muted: false,
                deafened: false,
                localStream: null,
                remoteStream: null,
                peerConnection: null,
                audioContext: null,
                analyser: null,
                animFrameId: null,
                isSpeaking: false,
                participants: {}
            };

            // Respuestas simpáticas criollas del bot cuando se juega contra la máquina
            this.botResponses = {
                '¡Buena jugada! 👏': [
                    "¡Gracias botija! Se hace lo que se puede con estas cartas.",
                    "¡Vamo' arriba! Mirá que la mano recién empieza.",
                    "Buena jugada la tuya también, che 😉"
                ],
                '¡Qué suerte! 🍀': [
                    "La suerte es de quien la trabaja, compadre jaja.",
                    "¡Ni me hables de suerte que me vienen todos palos cambiados!",
                    "¡Un poco de suerte y mucha maña criolla! 😂"
                ],
                '¡Vamos! 🔥': [
                    "¡Meta y ponga! A ver quién corta primero.",
                    "¡Con todo! No aflojes que estoy al acecho.",
                    "¡Apretá los dientes que se viene brava la mano!"
                ],
                '¡Casi corto! 🤏': [
                    "¡Uy! Por un pelo de tatú no te canté corte yo antes.",
                    "¡Apúrate que me faltan 2 puntos nada más!",
                    "¡Te salvaste por un naipe nomás!"
                ],
                'Ufff 😅': [
                    "Tranquilo que peor es perder el bondi bajo la lluvia jaja.",
                    "¡Qué mano tensa, mi dios!",
                    "Respirá hondo que ahora viene la revancha."
                ],
                '¡Jajaja! 😂': [
                    "¡Jajaja qué partida nos estamos echando!",
                    "¡Dejate de reírte que te voy a acomodar hasta el comodín!",
                    "¡Así da gusto jugar a la Conga!"
                ],
                '¡Conga! 👑': [
                    "¡¿Qué Conga ni Conga?! ¡Mostrá los naipes primero! 😂",
                    "¡Epa! Si me clavás Conga pago el asado.",
                    "¡Ni sueñes! Todavía tengo un As bajo la manga."
                ],
                '¿Estás ahí? 👀': [
                    "¡Acá estoy firme al pie del cañón!",
                    "Pensando la jugada... que esto no es chinchón de kermesse 😉",
                    "¡Presente! Esperando que tires algo bueno al pozo."
                ]
            };

            this.genericBotReplies = [
                "¡Vamo' arriba!",
                "Buena jugada, pero ojo al pozo...",
                "¡Qué mano apretada!",
                "La suerte está echada, compadre.",
                "Tranquilo que todavía hay juego.",
                "¡A ver qué descartás ahora!"
            ];
        }

        init() {
            this._setupDOMListeners();
            this._setupAudioPlayback();
        }

        _setupAudioPlayback() {
            let audioEl = document.getElementById('webrtc-remote-audio');
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'webrtc-remote-audio';
                audioEl.autoplay = true;
                audioEl.playsInline = true;
                audioEl.style.display = 'none';
                document.body.appendChild(audioEl);
            }
        }

        _setupDOMListeners() {
            if (this.listenersAttached) return;
            this.listenersAttached = true;

            // Botón flotante de chat
            const floatBtn = document.getElementById('floating-chat-btn');
            if (floatBtn) {
                floatBtn.addEventListener('click', () => this.toggleChat());
            }

            // Botón de chat en barra superior de escritorio
            const topChatBtn = document.getElementById('btn-chat');
            if (topChatBtn) {
                topChatBtn.addEventListener('click', () => this.toggleChat());
            }

            // Botón de chat en menú móvil
            const hChatBtn = document.getElementById('h-btn-chat');
            if (hChatBtn) {
                hChatBtn.addEventListener('click', () => {
                    if (window.cerrarMenuHamburguesa) window.cerrarMenuHamburguesa();
                    this.toggleChat();
                });
            }

            // Botón cerrar chat
            const closeBtn = document.getElementById('btn-close-chat');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.cerrarChat());
            }

            // Formulario de envío de texto
            const form = document.getElementById('chat-input-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const input = document.getElementById('chat-input-field');
                    if (input && input.value.trim()) {
                        this.enviarMensaje(input.value.trim(), 'texto');
                        input.value = '';
                    }
                });
            }

            // Botones de reacciones rápidas
            document.querySelectorAll('.quick-reaction-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const text = btn.getAttribute('data-text') || btn.innerText.trim();
                    this.enviarMensaje(text, 'reaccion');
                });
            });

            // Botones de Voz WebRTC
            const btnJoin = document.getElementById('btn-voice-join');
            if (btnJoin) {
                btnJoin.addEventListener('click', () => this.toggleLlamadaVoz());
            }

            const btnMute = document.getElementById('btn-voice-mute');
            if (btnMute) {
                btnMute.addEventListener('click', () => this.toggleSilenciarMic());
            }

            const btnDeafen = document.getElementById('btn-voice-deafen');
            if (btnDeafen) {
                btnDeafen.addEventListener('click', () => this.toggleSilenciarAltavoz());
            }

            const btnHangup = document.getElementById('btn-voice-hangup');
            if (btnHangup) {
                btnHangup.addEventListener('click', () => this.colgarLlamadaVoz());
            }
        }

        conectarSalaOnline(codigoSala) {
            this.chatSubscriptionActive = false;
            this.limpiarMensajes();

            const badge = document.getElementById('chat-room-badge');
            if (badge) badge.innerText = codigoSala ? `Sala: ${codigoSala}` : 'Sala Local';

            if (window.FirebaseManager && window.FirebaseManager.isAvailable() && codigoSala) {
                this.chatSubscriptionActive = true;
                window.FirebaseManager.escucharChat((msg) => {
                    this.recibirMensaje(msg);
                });

                // Escuchar participantes de voz
                window.FirebaseManager.escucharParticipantesVoz((parts) => {
                    this.voice.participants = parts || {};
                    this._actualizarUIConcurrenciaVoz();
                });

                // Escuchar ofertas entrantes si es invitado
                window.FirebaseManager.escucharOfertaVoz((offerData) => {
                    if (!offerData || !this.voice.active) return;
                    const miSeat = window.FirebaseManager.getMiSeat();
                    if (offerData.fromSeat !== miSeat && offerData.sdp) {
                        this._procesarOfertaRemota(offerData.sdp);
                    }
                });

                // Escuchar respuestas entrantes si es host
                window.FirebaseManager.escucharRespuestaVoz((answerData) => {
                    if (!answerData || !this.voice.active) return;
                    const miSeat = window.FirebaseManager.getMiSeat();
                    if (answerData.fromSeat !== miSeat && answerData.sdp) {
                        this._procesarRespuestaRemota(answerData.sdp);
                    }
                });
            }
        }

        toggleChat() {
            if (this.isOpen) {
                this.cerrarChat();
            } else {
                this.abrirChat();
            }
        }

        abrirChat() {
            this.isOpen = true;
            this.unreadCount = 0;
            this._actualizarBadges();

            const drawer = document.getElementById('chat-drawer');
            if (drawer) {
                drawer.style.display = 'flex';
                drawer.classList.add('chat-drawer-open');
            }

            const input = document.getElementById('chat-input-field');
            if (input) {
                setTimeout(() => input.focus(), 150);
            }

            this._scrollAlFinal();
        }

        cerrarChat() {
            this.isOpen = false;
            const drawer = document.getElementById('chat-drawer');
            if (drawer) {
                drawer.style.display = 'none';
                drawer.classList.remove('chat-drawer-open');
            }
        }

        limpiarMensajes() {
            this.messages = [];
            const container = document.getElementById('chat-messages-container');
            if (container) container.innerHTML = '';
            this.unreadCount = 0;
            this._actualizarBadges();
        }

        enviarMensaje(texto, tipo = 'texto') {
            if (!texto || !texto.trim()) return;
            const textoLimpio = texto.trim().substring(0, 150);

            const esMultiplayer = (window.modoJuego === 'multiplayer' && window.FirebaseManager && window.FirebaseManager.isAvailable());
            const miSeat = esMultiplayer ? window.FirebaseManager.getMiSeat() : 0;
            const miNombre = (window.engine && window.engine.players[miSeat] && window.engine.players[miSeat].name)
                ? window.engine.players[miSeat].name
                : (window.engine?.config?.nombreJugador || 'Tú');

            if (esMultiplayer) {
                window.FirebaseManager.enviarMensajeChat(textoLimpio, tipo);
            } else {
                // Modo solitario / práctica contra el bot
                const msg = {
                    id: 'msg_' + Date.now(),
                    seat: 0,
                    nombre: miNombre,
                    texto: textoLimpio,
                    tipo,
                    ts: Date.now()
                };
                this.recibirMensaje(msg);

                // Respuesta automática del bot si se juega contra la máquina
                if (window.engine && window.engine.players.length > 1) {
                    this._responderComoBot(textoLimpio, tipo);
                }
            }
        }

        _responderComoBot(textoUsuario, tipo) {
            const botSeat = 1;
            const bot = window.engine.players[botSeat];
            const botNombre = bot ? bot.name : 'Tatú';

            let respuesta = null;
            if (this.botResponses[textoUsuario]) {
                const arr = this.botResponses[textoUsuario];
                respuesta = arr[Math.floor(Math.random() * arr.length)];
            } else {
                respuesta = this.genericBotReplies[Math.floor(Math.random() * this.genericBotReplies.length)];
            }

            setTimeout(() => {
                const botMsg = {
                    id: 'msg_bot_' + Date.now(),
                    seat: botSeat,
                    nombre: botNombre,
                    texto: respuesta,
                    tipo: 'texto',
                    ts: Date.now()
                };
                this.recibirMensaje(botMsg);
            }, 1000 + Math.random() * 800);
        }

        recibirMensaje(msg) {
            if (!msg || !msg.texto) return;

            // Evitar duplicados por id
            if (msg.id && this.messages.some(m => m.id === msg.id)) return;
            this.messages.push(msg);

            // Sonido de mensaje entrante
            if (window.sound && typeof window.sound.play === 'function') {
                window.sound.play('chat-message');
            }

            // Renderizar en el historial
            this._renderizarFilaMensaje(msg);

            // Si el chat está cerrado, incrementar contador y mostrar bocadillo flotante en mesa
            if (!this.isOpen) {
                this.unreadCount++;
                this._actualizarBadges();
                this._mostrarBocadilloFlotante(msg);
            }

            this._scrollAlFinal();
        }

        _actualizarBadges() {
            const floatBadge = document.getElementById('chat-unread-badge');
            const topBadge = document.getElementById('top-chat-badge');
            const hBadge = document.getElementById('h-chat-badge');

            const countStr = this.unreadCount > 9 ? '9+' : String(this.unreadCount);
            const mostrar = this.unreadCount > 0;

            [floatBadge, topBadge, hBadge].forEach(badge => {
                if (badge) {
                    badge.innerText = countStr;
                    badge.style.display = mostrar ? 'inline-flex' : 'none';
                }
            });
        }

        _renderizarFilaMensaje(msg) {
            const container = document.getElementById('chat-messages-container');
            if (!container) return;

            const esMulti = (window.modoJuego === 'multiplayer' && window.FirebaseManager);
            const miSeat = esMulti ? window.FirebaseManager.getMiSeat() : 0;
            const esMio = (msg.seat === miSeat);

            const row = document.createElement('div');
            row.className = `chat-msg-row ${esMio ? 'msg-own' : 'msg-remote'}`;

            const timeStr = msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            let nombreDisplay = msg.nombre || (esMio ? 'Tú' : 'Rival');
            if (esMio) nombreDisplay = `${nombreDisplay} (Tú)`;

            if (msg.tipo === 'reaccion') {
                row.classList.add('msg-reaction');
                row.innerHTML = `
                    <div class="msg-bubble reaction-bubble">
                        <div class="msg-sender">${nombreDisplay} <span class="msg-time">${timeStr}</span></div>
                        <div class="msg-text reaction-text">${this._escapeHTML(msg.texto)}</div>
                    </div>
                `;
            } else {
                row.innerHTML = `
                    <div class="msg-bubble">
                        <div class="msg-sender">${nombreDisplay} <span class="msg-time">${timeStr}</span></div>
                        <div class="msg-text">${this._escapeHTML(msg.texto)}</div>
                    </div>
                `;
            }

            container.appendChild(row);
        }

        _mostrarBocadilloFlotante(msg) {
            let container = document.getElementById('floating-speech-bubbles-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'floating-speech-bubbles-container';
                document.getElementById('game-container')?.appendChild(container);
            }
            if (!container) return;

            const esMulti = (window.modoJuego === 'multiplayer' && window.FirebaseManager);
            const miSeat = esMulti ? window.FirebaseManager.getMiSeat() : 0;
            const esMio = (msg.seat === miSeat);

            const bubble = document.createElement('div');
            bubble.className = `speech-bubble-pop ${esMio ? 'bubble-own' : 'bubble-remote'}`;
            bubble.innerHTML = `
                <div class="bubble-sender">${this._escapeHTML(msg.nombre || 'Jugador')}</div>
                <div class="bubble-content">${this._escapeHTML(msg.texto)}</div>
            `;

            container.appendChild(bubble);

            setTimeout(() => {
                bubble.classList.add('bubble-fade-out');
                setTimeout(() => bubble.remove(), 400);
            }, 3400);
        }

        _scrollAlFinal() {
            const container = document.getElementById('chat-messages-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }

        _escapeHTML(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // -------------------------------------------------------------
        // LLAMADA DE VOZ (WebRTC P2P)
        // -------------------------------------------------------------
        async toggleLlamadaVoz() {
            if (this.voice.active) {
                this.colgarLlamadaVoz();
            } else {
                await this.iniciarLlamadaVoz();
            }
        }

        async iniciarLlamadaVoz() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("Tu navegador o entorno no soporta llamadas de voz directas por micrófono. El chat de texto y reacciones siguen disponibles.");
                return;
            }

            try {
                this.voice.connecting = true;
                this._actualizarEstadoVozUI("Solicitando micrófono...", "connecting");

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });

                this.voice.localStream = stream;
                this.voice.active = true;
                this.voice.connecting = false;
                this.voice.muted = false;
                this.voice.deafened = false;

                // Iniciar detección de voz local (VAD)
                this._iniciarDeteccionHabla(stream);

                const esMulti = (window.modoJuego === 'multiplayer' && window.FirebaseManager && window.FirebaseManager.isAvailable());
                if (esMulti) {
                    const miSeat = window.FirebaseManager.getMiSeat();
                    const miNombre = window.engine?.players[miSeat]?.name || `Jugador ${miSeat}`;

                    window.FirebaseManager.registrarParticipanteVoz(miSeat, { name: miNombre, speaking: false });

                    // Crear conexión WebRTC P2P
                    await this._establecerConexionP2P();
                    this._actualizarEstadoVozUI("En llamada de voz 🟢", "connected");
                } else {
                    // Modo local / prueba de voz
                    this._actualizarEstadoVozUI("Prueba de audio activa (Micrófono OK) 🟢", "connected");
                }

                this._actualizarControlesVozUI();

                // Mostrar indicador de voz en botón flotante
                const voiceDot = document.getElementById('voice-active-indicator');
                if (voiceDot) voiceDot.style.display = 'block';

            } catch (err) {
                console.warn("Acceso a micrófono denegado o error:", err);
                this.voice.active = false;
                this.voice.connecting = false;
                this._actualizarEstadoVozUI("Micrófono no conectado", "disconnected");
                this._actualizarControlesVozUI();
                alert("No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.");
            }
        }

        async _establecerConexionP2P() {
            const iceServers = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            };

            const pc = new RTCPeerConnection(iceServers);
            this.voice.peerConnection = pc;

            // Añadir pistas de audio local
            if (this.voice.localStream) {
                this.voice.localStream.getAudioTracks().forEach(track => {
                    pc.addTrack(track, this.voice.localStream);
                });
            }

            // Reproducir audio entrante del rival
            pc.ontrack = (event) => {
                const remoteAudio = document.getElementById('webrtc-remote-audio');
                if (remoteAudio && event.streams[0]) {
                    remoteAudio.srcObject = event.streams[0];
                    remoteAudio.play().catch(() => {});
                    this._iniciarDeteccionHablaRemoto(event.streams[0]);
                }
            };

            // Enviar candidatos ICE
            pc.onicecandidate = (event) => {
                if (event.candidate && window.FirebaseManager) {
                    window.FirebaseManager.enviarCandidatoIceVoz(event.candidate.toJSON());
                }
            };

            const miSeat = window.FirebaseManager.getMiSeat();
            const remoteSeat = (miSeat === 0) ? 1 : 0;

            // Escuchar candidatos del rival
            window.FirebaseManager.escucharCandidatosIceVoz(remoteSeat, (candData) => {
                if (candData && this.voice.peerConnection) {
                    try {
                        this.voice.peerConnection.addIceCandidate(new RTCIceCandidate(candData)).catch(() => {});
                    } catch (_) {}
                }
            });

            // Rol Creador (Seat 0) inicia oferta SDP
            if (miSeat === 0) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                window.FirebaseManager.enviarOfertaVoz(offer);
            }
        }

        async _procesarOfertaRemota(offerSdp) {
            if (!this.voice.peerConnection) return;
            try {
                await this.voice.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
                const answer = await this.voice.peerConnection.createAnswer();
                await this.voice.peerConnection.setLocalDescription(answer);
                if (window.FirebaseManager) {
                    window.FirebaseManager.enviarRespuestaVoz(answer);
                }
            } catch (err) {
                console.warn("Error procesando oferta remota:", err);
            }
        }

        async _procesarRespuestaRemota(answerSdp) {
            if (!this.voice.peerConnection) return;
            try {
                await this.voice.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
            } catch (err) {
                console.warn("Error procesando respuesta remota:", err);
            }
        }

        toggleSilenciarMic() {
            if (!this.voice.localStream) return;
            this.voice.muted = !this.voice.muted;

            this.voice.localStream.getAudioTracks().forEach(t => {
                t.enabled = !this.voice.muted;
            });

            const btnMute = document.getElementById('btn-voice-mute');
            if (btnMute) {
                btnMute.innerText = this.voice.muted ? '🔇' : '🎙️';
                btnMute.classList.toggle('btn-muted', this.voice.muted);
                btnMute.title = this.voice.muted ? 'Activar micrófono' : 'Silenciar micrófono';
            }
        }

        toggleSilenciarAltavoz() {
            const remoteAudio = document.getElementById('webrtc-remote-audio');
            this.voice.deafened = !this.voice.deafened;

            if (remoteAudio) {
                remoteAudio.muted = this.voice.deafened;
            }

            const btnDeafen = document.getElementById('btn-voice-deafen');
            if (btnDeafen) {
                btnDeafen.innerText = this.voice.deafened ? '🔈' : '🔊';
                btnDeafen.classList.toggle('btn-deafened', this.voice.deafened);
                btnDeafen.title = this.voice.deafened ? 'Activar altavoz' : 'Silenciar altavoz';
            }
        }

        colgarLlamadaVoz() {
            if (this.voice.localStream) {
                this.voice.localStream.getTracks().forEach(t => t.stop());
                this.voice.localStream = null;
            }

            if (this.voice.peerConnection) {
                this.voice.peerConnection.close();
                this.voice.peerConnection = null;
            }

            if (this.voice.audioContext) {
                try { this.voice.audioContext.close(); } catch (_) {}
                this.voice.audioContext = null;
            }

            if (this.voice.animFrameId) {
                cancelAnimationFrame(this.voice.animFrameId);
                this.voice.animFrameId = null;
            }

            const esMulti = (window.modoJuego === 'multiplayer' && window.FirebaseManager);
            if (esMulti) {
                const miSeat = window.FirebaseManager.getMiSeat();
                window.FirebaseManager.removerParticipanteVoz(miSeat);
                window.FirebaseManager.limpiarSenalesVoz();
            }

            this.voice.active = false;
            this.voice.connecting = false;
            this.voice.isSpeaking = false;

            this._actualizarEstadoVozUI("Llamada de voz desconectada", "disconnected");
            this._actualizarControlesVozUI();

            const voiceDot = document.getElementById('voice-active-indicator');
            if (voiceDot) voiceDot.style.display = 'none';

            // Limpiar halos de voz en el tablero
            document.querySelectorAll('.speaking-ring').forEach(el => el.classList.remove('speaking-ring'));
        }

        _iniciarDeteccionHabla(stream) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;

                const ctx = new AudioCtx();
                this.voice.audioContext = ctx;
                const src = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.4;
                src.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                let consecutiveSpeaking = 0;

                const checkAudioLevel = () => {
                    if (!this.voice.active) return;
                    analyser.getByteFrequencyData(dataArray);

                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avg = sum / dataArray.length;
                    const speakingNow = (!this.voice.muted && avg > 14);

                    if (speakingNow) {
                        consecutiveSpeaking++;
                    } else {
                        consecutiveSpeaking = Math.max(0, consecutiveSpeaking - 1);
                    }

                    const isCurrentlySpeaking = consecutiveSpeaking >= 2;
                    if (this.voice.isSpeaking !== isCurrentlySpeaking) {
                        this.voice.isSpeaking = isCurrentlySpeaking;
                        this._actualizarHaloHablaLocal(isCurrentlySpeaking);

                        if (window.FirebaseManager && window.modoJuego === 'multiplayer') {
                            const miSeat = window.FirebaseManager.getMiSeat();
                            window.FirebaseManager.actualizarEstadoHablandoVoz(miSeat, isCurrentlySpeaking);
                        }
                    }

                    this.voice.animFrameId = requestAnimationFrame(checkAudioLevel);
                };

                checkAudioLevel();
            } catch (e) {
                console.warn("VAD no iniciado:", e);
            }
        }

        _iniciarDeteccionHablaRemoto(remoteStream) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx || !this.voice.audioContext) return;

                const src = this.voice.audioContext.createMediaStreamSource(remoteStream);
                const analyser = this.voice.audioContext.createAnalyser();
                analyser.fftSize = 512;
                src.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                const checkRemoteLevel = () => {
                    if (!this.voice.active) return;
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const avg = sum / dataArray.length;
                    const speaking = (avg > 14);
                    this._actualizarHaloHablaRemoto(speaking);
                    requestAnimationFrame(checkRemoteLevel);
                };

                checkRemoteLevel();
            } catch (_) {}
        }

        _actualizarHaloHablaLocal(speaking) {
            const btnMute = document.getElementById('btn-voice-mute');
            if (btnMute) {
                btnMute.classList.toggle('is-speaking-pulse', speaking);
            }
            const localAvatar = document.querySelector('#player-hand-container');
            if (localAvatar) {
                localAvatar.classList.toggle('speaking-ring', speaking);
            }
        }

        _actualizarHaloHablaRemoto(speaking) {
            const rivalBox = document.querySelector('.opponent-box');
            if (rivalBox) {
                rivalBox.classList.toggle('speaking-ring', speaking);
            }
        }

        _actualizarUIConcurrenciaVoz() {
            const count = Object.keys(this.voice.participants || {}).length;
            if (this.voice.active) {
                const plural = count === 1 ? '1 jugador' : `${count} jugadores`;
                this._actualizarEstadoVozUI(`En llamada de voz (${plural}) 🟢`, "connected");
            }
        }

        _actualizarEstadoVozUI(texto, clase) {
            const textEl = document.getElementById('voice-status-text');
            const dotEl = document.getElementById('voice-status-dot');

            if (textEl) textEl.innerText = texto;
            if (dotEl) {
                dotEl.className = 'voice-status-dot';
                if (clase) dotEl.classList.add(`voice-${clase}`);
            }
        }

        _actualizarControlesVozUI() {
            const btnJoin = document.getElementById('btn-voice-join');
            const btnMute = document.getElementById('btn-voice-mute');
            const btnDeafen = document.getElementById('btn-voice-deafen');
            const btnHangup = document.getElementById('btn-voice-hangup');

            if (this.voice.active) {
                if (btnJoin) btnJoin.style.display = 'none';
                if (btnMute) {
                    btnMute.style.display = 'inline-flex';
                    btnMute.innerText = this.voice.muted ? '🔇' : '🎙️';
                }
                if (btnDeafen) {
                    btnDeafen.style.display = 'inline-flex';
                    btnDeafen.innerText = this.voice.deafened ? '🔈' : '🔊';
                }
                if (btnHangup) btnHangup.style.display = 'inline-flex';
            } else {
                if (btnJoin) {
                    btnJoin.style.display = 'inline-flex';
                    btnJoin.innerText = '📞 Unirse';
                }
                if (btnMute) btnMute.style.display = 'none';
                if (btnDeafen) btnDeafen.style.display = 'none';
                if (btnHangup) btnHangup.style.display = 'none';
            }
        }
    }

    if (typeof window !== 'undefined') {
        window.ChatManager = new ChatManager();
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ChatManager };
    }
})();
