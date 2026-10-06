// js/soundmanager.js
// Gestor de audio con síntesis procedural Web Audio API (100% offline y sin fallos)

class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.audioCache = {};
        this._initContext();
    }

    _initContext() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        } catch (e) {
            this.ctx = null;
        }
    }

    unlock() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    setMuted(val) {
        this.muted = !!val;
    }

    play(soundName) {
        if (this.muted) return;
        this.unlock();

        // Síntesis procedural garantizada (suena idéntico a fichas, naipes y campanadas de casino)
        try {
            this._playSynth(soundName);
        } catch (e) {}
    }

    _playSynth(type) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;

        if (type === 'card-draw' || type === 'card-deal') {
            // Sonido de deslizamiento de naipe sobre el paño
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, t);
            osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, t);
            filter.frequency.exponentialRampToValueAtTime(400, t + 0.12);

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.12);
        } 
        else if (type === 'card-discard' || type === 'card-play') {
            // Golpe seco y suave del naipe contra la mesa
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.15);
        } 
        else if (type === 'cut' || type === 'corte') {
            // Acorde triunfal brillante de corte (Do - Mi - Sol - Do agudo)
            const freqs = [523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t + i * 0.08);

                gain.gain.setValueAtTime(0.2, t + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.45);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(t + i * 0.08);
                osc.stop(t + i * 0.08 + 0.45);
            });
        } 
        else if (type === 'conga' || type === 'win') {
            // Fanfarria de victoria / Conga
            const notes = [440, 554.37, 659.25, 880, 1108.73];
            notes.forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, t + i * 0.1);

                gain.gain.setValueAtTime(0.3, t + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.6);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(t + i * 0.1);
                osc.stop(t + i * 0.1 + 0.6);
            });
        } 
        else if (type === 'loss' || type === 'castigo') {
            // Sonido de fallo o penalización
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(260, t);
            osc.frequency.exponentialRampToValueAtTime(90, t + 0.35);

            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.35);
        }
        else if (type === 'shuffle') {
            // Efecto de mezclar cartas
            for (let i = 0; i < 4; i++) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300 + Math.random() * 100, t + i * 0.06);
                gain.gain.setValueAtTime(0.15, t + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.06 + 0.05);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(t + i * 0.06);
                osc.stop(t + i * 0.06 + 0.05);
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SoundManager };
} else {
    window.SoundManager = SoundManager;
}
