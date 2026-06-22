// State management
let state = {
    file: null,
    question: '',
    promptType: 'default',
    isLoading: false,
    validationErrors: []
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const questionInput = document.getElementById('questionInput');
const promptTypeSelect = document.getElementById('promptType');
const submitBtn = document.getElementById('submitBtn');
const resultsSection = document.getElementById('resultsSection');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultsContent = document.getElementById('resultsContent');
const errorBox = document.getElementById('errorBox');
const answerBox = document.getElementById('answerBox');
const modelInfo = document.getElementById('modelInfo');
const responseTime = document.getElementById('responseTime');
const resetBtn = document.getElementById('resetBtn');
const uploadBox = document.querySelector('.upload-box');
const statusBadge = document.getElementById('status');

// Validation message container
let validationContainer = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkBackendConnection();
    setupEventListeners();
    createValidationContainer();
});

// Create validation message container
function createValidationContainer() {
    validationContainer = document.createElement('div');
    validationContainer.id = 'validationMessages';
    validationContainer.className = 'validation-messages';
    questionInput.parentElement.insertBefore(validationContainer, questionInput);
}

// Setup event listeners
function setupEventListeners() {
    // File upload
    fileInput.addEventListener('change', handleFileSelect);
    uploadBox.addEventListener('dragover', handleDragOver);
    uploadBox.addEventListener('dragleave', handleDragLeave);
    uploadBox.addEventListener('drop', handleFileDrop);

    // Question input
    questionInput.addEventListener('input', (e) => {
        state.question = e.target.value;
        validateForm();
        updateValidationMessages();
    });

    // Prompt type change
    promptTypeSelect.addEventListener('change', (e) => {
        state.promptType = e.target.value;
    });

    // Submit button
    submitBtn.addEventListener('click', handleSubmit);

    // Reset button
    resetBtn.addEventListener('click', resetForm);
}

// Check backend connection
async function checkBackendConnection() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            statusBadge.textContent = '✓ Connected';
            statusBadge.className = 'status-badge status-ok';
        } else {
            showConnectionError();
        }
    } catch (error) {
        showConnectionError();
    }
}

function showConnectionError() {
    statusBadge.textContent = '✗ Connection Failed';
    statusBadge.className = 'status-badge status-error';
    console.error('Cannot connect to backend');
}

// File handling
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        selectFile(files[0]);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        selectFile(files[0]);
    }
}

function selectFile(file) {
    // Validation
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/csv',
        'text/plain'
    ];

    const maxSize = 10 * 1024 * 1024; // 10 MB

    if (!allowedTypes.includes(file.type)) {
        showError(`❌ Invalid file type. Allowed: PDF, DOCX, CSV, TXT`);
        fileInput.value = '';
        return;
    }

    if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        showError(`❌ File too large (${sizeMB}MB). Maximum: 10 MB`);
        fileInput.value = '';
        return;
    }

    state.file = file;
    displayFileName(file.name, file.size);
    enableQuestion();
    validateForm();
    updateValidationMessages();
}

function displayFileName(name, size) {
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    fileName.textContent = `📎 ${name} (${sizeMB}MB)`;
    fileName.classList.add('show');
}

function enableQuestion() {
    questionInput.disabled = false;
    promptTypeSelect.disabled = false;
    questionInput.focus();
}

// Form validation
function validateForm() {
    state.validationErrors = [];

    if (!state.file) {
        state.validationErrors.push('📁 Please upload a document');
    } else {
        // Validate file was selected correctly
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/csv',
            'text/plain'
        ];
        if (!validTypes.includes(state.file.type)) {
            state.validationErrors.push('📁 Invalid file format');
        }
    }

    if (!state.question.trim()) {
        state.validationErrors.push('❓ Please enter a question');
    } else if (state.question.trim().length < 3) {
        state.validationErrors.push('❓ Question must be at least 3 characters');
    } else if (state.question.trim().length > 500) {
        state.validationErrors.push('❓ Question must not exceed 500 characters');
    }

    const isValid = state.validationErrors.length === 0;
    submitBtn.disabled = !isValid;
    return isValid;
}

function updateValidationMessages() {
    if (!validationContainer) return;
    
    validationContainer.innerHTML = '';
    
    if (state.validationErrors.length > 0) {
        state.validationErrors.forEach(error => {
            const msg = document.createElement('div');
            msg.className = 'validation-message';
            msg.textContent = error;
            validationContainer.appendChild(msg);
        });
        validationContainer.style.display = 'block';
    } else {
        validationContainer.style.display = 'none';
    }
}

// Submit
async function handleSubmit() {
    if (!validateForm()) {
        updateValidationMessages();
        return;
    }

    const formData = new FormData();
    formData.append('file', state.file);
    formData.append('question', state.question);
    formData.append('promptType', state.promptType);

    showLoading();

    try {
        const startTime = performance.now();

        // Call the real backend endpoint (Phase 7)
        const response = await fetch('/search/document', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to process document');
        }

        const endTime = performance.now();

        displayResults({
            answer: data.answer || 'No answer received',
            model: `${data.metadata.model} (${data.metadata.provider})`,
            responseTime: data.metadata.processingTime
        });
    } catch (error) {
        showError(`❌ Error: ${error.message}`);
    } finally {
        state.isLoading = false;
    }
}

// Display results
function displayResults(data) {
    answerBox.textContent = data.answer;
    modelInfo.textContent = data.model;
    responseTime.textContent = data.responseTime;

    loadingSpinner.style.display = 'none';
    resultsContent.style.display = 'block';
}

// Show loading
function showLoading() {
    resultsSection.style.display = 'block';
    loadingSpinner.style.display = 'flex';
    resultsContent.style.display = 'none';
    errorBox.style.display = 'none';

    submitBtn.disabled = true;
    questionInput.disabled = true;
    promptTypeSelect.disabled = true;
}

// Show error
function showError(message) {
    resultsSection.style.display = 'block';
    errorBox.textContent = message;
    errorBox.style.display = 'block';
    loadingSpinner.style.display = 'none';
    resultsContent.style.display = 'none';
    
    // Scroll to error
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Reset form
function resetForm() {
    state = {
        file: null,
        question: '',
        promptType: 'default',
        isLoading: false
    };

    fileInput.value = '';
    fileName.textContent = '';
    fileName.classList.remove('show');
    questionInput.value = '';
    promptTypeSelect.value = 'default';
    resultsSection.style.display = 'none';
    loadingSpinner.style.display = 'none';
    resultsContent.style.display = 'none';
    errorBox.style.display = 'none';

    questionInput.disabled = true;
    promptTypeSelect.disabled = true;
    submitBtn.disabled = true;

    fileInput.focus();
}

console.log('✓ Frontend loaded successfully');
