# ImageKit Signer Server

A standalone Node.js server for signing ImageKit URLs. This server provides an endpoint that accepts a URL and returns a signed URL using the ImageKit Node.js SDK.

## Features

- POST endpoint for signing URLs
- Returns signed URLs as plain text (compatible with video player signer function)
- Configurable URL expiration time
- CORS enabled for cross-origin requests
- Environment-based configuration

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your ImageKit credentials:
   ```
   IMAGEKIT_PUBLIC_KEY=your_public_key
   IMAGEKIT_PRIVATE_KEY=your_private_key
   IMAGEKIT_URL_ENDPOINT=ik.imagekit.io
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Usage

### Endpoint

**POST** `/sign-url`

### Example

```bash
curl -X POST http://localhost:3001/sign-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ik.imagekit.io/your-endpoint/path/to/video.mp4"}'
```

The server will return the signed URL as plain text.

### Integration with Video Player

Use this endpoint URL in your video player configuration:

```javascript
const player = videoPlayer('player', {
  imagekitId: 'your_imagekit_id',
  signerFn: async (url: string) => {
    const response = await fetch('http://localhost:3001/sign-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      throw new Error(`Signer function failed: ${response.status}`);
    }
    return (await response.text()).trim();
  }
});
```

## Configuration

### Environment Variables

- `IMAGEKIT_PUBLIC_KEY` (required): Your ImageKit public key
- `IMAGEKIT_PRIVATE_KEY` (required): Your ImageKit private key
- `IMAGEKIT_URL_ENDPOINT` (required): Your ImageKit URL endpoint (e.g., `ik.imagekit.io`)
- `PORT` (optional): Server port (default: `3001`)
- `IMAGEKIT_EXPIRE_SECONDS` (optional): URL expiration time in seconds (default: `600` = 10 minutes)

## API Endpoints

### POST `/sign-url`
Signs an ImageKit URL.

**Request Body:**
```json
{
  "url": "https://ik.imagekit.io/your-endpoint/path/to/video.mp4"
}
```

**Response:**
- Success: Plain text signed URL
- Error: Error message as plain text

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "imagekit-signer-server"
}
```

## License

ISC

