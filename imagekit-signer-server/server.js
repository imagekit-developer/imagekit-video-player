import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow CORS requests
app.use(express.json()); // To parse JSON request bodies (for POST if needed)

// Check for required environment variables
if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
  console.error("Error: Make sure to create a .env file with your ImageKit credentials.");
  console.error("Required variables: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT");
  process.exit(1);
}

// Initialize ImageKit SDK
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// --- The Signing Route (POST) ---
// This endpoint accepts a URL in the request body and returns the signed URL as plain text
app.post('/sign-url', (req, res) => {
  // Get the URL from request body
  const { url: urlToSign } = req.body;

  if (!urlToSign) {
    return res.status(400).send('URL is required in request body. Usage: POST /sign-url with body: { "url": "<url_to_sign>" }');
  }

  try {
    // Note: Express automatically decodes query parameters, so urlToSign is already decoded
    // Parse the URL to separate base URL from query parameters
    const urlObject = new URL(urlToSign);
    
    // Get URL without query parameters
    const urlWithoutQuery = `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}`;
    
    // Extract query parameters separately
    // searchParams automatically decodes values, which is what we want
    const queryParams = {};
    urlObject.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    
    // Sign the URL with expiration (default 10 minutes, configurable via env)
    // const expireSeconds = parseInt(process.env.IMAGEKIT_EXPIRE_SECONDS || '600', 10);
    const signedUrl = imagekit.url({
      src: urlWithoutQuery,
      signed: true,
    //   expireSeconds: expireSeconds,
      queryParameters: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
    
    // Return the signed URL as plain text (not JSON)
    res.setHeader('Content-Type', 'text/plain');
    res.send(signedUrl);

  } catch (error) {
    console.error("Error signing URL:", error);
    res.status(500).send(`Failed to sign URL: ${error.message}`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'imagekit-signer-server' });
});

app.listen(port, () => {
  console.log(`ImageKit Signer Server listening on http://localhost:${port}`);
  console.log(`Sign URL endpoint: POST http://localhost:${port}/sign-url`);
  console.log(`Request body: { "url": "<url_to_sign>" }`);
});

