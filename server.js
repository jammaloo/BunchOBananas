import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure uploads and outputs directories exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('outputs')) {
  fs.mkdirSync('outputs');
}

// Helper function to save transformed image
function saveTransformedImage(imageData, originalName, filter, sessionTimestamp) {
  try {
    // sessionTimestamp is already in the correct format (e.g., "2025-12-23-14-30-45-123")
    const dateFolder = sessionTimestamp;

    // Create filter folder name (replace spaces with underscores)
    const filterFolder = filter.replace(/\s+/g, '_');

    // Create directory structure: outputs/{datetime}/{filter_name}/
    const outputDir = path.join('outputs', dateFolder, filterFolder);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename: remove extension from original name and add filter
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const filename = `${nameWithoutExt}-${filter.replace(/\s+/g, '_')}.png`;
    const outputPath = path.join(outputDir, filename);

    // Convert base64 to buffer and save
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);

    console.log(`Saved: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
}

// Transform image with Gemini (with retry logic)
async function transformImage(imagePath, style, maxRetries = 3, imageIndex = 0) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  // Determine mime type from file extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  const mimeType = mimeTypes[ext] || 'image/png';

  const prompt = [
    { text: `Convert this image into the style of ${style} art` },
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    },
  ];

  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });

      // Extract image data from response
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            console.log (`Processed image ${imageIndex}`)
          return part.inlineData.data; // Return base64 image data
        }
      }

      throw new Error('No image data in response');
    } catch (error) {
      console.error(`Error transforming image (attempt ${attempt}/${maxRetries}):`, error.message);

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// API endpoint to process images
app.post('/api/transform', upload.array('images', 20), async (req, res) => {
  try {
    const { filters } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    if (!filters) {
      return res.status(400).json({ error: 'No filters provided' });
    }

    const filterList = JSON.parse(filters);
    const results = [];

    // Generate timestamp for this session (format: YYYY-MM-DD-HH-MM-SS-mmm)
    const now = new Date();
    const sessionTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(now.getMilliseconds()).padStart(3, '0')}`;

    let imageIndex = 0;
    // Create all combinations of files and filters
    const tasks = [];
    for (const file of files) {
      for (const filter of filterList) {
          imageIndex++;
        tasks.push({
          file,
          filter,
          promise: transformImage(file.path, filter, 3, imageIndex)
            .then(imageData => ({ success: true, imageData }))
            .catch(error => ({ success: false, error: error.message }))
        });
      }
    }

    // Process all transformations in parallel
    const taskResults = await Promise.allSettled(tasks.map(task => task.promise));

    // Collect results
    tasks.forEach((task, index) => {
      const result = taskResults[index];

      if (result.status === 'fulfilled' && result.value.success) {
        const transformedImageData = result.value.imageData;

        // Save the transformed image to disk
        try {
          saveTransformedImage(transformedImageData, task.file.originalname, task.filter, sessionTimestamp);
        } catch (saveError) {
          console.error(`Error saving ${task.file.originalname} with ${task.filter}:`, saveError);
        }

        results.push({
          originalName: task.file.originalname,
          filter: task.filter,
          imageData: transformedImageData,
          mimeType: 'image/png'
        });
      } else {
        const errorMessage = result.status === 'fulfilled'
          ? result.value.error
          : result.reason?.message || 'Unknown error';

        console.error(`Error processing ${task.file.originalname} with ${task.filter}:`, errorMessage);
        results.push({
          originalName: task.file.originalname,
          filter: task.filter,
          error: errorMessage
        });
      }
    });

    // Clean up uploaded files
    files.forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    });

    res.json({
      results,
      timestamp: sessionTimestamp,
      galleryUrl: `/?timestamp=${sessionTimestamp}`
    });
  } catch (error) {
    console.error('Error in /api/transform:', error);
    res.status(500).json({ error: 'Failed to process images' });
  }
});

// Gallery endpoint - get images for a specific timestamp
app.get('/api/gallery/:timestamp', (req, res) => {
  try {
    const { timestamp } = req.params;
    const galleryPath = path.join('outputs', timestamp);

    // Check if directory exists
    if (!fs.existsSync(galleryPath)) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    // Read all filter directories
    const filterDirs = fs.readdirSync(galleryPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    // Build gallery structure
    const gallery = {
      timestamp,
      filters: {}
    };

    filterDirs.forEach(filterName => {
      const filterPath = path.join(galleryPath, filterName);
      const images = fs.readdirSync(filterPath)
        .filter(file => file.match(/\.(png|jpg|jpeg|webp)$/i))
        .map(filename => ({
          filename,
          url: `/api/gallery/${timestamp}/${filterName}/${filename}`
        }));

      gallery.filters[filterName] = images;
    });

    res.json(gallery);
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

// Serve individual gallery images
app.get('/api/gallery/:timestamp/:filter/:filename', (req, res) => {
  try {
    const { timestamp, filter, filename } = req.params;
    const imagePath = path.join('outputs', timestamp, filter, filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(path.resolve(imagePath));
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// List all available galleries
app.get('/api/galleries', (req, res) => {
  try {
    if (!fs.existsSync('outputs')) {
      return res.json({ galleries: [] });
    }

    const galleries = fs.readdirSync('outputs', { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        timestamp: dirent.name,
        url: `/?timestamp=${dirent.name}`
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Most recent first

    res.json({ galleries });
  } catch (error) {
    console.error('Error listing galleries:', error);
    res.status(500).json({ error: 'Failed to list galleries' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Make sure to set GEMINI_API_KEY in your environment');
});
