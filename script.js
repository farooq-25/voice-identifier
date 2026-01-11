// =====================================
// GLOBAL VARIABLES
// =====================================

let audioContext;
let analyser;
let microphone;
let mediaStream;

let person1Data = null;
let person2Data = null;

// =====================================
// INITIALIZE AUDIO
// =====================================

async function initAudio() {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    microphone = audioContext.createMediaStreamSource(mediaStream);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    microphone.connect(analyser);
}
//
// =====================================
// CAPTURE AVERAGED VOICE SAMPLE
// =====================================

function captureAverageSample(durationMs = 3000) {
    return new Promise(resolve => {
        const bufferLength = analyser.frequencyBinCount;
        const tempData = new Uint8Array(bufferLength);
        const frames = [];

        const interval = setInterval(() => {
            analyser.getByteFrequencyData(tempData);
            frames.push([...tempData]);
        }, 100);

        setTimeout(() => {
            clearInterval(interval);

            const avg = new Array(bufferLength).fill(0);

            frames.forEach(frame => {
                frame.forEach((value, i) => {
                    avg[i] += value;
                });
            });

            for (let i = 0; i < avg.length; i++) {
                avg[i] /= frames.length;
            }

            resolve(normalizeAndFilter(avg));
        }, durationMs);
    });
}

// =====================================
// NORMALIZE + FILTER VOICE RANGE
// =====================================

function normalizeAndFilter(data) {
    const filtered = [];
    const minIndex = 10;   // ignore very low noise
    const maxIndex = 200;  // ignore high-frequency noise

    let max = 0;

    for (let i = minIndex; i < maxIndex; i++) {
        if (data[i] > max) max = data[i];
    }

    for (let i = minIndex; i < maxIndex; i++) {
        filtered.push(max === 0 ? 0 : data[i] / max);
    }

    return filtered;
}

// =====================================
// RECORD PERSON
// =====================================

async function recordPerson(person) {
    const status = document.getElementById("status");
    status.innerText = `Status: Recording Person ${person}...`;

    if (!audioContext) {
        await initAudio();
    }

    const avgSample = await captureAverageSample();

    if (person === 1) {
        person1Data = avgSample;
        status.innerText = "Status: Person 1 voice recorded";
    } else {
        person2Data = avgSample;
        status.innerText = "Status: Person 2 voice recorded";
    }
}

// =====================================
// IDENTIFY VOICE
// =====================================

async function identifyVoice() {
    const status = document.getElementById("status");

    if (!person1Data || !person2Data) {
        status.innerText = "Status: Please record both voices first";
        return;
    }

    status.innerText = "Status: Listening...";

    if (!audioContext) {
        await initAudio();
    }

    const testSample = await captureAverageSample();

    const diff1 = calculateDistance(testSample, person1Data);
    const diff2 = calculateDistance(testSample, person2Data);

    const confidence = calculateConfidence(diff1, diff2);

    if (diff1 < diff2) {
        status.innerText = `✅ Identified: Person 1 (${confidence}%)`;
    } else {
        status.innerText = `✅ Identified: Person 2 (${confidence}%)`;
    }
}

// =====================================
// DISTANCE CALCULATION (EUCLIDEAN)
// =====================================

function calculateDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
}

// =====================================
// CONFIDENCE CALCULATION
// =====================================

function calculateConfidence(d1, d2) {
    const total = d1 + d2;
    if (total === 0) return 50;

    const diff = Math.abs(d1 - d2);
    return Math.min(95, Math.round((diff / total) * 100));
}
//
//
//