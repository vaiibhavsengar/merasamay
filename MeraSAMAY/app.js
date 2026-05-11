/* ========================================
   MeraSAMAY — Premium Digital Clock
   Application Logic
   ======================================== */

(function () {
    'use strict';

    // -------- DOM Elements --------
    const $ = (id) => document.getElementById(id);
    const digits = { h1: $('h1'), h2: $('h2'), m1: $('m1'), m2: $('m2'), s1: $('s1'), s2: $('s2') };
    const ampmEl = $('ampm');
    const colon1 = $('colon1');
    const colon2 = $('colon2');
    const greetingEl = $('greeting');
    const dateEl = $('dateDisplay');
    const tzLabelEl = $('tzLabel');
    const themeCheckbox = $('themeCheckbox');
    const formatCheckbox = $('formatCheckbox');
    const soundCheckbox = $('soundCheckbox');
    const tzSelect = $('tzSelect');
    const alarmInput = $('alarmInput');
    const alarmSetBtn = $('alarmSetBtn');
    const alarmClearBtn = $('alarmClearBtn');
    const alarmStatus = $('alarmStatus');
    const fullscreenBtn = $('fullscreenBtn');

    // -------- State --------
    let is24h = false;
    let isDark = true;
    let tickSound = false;
    let selectedTz = 'local';
    let alarmTime = null; // "HH:MM" in 24h
    let alarmTriggered = false;
    let audioCtx = null;
    let prevDigits = { h1: '', h2: '', m1: '', m2: '', s1: '', s2: '' };

    // -------- Load Preferences --------
    function loadPrefs() {
        const theme = localStorage.getItem('ms_theme');
        if (theme === 'light') { isDark = false; themeCheckbox.checked = false; }
        else { isDark = true; themeCheckbox.checked = true; }
        applyTheme();

        const fmt = localStorage.getItem('ms_format');
        if (fmt === '24') { is24h = true; formatCheckbox.checked = true; }

        const tz = localStorage.getItem('ms_tz');
        if (tz) { selectedTz = tz; tzSelect.value = tz; }

        const alarm = localStorage.getItem('ms_alarm');
        if (alarm) { setAlarm(alarm, true); }

        const snd = localStorage.getItem('ms_sound');
        if (snd === 'on') { tickSound = true; soundCheckbox.checked = true; }
    }

    // -------- Theme --------
    function applyTheme() {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }

    themeCheckbox.addEventListener('change', () => {
        isDark = themeCheckbox.checked;
        localStorage.setItem('ms_theme', isDark ? 'dark' : 'light');
        applyTheme();
    });

    // -------- 12/24h Format --------
    formatCheckbox.addEventListener('change', () => {
        is24h = formatCheckbox.checked;
        localStorage.setItem('ms_format', is24h ? '24' : '12');
        updateClock();
    });

    // -------- Sound Toggle --------
    soundCheckbox.addEventListener('change', () => {
        tickSound = soundCheckbox.checked;
        localStorage.setItem('ms_sound', tickSound ? 'on' : 'off');
        // Init audio context on first interaction
        if (tickSound && !audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    });

    // -------- Timezone --------
    tzSelect.addEventListener('change', () => {
        selectedTz = tzSelect.value;
        localStorage.setItem('ms_tz', selectedTz);
        updateClock();
    });

    // -------- Get Current Time for Selected TZ --------
    function getNow() {
        const now = new Date();
        if (selectedTz === 'local') return now;
        // Create a date string in the target timezone
        const str = now.toLocaleString('en-US', { timeZone: selectedTz });
        return new Date(str);
    }

    // -------- Greeting --------
    function getGreeting(hours) {
        if (hours >= 5 && hours < 12) return 'Good Morning 🌅';
        if (hours >= 12 && hours < 17) return 'Good Afternoon ☀️';
        if (hours >= 17 && hours < 21) return 'Good Evening 🌇';
        return 'Good Night 🌙';
    }

    // -------- Date Formatting --------
    function formatDate(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    // -------- Digit Update with Animation --------
    function setDigit(el, value) {
        const key = el.id;
        if (prevDigits[key] !== value) {
            el.textContent = value;
            el.classList.remove('flip');
            // Force reflow for re-triggering animation
            void el.offsetWidth;
            el.classList.add('flip');
            prevDigits[key] = value;
        }
    }

    // -------- Tick Sound --------
    function playTick() {
        if (!tickSound || !audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.value = 0.03;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.06);
        } catch (e) { /* silent fail */ }
    }

    // -------- Alarm --------
    function setAlarm(timeStr, silent) {
        alarmTime = timeStr;
        alarmTriggered = false;
        alarmInput.value = timeStr;
        alarmSetBtn.style.display = 'none';
        alarmClearBtn.style.display = 'inline-block';
        alarmStatus.textContent = `⏰ Alarm set for ${formatAlarmDisplay(timeStr)}`;
        if (!silent) localStorage.setItem('ms_alarm', timeStr);
    }

    function clearAlarm() {
        alarmTime = null;
        alarmTriggered = false;
        alarmInput.value = '';
        alarmSetBtn.style.display = 'inline-block';
        alarmClearBtn.style.display = 'none';
        alarmStatus.textContent = '';
        localStorage.removeItem('ms_alarm');
    }

    function formatAlarmDisplay(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        if (is24h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    function checkAlarm(now) {
        if (!alarmTime || alarmTriggered) return;
        const [ah, am] = alarmTime.split(':').map(Number);
        if (now.getHours() === ah && now.getMinutes() === am && now.getSeconds() === 0) {
            alarmTriggered = true;
            triggerAlarmUI();
        }
    }

    function triggerAlarmUI() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'alarm-overlay';
        overlay.innerHTML = `
            <div class="alarm-ring-icon">⏰</div>
            <div class="alarm-ring-text">ALARM!</div>
            <button class="btn-dismiss" id="dismissAlarm">Dismiss</button>
        `;
        document.body.appendChild(overlay);

        // Play alarm sound
        let alarmOscillator = null;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 880;
            osc.type = 'square';
            gain.gain.value = 0.15;
            osc.start();
            alarmOscillator = osc;

            // Pulsing sound
            const pulseInterval = setInterval(() => {
                gain.gain.value = gain.gain.value > 0.01 ? 0.01 : 0.15;
            }, 500);

            overlay.querySelector('#dismissAlarm').addEventListener('click', () => {
                clearInterval(pulseInterval);
                osc.stop();
                overlay.remove();
                clearAlarm();
            });
        } catch (e) {
            overlay.querySelector('#dismissAlarm').addEventListener('click', () => {
                overlay.remove();
                clearAlarm();
            });
        }
    }

    alarmSetBtn.addEventListener('click', () => {
        const val = alarmInput.value;
        if (val) setAlarm(val);
    });

    alarmClearBtn.addEventListener('click', clearAlarm);

    // -------- Fullscreen --------
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.body.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // -------- Update Background Based on Time --------
    function updateBgForTime(hours) {
        const root = document.documentElement;
        // Shift blob colors slightly based on time of day
        if (hours >= 6 && hours < 12) {
            // Morning — warm tones
            root.style.setProperty('--blob-1', isDark ? 'rgba(255, 160, 60, 0.12)' : 'rgba(255, 160, 60, 0.10)');
            root.style.setProperty('--blob-2', isDark ? 'rgba(255, 100, 100, 0.10)' : 'rgba(255, 100, 100, 0.08)');
        } else if (hours >= 12 && hours < 17) {
            // Afternoon — bright blues
            root.style.setProperty('--blob-1', isDark ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.12)');
            root.style.setProperty('--blob-2', isDark ? 'rgba(0, 200, 255, 0.12)' : 'rgba(0, 200, 255, 0.10)');
        } else if (hours >= 17 && hours < 21) {
            // Evening — purple/orange
            root.style.setProperty('--blob-1', isDark ? 'rgba(200, 80, 200, 0.14)' : 'rgba(200, 80, 200, 0.10)');
            root.style.setProperty('--blob-2', isDark ? 'rgba(255, 120, 50, 0.12)' : 'rgba(255, 120, 50, 0.08)');
        } else {
            // Night — deep blue/indigo
            root.style.setProperty('--blob-1', isDark ? 'rgba(30, 30, 180, 0.14)' : 'rgba(30, 30, 180, 0.08)');
            root.style.setProperty('--blob-2', isDark ? 'rgba(100, 50, 255, 0.12)' : 'rgba(100, 50, 255, 0.08)');
        }
    }

    // -------- Main Clock Update --------
    function updateClock() {
        const now = getNow();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Greeting
        greetingEl.textContent = getGreeting(hours);

        // Date
        dateEl.textContent = formatDate(now);

        // TZ label
        if (selectedTz !== 'local') {
            tzLabelEl.textContent = selectedTz.replace(/_/g, ' ');
        } else {
            tzLabelEl.textContent = '';
        }

        // AM/PM handling
        let ampmText = '';
        let displayHours = hours;
        if (!is24h) {
            ampmText = hours >= 12 ? 'PM' : 'AM';
            displayHours = hours % 12 || 12;
            ampmEl.textContent = ampmText;
            ampmEl.classList.remove('hidden');
        } else {
            ampmEl.classList.add('hidden');
        }

        const hStr = String(displayHours).padStart(2, '0');
        const mStr = String(minutes).padStart(2, '0');
        const sStr = String(seconds).padStart(2, '0');

        setDigit(digits.h1, hStr[0]);
        setDigit(digits.h2, hStr[1]);
        setDigit(digits.m1, mStr[0]);
        setDigit(digits.m2, mStr[1]);
        setDigit(digits.s1, sStr[0]);
        setDigit(digits.s2, sStr[1]);

        // Colon blink
        colon1.classList.add('blink');
        colon2.classList.add('blink');

        // Tick sound
        playTick();

        // Background shift
        updateBgForTime(hours);

        // Check alarm
        checkAlarm(now);
    }

    // -------- Init --------
    loadPrefs();
    updateClock();
    setInterval(updateClock, 1000);

})();
