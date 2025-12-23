# Image Style Transformer

A simple web application that transforms your images into different art styles using Google's Gemini AI.

## Features

- Bulk upload images (up to 20 at once)
- Pre-configured art style filters: Oil Painting, Water colours, Crayons, Impressionism, Renaissance, Pop Art
- Add or remove custom filters
- Process images with multiple filters simultaneously
- View all transformed images in a responsive grid

## Setup

### Prerequisites

- Node.js (v18 or higher)
- Google Gemini API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

3. Add your Gemini API key to the `.env` file:
```
GEMINI_API_KEY=your_actual_api_key_here
PORT=3000
```

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into your `.env` file

## Usage

### Development

Run the server in development mode (with auto-reload):
```bash
npm run dev
```

### Production

Run the server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## How to Use

### Web Interface

1. Open the web app in your browser
2. Upload one or more images (PNG, JPG, or WEBP)
3. Select which filters you want to apply (default filters are pre-selected)
4. Add custom filters if desired
5. Click "Transform Images"
6. Wait for processing to complete
7. View and download your transformed images

### CLI (Command Line)

Transform a single image with a custom prompt:

```bash
pnpm run transform <image-path> "<prompt>"
```

**Examples:**

```bash
# Remove something from an image
pnpm run transform photo.jpg "Remove the girl in the background"

# Apply a specific style
pnpm run transform landscape.png "Convert this image into the style of Baroque art"

# Make creative edits
pnpm run transform selfie.jpg "Add a sunset in the background"
```

**Output:**
- The transformed image is saved in the same directory as the input
- Filename format: `original-name-transformed-TIMESTAMP.png`
- Example: `photo-transformed-2025-12-23T15-30-45-123Z.png`

**Features:**
- Automatic retry (up to 3 attempts) on API failures
- Works with PNG, JPG, JPEG, and WEBP images
- Custom prompts for any kind of transformation
- Progress logging during processing

## Deployment

For production deployment with nginx and basic auth:

1. Build and run the Node.js server
2. Configure nginx as a reverse proxy
3. Add basic auth in nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Create password file:
```bash
sudo htpasswd -c /etc/nginx/.htpasswd username
```

## API Endpoints

### POST /api/transform

Transforms uploaded images with specified filters.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `images`: Array of image files
  - `filters`: JSON array of filter names

**Response:**
```json
{
  "results": [
    {
      "originalName": "photo.jpg",
      "filter": "Oil Painting",
      "imageData": "base64_encoded_image_data",
      "mimeType": "image/png"
    }
  ]
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Notes

- Images are temporarily stored in the `uploads/` directory during processing and deleted afterward
- Maximum file size: 10MB per image
- Maximum number of images per request: 20
- Processing time depends on the number of images and filters selected
- Generated images are returned as base64-encoded PNG data

## License

ISC
