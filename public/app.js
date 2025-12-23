// Default filters
const DEFAULT_FILTERS = [
  'Oil Painting',
  'Water colours',
  'Crayons',
  'Impressionism',
  'Renaissance',
  'Pop Art',
  'Baroque',
  'Romanticism',
  'Neoclassicism'
];

// State
let uploadedFiles = [];
let selectedFilters = new Set(DEFAULT_FILTERS);
let currentGalleryImages = [];
let currentImageIndex = -1;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const filtersList = document.getElementById('filtersList');
const newFilterInput = document.getElementById('newFilterInput');
const addFilterBtn = document.getElementById('addFilterBtn');
const submitBtn = document.getElementById('submitBtn');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const resultsSection = document.getElementById('resultsSection');
const results = document.getElementById('results');

// Check if we're in viewer mode
function getTimestampFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('timestamp');
}

// Initialize
function init() {
  const timestamp = getTimestampFromURL();

  if (timestamp) {
    // Viewer mode
    initViewerMode(timestamp);
    return;
  }

  // Normal upload mode
  renderFilters();
  updateSubmitButton();

  // Upload area click
  uploadArea.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );
    addFiles(files);
  });

  // Add filter
  addFilterBtn.addEventListener('click', addFilter);
  newFilterInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addFilter();
  });

  // Submit
  submitBtn.addEventListener('click', handleSubmit);
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  addFiles(files);
}

function addFiles(files) {
  uploadedFiles = [...uploadedFiles, ...files];
  renderFileList();
  updateSubmitButton();
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
  updateSubmitButton();
}

function renderFileList() {
  if (uploadedFiles.length === 0) {
    fileList.innerHTML = '';
    return;
  }

  fileList.innerHTML = uploadedFiles.map((file, index) => `
    <div class="file-item">
      <span>${file.name}</span>
      <button onclick="removeFile(${index})">Remove</button>
    </div>
  `).join('');
}

function renderFilters() {
  filtersList.innerHTML = Array.from(selectedFilters).map(filter => `
    <div class="filter-chip active">
      <span>${filter}</span>
      <button class="remove-btn" onclick="removeFilter('${filter}')">&times;</button>
    </div>
  `).join('');
}

function addFilter() {
  const filterName = newFilterInput.value.trim();
  if (filterName && !selectedFilters.has(filterName)) {
    selectedFilters.add(filterName);
    renderFilters();
    updateSubmitButton();
    newFilterInput.value = '';
  }
}

function removeFilter(filter) {
  selectedFilters.delete(filter);
  renderFilters();
  updateSubmitButton();
}

function updateSubmitButton() {
  submitBtn.disabled = uploadedFiles.length === 0 || selectedFilters.size === 0;
}

async function handleSubmit() {
  if (uploadedFiles.length === 0 || selectedFilters.size === 0) return;

  // Disable submit button
  submitBtn.disabled = true;
  progress.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  results.innerHTML = '';

  const totalOperations = uploadedFiles.length * selectedFilters.size;
  let completedOperations = 0;

  try {
    // Prepare form data
    const formData = new FormData();
    uploadedFiles.forEach(file => {
      formData.append('images', file);
    });
    formData.append('filters', JSON.stringify(Array.from(selectedFilters)));

    // Update progress
    progressText.textContent = `Processing ${totalOperations} transformations...`;

    // Send request
    const response = await fetch('/api/transform', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to process images');
    }

    const data = await response.json();

    // Complete progress
    progressBar.style.width = '100%';
    progressText.textContent = `Completed ${totalOperations} transformations!`;

    // Display results with gallery link
    displayResults(data.results, data.galleryUrl);

    // Reset form
    setTimeout(() => {
      progress.classList.add('hidden');
      progressBar.style.width = '0%';
      uploadedFiles = [];
      fileInput.value = '';
      renderFileList();
      updateSubmitButton();
    }, 2000);

  } catch (error) {
    console.error('Error:', error);
    progressText.textContent = `Error: ${error.message}`;
    progressBar.style.width = '0%';
    setTimeout(() => {
      progress.classList.add('hidden');
      submitBtn.disabled = false;
    }, 3000);
  }
}

