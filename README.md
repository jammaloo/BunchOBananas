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

3. Add your Gemini API key and configure basic auth in the `.env` file:
```
GEMINI_API_KEY=your_actual_api_key_here
PORT=3000

# Basic Authentication (optional - leave empty to disable)
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=your_secure_password_here
```

**Note:** Basic auth is optional. If you don't set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD`, the app will run without authentication.

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

## Security

### Built-in Basic Authentication

The app includes built-in HTTP Basic Authentication. Simply set credentials in your `.env` file:

```bash
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=your_secure_password
```

When enabled, users will be prompted for username/password when accessing the app.

## Deployment

For production deployment:

### Option 1: PM2 Process Manager (Recommended)

PM2 keeps your app running, restarts it on crashes, and starts on system boot.

**Install PM2:**
```bash
npm install -g pm2
```

**Start the app:**
```bash
pm2 start ecosystem.config.cjs
```

**Useful PM2 commands:**
```bash
pm2 list                    # Show all running apps
pm2 logs image-transformer  # View logs
pm2 restart image-transformer  # Restart app
pm2 stop image-transformer     # Stop app
pm2 delete image-transformer   # Remove from PM2
pm2 monit                   # Monitor resources
```

**Start PM2 on system boot:**
```bash
pm2 startup
pm2 save
```

### Option 2: Direct Deployment (Simple)

1. Set up your `.env` file with API key and basic auth credentials
2. Run the Node.js server:
   ```bash
   npm start
   ```
3. The app is now protected with basic auth

### Option 3: With Nginx Reverse Proxy

If you want to use nginx for SSL/TLS or additional features:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

**Note:** Basic auth is now handled by the Express app, so you don't need nginx's `auth_basic` unless you want an additional layer.

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
