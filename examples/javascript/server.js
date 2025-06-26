import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 3001; // Backend runs on a different port than the frontend

// Middleware
app.use(cors()); // Allow requests from the Vite dev server
app.use(express.json()); // To parse JSON request bodies

// Check for required environment variables
if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
  console.error("Error: Make sure to create a .env file with your ImageKit credentials.");
  process.exit(1);
}

// Initialize ImageKit SDK
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// --- The Signing Route ---
app.post('/sign-url', (req, res) => {
  const { url: urlToSign } = req.body;

  if (!urlToSign) {
    return res.status(400).json({ error: 'URL to sign is required.' });
  }

  try {
    // We need to get the path from the full URL for the SDK's url method
    const urlObject = new URL(urlToSign);
    const path = urlObject.pathname;
    
    // Sign the URL with a 10-minute expiration
    const signedUrl = imagekit.url({
      path: path,
      signed: true,
      expireSeconds: 600,
    });
    
    res.json({ signedUrl });

  } catch (error) {
    console.error("Error signing URL:", error);
    res.status(500).json({ error: 'Failed to sign URL.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});