// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusMessage = document.getElementById('statusMessage');

// Helper function to capitalize column headers
function capitalizeHeader(header) {
    return header.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Helper function to check if date is within warning period and format it
function formatExpirationDate(dateStr) {
    if (!dateStr) return '';

    const today = new Date();
    const expirationDate = new Date(dateStr);

    // Get the date for the 15th of next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15);

    // Check if expiration is between now and the 15th of next month
    // AND in the current year
    const isExpiringSoon = expirationDate >= today &&
                          expirationDate <= nextMonth &&
                          expirationDate.getFullYear() === today.getFullYear();

    return isExpiringSoon ? `**${dateStr}` : dateStr;
}

// Process CSV data
function processCSV(data) {
    // Split into lines, filter out empty lines, and remove the description row
    let lines = data.split('\n')
        .filter(line => line.trim().length > 0);
    lines.splice(1, 1); // Remove description row

    // Process headers
    let headers = lines[0].split(',')
        .map(header => header.trim());
    headers = headers.map(header => capitalizeHeader(header));

    console.log('Found headers:', headers);

    // Determine report type based on presence of Status column
    const hasStatusColumn = headers.some(header =>
        header.toLowerCase() === 'status');

    // Generate output filename with today's date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const reportType = hasStatusColumn ? "Expired Membership Report" : "Membership Report";
    const outputFileName = `${reportType} - ${dateStr}.csv`;

    console.log(`Generating ${reportType}...`);

    // Create column order based on report type
    const columnOrder = hasStatusColumn ?
        [
            'Last Name',
            'First Name',
            'Status',
            'Expiration Date'
        ] :
        [
            'Last Name',
            'First Name',
            'Membership Type',
            'Expiration Date'
        ];

    // Create header mapping with case-insensitive matching
    const headerMap = {};
    headers.forEach((header, index) => {
        if (header.toLowerCase().includes('expiration') ||
            header.toLowerCase().includes('expires')) {
            headerMap['Expiration Date'] = index;
        } else if (header.toLowerCase() === 'status') {
            headerMap['Status'] = index;
        } else {
            headerMap[header] = index;
        }
    });

    console.log('Header mapping:', headerMap);

    // Process and sort data rows
    const processedLines = lines.slice(1)
        .map(line => {
            const values = line.split(',').map(val => val.trim());
            return {
                lastName: values[headerMap['Last Name']] || '',
                data: columnOrder.map(column => {
                    if (column === 'Expiration Date') {
                        return formatExpirationDate(values[headerMap[column]]);
                    }
                    return values[headerMap[column]] || '';
                }).join(',')
            };
        })
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map(row => row.data);

    // Create output content
    const outputContent = [columnOrder.join(','), ...processedLines].join('\n');

    return {
        content: outputContent,
        fileName: outputFileName,
        reportType: reportType
    };
}

// Download the processed file
function downloadFile(content, fileName) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// Show status message
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message show ${isError ? 'error' : 'success'}`;
    dropZone.className = `drop-zone ${isError ? 'error' : 'success'}`;

    // Reset after 5 seconds
    setTimeout(() => {
        statusMessage.className = 'status-message';
        dropZone.className = 'drop-zone';
    }, 5000);
}

// Handle file processing
function handleFile(file) {
    if (!file.name.endsWith('.csv')) {
        showStatus('Please select a CSV file.', true);
        return;
    }

    dropZone.className = 'drop-zone processing';

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const result = processCSV(e.target.result);
            downloadFile(result.content, result.fileName);
            showStatus(`Successfully created: ${result.fileName}`);
        } catch (error) {
            console.error('Error processing file:', error);
            showStatus(`Error processing file: ${error.message}`, true);
        }
    };

    reader.onerror = function() {
        showStatus('Error reading file.', true);
    };

    reader.readAsText(file);
}

// Event Listeners

// Click to select file
dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
        fileInput.value = ''; // Reset for next selection
    }
});

// Drag and drop events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.className = 'drop-zone drag-over';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.className = 'drop-zone';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.className = 'drop-zone';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Prevent default drag behavior on window
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
