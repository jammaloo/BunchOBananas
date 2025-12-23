import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Transform image with custom prompt
async function transformImageCLI(imagePath, promptText, maxRetries = 3) {
  // Check if image exists
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

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
    { text: promptText },
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
      console.log(`Processing image (attempt ${attempt}/${maxRetries})...`);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
      });

      // Extract image data from response
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return part.inlineData.data; // Return base64 image data
        }
      }

      throw new Error('No image data in response');
    } catch (error) {
      console.error(`Error (attempt ${attempt}/${maxRetries}):`, error.message);

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying (exponential backoff: 1s, 2s)
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Main CLI function
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: pnpm run transform <image-path> <prompt>');
    console.error('Example: pnpm run transform photo.jpg "Remove the girl in the background"');
    process.exit(1);
  }

  const imagePath = args[0];
  const promptText = args[1];

  console.log('Image Style Transformer CLI');
  console.log('===========================');
  console.log(`Image: ${imagePath}`);
  console.log(`Prompt: ${promptText}`);
  console.log('');

  try {
    // Transform the image
    const transformedImageData = await transformImageCLI(imagePath, promptText);

    // Generate output filename
    const parsedPath = path.parse(imagePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = `${parsedPath.name}-transformed-${timestamp}.png`;
    const outputPath = path.join(parsedPath.dir || '.', outputFilename);

    // Save the transformed image
    const buffer = Buffer.from(transformedImageData, 'base64');
    fs.writeFileSync(outputPath, buffer);

    console.log('');
    console.log(`✓ Success! Image saved to: ${outputPath}`);
  } catch (error) {
    console.error('');
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the CLI
main();