function downloadImage(imageData, mimeType, originalName, filter) {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${imageData}`;

  // Generate filename: remove extension from original name and add filter and .png
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const filename = `${nameWithoutExt}-${filter.replace(/\s+/g, '_')}.png`;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadResultImage(url, originalName, filter) {
  const link = document.createElement('a');
  link.href = url;

  // Generate filename: remove extension from original name and add filter
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const filename = `${nameWithoutExt}-${filter.replace(/\s+/g, '_')}.png`;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function displayResults(resultsList, galleryUrl) {
  resultsSection.classList.remove('hidden');

  // Add gallery link at the top if provided
  let galleryLinkHTML = '';
  if (galleryUrl) {
    galleryLinkHTML = `
      <div class="gallery-link-banner">
        <p>View all images in the gallery:</p>
        <a href="${galleryUrl}" class="gallery-link-btn">Open Gallery View →</a>
      </div>
    `;
  }

  results.innerHTML = galleryLinkHTML + resultsList.map((result, index) => {
    if (result.error) {
      return `
        <div class="result-card">
          <div class="card-info">
            <div class="card-title">${result.originalName}</div>
            <div class="card-filter">${result.filter}</div>
            <div class="card-error">Error: ${result.error}</div>
          </div>
        </div>
      `;
    }

    const imageId = `result-img-${index}`;

    return `
      <div class="result-card">
        <img id="${imageId}"
             src="${result.thumbnailUrl}"
             alt="${result.originalName} - ${result.filter}"
             data-title="${result.originalName} - ${result.filter}"
             data-url="${result.url}"
             data-filename="${result.originalName}"
             data-filter="${result.filter}"
             title="Click to view larger"
             style="cursor: pointer;">
        <div class="card-info">
          <div class="card-title">${result.originalName}</div>
          <div class="card-filter">${result.filter}</div>
          <button class="download-btn" onclick="downloadResultImage('${result.url}', '${result.originalName}', '${result.filter}')">
            Download
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers to images
  resultsList.forEach((result, index) => {
    if (!result.error) {
      const imageId = `result-img-${index}`;
      const imgElement = document.getElementById(imageId);
      if (imgElement) {
        imgElement.addEventListener('click', function() {
          const url = this.dataset.url;
          const title = this.dataset.title;
          const originalName = this.dataset.filename;
          const filter = this.dataset.filter;

          openModal(url, title, () => {
            downloadResultImage(url, originalName, filter);
          });
        });
      }
    }
  });

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Viewer mode functions
async function initViewerMode(timestamp) {
  // Hide upload UI elements
  document.querySelector('.upload-section').style.display = 'none';
  document.querySelector('.filters-section').style.display = 'none';
  document.querySelector('.submit-section').style.display = 'none';

  // Update header
  const header = document.querySelector('header');
  header.innerHTML = `
    <h1>Image Gallery</h1>
    <p>Viewing gallery: ${timestamp}</p>
    <a href="/" style="color: white; text-decoration: underline; margin-top: 10px; display: inline-block;">← Back to Upload</a>
  `;

  // Show loading
  resultsSection.classList.remove('hidden');
  results.innerHTML = '<p style="text-align: center; padding: 40px; color: #667eea;">Loading gallery...</p>';

  try {
    // Fetch gallery data
    const response = await fetch(`/api/gallery/${timestamp}`);
    if (!response.ok) {
      throw new Error('Gallery not found');
    }

    const gallery = await response.json();
    displayGallery(gallery);
  } catch (error) {
    console.error('Error loading gallery:', error);
    results.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <p style="color: #ff4757; font-size: 1.2em; margin-bottom: 20px;">Error: ${error.message}</p>
        <a href="/" style="color: #667eea; text-decoration: underline;">← Back to Upload</a>
      </div>
    `;
  }
}

function displayGallery(gallery) {
  let galleryHTML = '';
  let imageCounter = 0;
  const imageData = [];

  // Group images by filter
  Object.keys(gallery.filters).forEach(filterName => {
    const images = gallery.filters[filterName];

    if (images.length > 0) {
      galleryHTML += `
        <div class="filter-section">
          <h3 class="filter-heading">${filterName.replace(/_/g, ' ')}</h3>
          <div class="gallery-grid">
            ${images.map(image => {
              const imageId = `gallery-img-${imageCounter}`;
              imageData.push({
                id: imageId,
                url: image.url,
                thumbnailUrl: image.thumbnailUrl,
                filename: image.filename,
                filter: filterName
              });
              imageCounter++;

              return `
                <div class="gallery-card">
                  <img id="${imageId}"
                       src="${image.thumbnailUrl}"
                       alt="${image.filename}"
                       data-url="${image.url}"
                       data-thumbnail="${image.thumbnailUrl}"
                       data-filename="${image.filename}"
                       data-filter="${filterName}"
                       title="Click to view larger"
                       style="cursor: pointer;">
                  <div class="gallery-info">
                    <div class="gallery-filename">${image.filename}</div>
                    <button class="download-btn" onclick="downloadGalleryImage('${image.url}', '${image.filename}')">
                      Download
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  });

  results.innerHTML = galleryHTML || '<p style="text-align: center; padding: 40px; color: #999;">No images found in this gallery.</p>';

  // Store images globally for navigation
  currentGalleryImages = imageData;

  // Add click handlers to gallery images
  imageData.forEach((data, index) => {
    const imgElement = document.getElementById(data.id);
    if (imgElement) {
      imgElement.addEventListener('click', function() {
        const url = this.dataset.url;
        const filename = this.dataset.filename;
        const filter = this.dataset.filter;
        const title = `${filename} - ${filter.replace(/_/g, ' ')}`;

        openModalWithNavigation(url, title, () => {
          downloadGalleryImage(url, filename);
        }, index, currentGalleryImages);
      });
    }
  });
}

function downloadGalleryImage(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Modal functions
function openModal(imageSrc, title, downloadCallback) {
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalOverlay = modal.querySelector('.modal-overlay');

  modalImage.src = imageSrc;
  modalTitle.textContent = title;

  // Update download button handler
  modalDownloadBtn.onclick = downloadCallback;

  // Show modal
  modal.classList.remove('hidden');

  // Close on overlay click
  modalOverlay.onclick = closeModal;

  // Close on Escape key
  document.addEventListener('keydown', handleEscapeKey);
}

function closeModal() {
  const modal = document.getElementById('imageModal');
  modal.classList.add('hidden');
  document.removeEventListener('keydown', handleEscapeKey);
  document.removeEventListener('keydown', handleNavigationKeys);
  currentImageIndex = -1;
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeModal();
  }
}

// Modal with navigation support
function openModalWithNavigation(imageSrc, title, downloadCallback, index, images) {
  currentImageIndex = index;

  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalOverlay = modal.querySelector('.modal-overlay');

  modalImage.src = imageSrc;
  modalTitle.textContent = title;

  // Update download button handler
  modalDownloadBtn.onclick = downloadCallback;

  // Show modal
  modal.classList.remove('hidden');

  // Close on overlay click
  modalOverlay.onclick = closeModal;

  // Add keyboard navigation
  document.removeEventListener('keydown', handleEscapeKey);
  document.addEventListener('keydown', handleNavigationKeys);
}

function handleNavigationKeys(e) {
  if (e.key === 'Escape') {
    closeModal();
  } else if (e.key === 'ArrowLeft') {
    navigateToPrevious();
  } else if (e.key === 'ArrowRight') {
    navigateToNext();
  }
}

function navigateToPrevious() {
  if (currentImageIndex > 0 && currentGalleryImages.length > 0) {
    currentImageIndex--;
    const image = currentGalleryImages[currentImageIndex];
    updateModalImage(image);
  }
}

function navigateToNext() {
  if (currentImageIndex < currentGalleryImages.length - 1 && currentGalleryImages.length > 0) {
    currentImageIndex++;
    const image = currentGalleryImages[currentImageIndex];
    updateModalImage(image);
  }
}

function updateModalImage(image) {
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');

  const title = `${image.filename} - ${image.filter.replace(/_/g, ' ')}`;

  modalImage.src = image.url;
  modalTitle.textContent = title;
  modalDownloadBtn.onclick = () => {
    downloadGalleryImage(image.url, image.filename);
  };
}

// Make functions global for inline event handlers
window.removeFile = removeFile;
window.removeFilter = removeFilter;
window.downloadImage = downloadImage;
window.downloadResultImage = downloadResultImage;
window.downloadGalleryImage = downloadGalleryImage;
window.openModal = openModal;
window.closeModal = closeModal;

// Initialize app
init();
