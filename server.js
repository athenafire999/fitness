const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range']
}));
app.use(express.json());

// Serve static files with explicit CORS headers for audio
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        // Set CORS headers for audio files
        if (filePath.endsWith('.mp3') || filePath.endsWith('.wav') || filePath.endsWith('.ogg')) {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        }
    }
}));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Google Cloud TTS API endpoint
app.post('/api/tts/synthesize', async (req, res) => {
    try {
        const { 
            text, 
            voice = "en-GB-Wavenet-A", 
            gender = "FEMALE", 
            speakingRate = 0.95, 
            pitch = 0 
        } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        // Your Google Cloud TTS API key
        const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || "AIzaSyCrGozdiMxIyws1G_G0R2OezCbU-o1F56Y";

        // Process text for better TTS pronunciation
        let processedText = text;
        processedText = processedText.replace(/(\d+) reps/g, "$1 repetitions");
        processedText = processedText.replace(/(\d+) rep\b/g, "$1 repetition");
        processedText = processedText.replace(/Coming up next/g, "Coming up next,");
        processedText = processedText.replace(/Great job/g, "Great job!");
        processedText = processedText.replace(/Amazing work/g, "Amazing work!");
        processedText = processedText.replace(/Excellent/g, "Excellent!");
        processedText = processedText.replace(/Fantastic/g, "Fantastic!");
        processedText = processedText.replace(/Outstanding/g, "Outstanding!");

        const requestBody = {
            input: { text: processedText },
            voice: {
                languageCode: voice.startsWith("en-GB") ? "en-GB" : "en-US",
                name: voice,
                ssmlGender: gender
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate,
                pitch,
                volumeGainDb: 2
            }
        };

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google TTS API error:", errorText);
            return res.status(response.status).json({ error: "TTS synthesis failed" });
        }

        const data = await response.json();
        
        res.set({
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type"
        });

        res.json({
            audioContent: data.audioContent,
            mimeType: "audio/mp3"
        });

    } catch (error) {
        console.error("TTS synthesis error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Health check endpoint
app.get('/api/healthcheck', (req, res) => {
    res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Workout Generator Server running on port ${PORT}`);
    console.log(`📢 TTS API endpoint: /api/tts/synthesize`);
});

