// Reimbursement Request Generator
// Builds a cover "form" page from the inputs, then merges all attached
// images and PDFs into a single downloadable PDF. 100% client-side.

// pdf-lib is loaded from a CDN. If that request fails, PDFLib is undefined;
// guard the destructure so the rest of the script still parses and we can
// show a clear message instead of a silently dead button.
const pdfLibReady = typeof PDFLib !== 'undefined';
const { PDFDocument, StandardFonts, rgb } = pdfLibReady ? PDFLib : {};

// --- DOM ---
const form = document.getElementById('reimbForm');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');
const statusMessage = document.getElementById('statusMessage');
const generateBtn = document.getElementById('generateBtn');
const budgetRadios = document.querySelectorAll('input[name="budget"]');
const mailRadios = document.querySelectorAll('input[name="mailed"]');
const otherAccountWrap = document.getElementById('otherAccountWrap');
const mailWrap = document.getElementById('mailWrap');

// Attached files held in order. Each entry: { id, file }.
let attachments = [];
let nextId = 1;

// Default the date field to today.
document.getElementById('date').valueAsDate = new Date();

// If the PDF library didn't load, disable generation and explain why.
if (!pdfLibReady) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'PDF library unavailable';
    showStatus('error', 'The PDF library (pdf-lib) could not be loaded. Check your internet connection and reload the page. If the problem continues, the CDN may be temporarily unavailable.');
}

// --- Conditional fields ---
budgetRadios.forEach(r => r.addEventListener('change', () => {
    const isOther = document.querySelector('input[name="budget"]:checked')?.value === 'Other';
    otherAccountWrap.classList.toggle('hidden', !isOther);
}));

mailRadios.forEach(r => r.addEventListener('change', () => {
    const isYes = document.querySelector('input[name="mailed"]:checked')?.value === 'Yes';
    mailWrap.classList.toggle('hidden', !isYes);
}));

// --- File drop handling ---
dropZone.addEventListener('click', () => fileInput.click());

// Keyboard support: Enter or Space opens the file picker.
dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        fileInput.click();
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

['dragleave', 'dragend'].forEach(evt =>
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'))
);

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = ''; // allow re-adding the same file
});

// Soft warning threshold for combined attachment size (bytes).
const TOTAL_SIZE_WARN = 40 * 1024 * 1024; // 40 MB

function isDuplicate(file) {
    return attachments.some(a =>
        a.file.name === file.name &&
        a.file.size === file.size &&
        a.file.lastModified === file.lastModified
    );
}

function addFiles(fileList) {
    const unsupported = [];
    const duplicates = [];
    let addedCount = 0;

    for (const file of fileList) {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|heic|heif)$/i.test(file.name);
        if (!isPdf && !isImg) {
            unsupported.push(file.name);
            continue;
        }
        if (isDuplicate(file)) {
            duplicates.push(file.name);
            continue;
        }
        attachments.push({ id: nextId++, file });
        addedCount++;
    }
    renderFileList();

    // Report anything that was skipped.
    const notes = [];
    if (unsupported.length) notes.push(`Skipped (not an image or PDF): ${unsupported.join(', ')}`);
    if (duplicates.length) notes.push(`Skipped (already added): ${duplicates.join(', ')}`);

    const totalSize = attachments.reduce((sum, a) => sum + a.file.size, 0);
    if (totalSize > TOTAL_SIZE_WARN) {
        notes.push(`Attachments total ${formatSize(totalSize)} — generating may take a moment.`);
    }

    if (notes.length) {
        // Error style only if something was actually rejected; otherwise informational.
        const type = (unsupported.length || duplicates.length) ? 'error' : 'info';
        showStatus(type, 'Note:', notes);
    } else {
        clearStatus();
    }

    // Keep the newly added files (and the generate button) in view.
    if (addedCount) {
        generateBtn.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function renderFileList() {
    fileListEl.innerHTML = '';
    attachments.forEach(({ id, file }) => {
        const li = document.createElement('li');

        const info = document.createElement('div');
        info.className = 'fname';
        info.textContent = file.name;

        const meta = document.createElement('span');
        meta.className = 'fmeta';
        meta.textContent = formatSize(file.size);

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;';
        left.appendChild(info);
        left.appendChild(meta);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove';
        remove.textContent = '×';
        remove.title = 'Remove';
        remove.addEventListener('click', () => {
            attachments = attachments.filter(a => a.id !== id);
            renderFileList();
        });

        li.appendChild(left);
        li.appendChild(remove);
        fileListEl.appendChild(li);
    });
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// --- Status helpers ---
function showStatus(type, message, listItems) {
    statusMessage.className = 'status-message show ' + type;
    statusMessage.innerHTML = '';
    const p = document.createElement('div');
    p.textContent = message;
    statusMessage.appendChild(p);
    if (listItems && listItems.length) {
        const ul = document.createElement('ul');
        listItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            ul.appendChild(li);
        });
        statusMessage.appendChild(ul);
    }
    statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearStatus() {
    statusMessage.className = 'status-message';
    statusMessage.innerHTML = '';
}

// --- Form values ---
function collectForm() {
    const budget = document.querySelector('input[name="budget"]:checked')?.value || '';
    const otherAccount = document.getElementById('otherAccount').value.trim();
    const mailed = document.querySelector('input[name="mailed"]:checked')?.value || 'No';
    return {
        requestedBy: document.getElementById('requestedBy').value.trim(),
        date: document.getElementById('date').value,
        amount: document.getElementById('amount').value,
        budget,
        budgetLabel: budget === 'Other' && otherAccount ? `Other — ${otherAccount}` : budget,
        checkTo: document.getElementById('checkTo').value.trim(),
        checkMemo: document.getElementById('checkMemo').value.trim(),
        mailed,
        mailAddress: document.getElementById('mailAddress').value.trim(),
    };
}

function validate(d) {
    const errors = [];
    if (!d.requestedBy) errors.push('Requested By is required.');
    if (!d.date) errors.push('Date is required.');
    if (d.amount === '' || isNaN(parseFloat(d.amount)) || parseFloat(d.amount) <= 0)
        errors.push('Amount must be greater than zero.');
    if (!d.budget) errors.push('A Budget Account must be selected.');
    if (d.budget === 'Other' && !document.getElementById('otherAccount').value.trim())
        errors.push('Please specify the "Other" budget account.');
    if (!d.checkTo) errors.push('Check Made Out To is required.');
    if (d.mailed === 'Yes' && !d.mailAddress)
        errors.push('Name and Address is required when the check is mailed.');
    return errors;
}

function formatCurrency(amount) {
    const n = parseFloat(amount);
    if (isNaN(n)) return amount;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoDate) {
    if (!isoDate) return '';
    // isoDate is YYYY-MM-DD; build a local date to avoid TZ shift.
    const [y, m, day] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// --- PDF generation ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pdfLibReady) {
        showStatus('error', 'The PDF library (pdf-lib) could not be loaded. Please reload the page and try again.');
        return;
    }
    clearStatus();

    const data = collectForm();
    const errors = validate(data);
    if (errors.length) {
        showStatus('error', 'Please fix the following:', errors);
        return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    showStatus('info', 'Building your PDF…');

    const skipped = [];
    try {
        const pdfDoc = await PDFDocument.create();
        await drawCoverPage(pdfDoc, data);

        for (const { file } of attachments) {
            try {
                await appendAttachment(pdfDoc, file);
            } catch (err) {
                console.error('Attachment failed:', file.name, err);
                skipped.push(`${file.name} — ${err.message || 'could not be added'}`);
            }
        }

        const pdfBytes = await pdfDoc.save();
        downloadPdf(pdfBytes, makeFileName(data));

        if (skipped.length) {
            showStatus('error', 'PDF downloaded, but some attachments were skipped:', skipped);
        } else {
            showStatus('success', 'Done! Your reimbursement PDF has been downloaded.');
        }
    } catch (err) {
        console.error(err);
        showStatus('error', 'Something went wrong generating the PDF: ' + (err.message || err));
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Reimbursement PDF';
    }
});

// Fetch + embed the logo once per document. Returns null if it can't load
// (e.g. opened via file://), so the PDF still generates without it.
let logoBytesCache = null;
async function loadLogo(pdfDoc) {
    try {
        if (!logoBytesCache) {
            const resp = await fetch('logo.png');
            if (!resp.ok) throw new Error('logo fetch failed');
            logoBytesCache = await resp.arrayBuffer();
        }
        return await pdfDoc.embedPng(logoBytesCache);
    } catch (err) {
        console.warn('Logo not embedded:', err);
        return null;
    }
}

async function drawCoverPage(pdfDoc, d) {
    const page = pdfDoc.addPage([612, 792]); // US Letter
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 54;
    const contentW = width - margin * 2;
    const ink = rgb(0.15, 0.15, 0.15);
    const line = rgb(0.75, 0.75, 0.75);

    let y = height - margin;

    // Logo (Friends of the La Mesa Library)
    const logo = await loadLogo(pdfDoc);
    if (logo) {
        const logoW = 220;
        const logoH = logoW * (logo.height / logo.width);
        page.drawImage(logo, {
            x: (width - logoW) / 2,
            y: y - logoH,
            width: logoW,
            height: logoH,
        });
        y -= logoH + 24;
    }

    // Title
    page.drawText('Reimbursement Request', { x: margin, y: y - 22, size: 22, font: bold, color: ink });
    y -= 40;
    page.drawLine({
        start: { x: margin, y }, end: { x: width - margin, y },
        thickness: 1.5, color: rgb(0.3, 0.3, 0.3),
    });
    y -= 30;

    // Boxed rows, label above value, to mimic a paper form.
    const rowH = 54;
    const rows = [
        [['Requested By', d.requestedBy], ['Date', formatDate(d.date)]],
        [['Amount', formatCurrency(d.amount)], ['Budget Account', d.budgetLabel]],
        [['Check Made Out To', d.checkTo], ['Check Memo', d.checkMemo || '—']],
    ];

    for (const row of rows) {
        const colW = contentW / row.length;
        row.forEach(([label, value], i) => {
            const x = margin + i * colW;
            drawFieldBox(page, x, y, colW - (i < row.length - 1 ? 12 : 0), rowH, label, value, { font, bold, ink, line });
        });
        y -= rowH + 12;
    }

    // Mailing section (full width)
    const mailLabel = 'Should this be mailed?';
    const mailValue = d.mailed === 'Yes' ? 'Yes' : 'No';
    drawFieldBox(page, margin, y, contentW, rowH, mailLabel, mailValue, { font, bold, ink, line });
    y -= rowH + 12;

    if (d.mailed === 'Yes') {
        const addrH = 110;
        drawFieldBox(page, margin, y, contentW, addrH, 'Name and Address', d.mailAddress, { font, bold, ink, line, multiline: true });
        y -= addrH + 12;
    }

    // Attachments summary footer
    const count = attachments.length;
    const summary = count === 0
        ? 'No receipts attached.'
        : `${count} receipt${count === 1 ? '' : 's'} attached on the following page${count === 1 ? '' : 's'}.`;
    page.drawText(summary, { x: margin, y: y - 4, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
}

function drawFieldBox(page, x, y, w, h, label, value, s) {
    // Box
    page.drawRectangle({
        x, y: y - h, width: w, height: h,
        borderColor: s.line, borderWidth: 1, color: rgb(0.98, 0.98, 0.98),
    });
    // Label
    page.drawText(label.toUpperCase(), {
        x: x + 10, y: y - 16, size: 8, font: s.bold, color: rgb(0.5, 0.5, 0.5),
    });
    // Value (wrapped)
    const valueLines = wrapText(value || '', s.font, 12, w - 20);
    const maxLines = s.multiline ? Math.floor((h - 26) / 15) : 1;
    valueLines.slice(0, maxLines).forEach((ln, i) => {
        page.drawText(ln, {
            x: x + 10, y: y - 32 - i * 15, size: 12, font: s.font, color: s.ink,
        });
    });
}

function wrapText(text, font, size, maxWidth) {
    const out = [];
    const paragraphs = String(text).split(/\r?\n/);
    for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) { out.push(''); continue; }
        let current = '';
        for (const word of words) {
            const test = current ? current + ' ' + word : word;
            if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
                out.push(current);
                current = word;
            } else {
                current = test;
            }
        }
        if (current) out.push(current);
    }
    return out;
}

async function appendAttachment(pdfDoc, file) {
    const name = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');

    if (isPdf) {
        const bytes = await file.arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await pdfDoc.copyPages(src, src.getPageIndices());
        pages.forEach(p => pdfDoc.addPage(p));
        return;
    }

    // Image: HEIC/HEIF can't be decoded by canvas in browsers.
    if (name.endsWith('.heic') || name.endsWith('.heif')) {
        throw new Error('HEIC images aren’t supported — please convert to JPG or PNG first.');
    }

    // Downscale/re-encode oversized images to keep the PDF small.
    const processed = await processImage(file);
    const embedded = processed.type === 'png'
        ? await pdfDoc.embedPng(processed.bytes)
        : await pdfDoc.embedJpg(processed.bytes);

    // Place image on its own Letter page, scaled to fit with margins.
    const page = pdfDoc.addPage([612, 792]);
    const margin = 36;
    const maxW = 612 - margin * 2;
    const maxH = 792 - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, {
        x: (612 - w) / 2,
        y: (792 - h) / 2,
        width: w,
        height: h,
    });
}

// Largest dimension (px) kept for an embedded image. ~2000px prints crisply
// on a Letter page (~250 DPI) while keeping file size reasonable.
const MAX_IMAGE_DIM = 2000;
const JPEG_QUALITY = 0.82;

// Resize/re-encode an image file for embedding.
// Returns { bytes: ArrayBuffer, type: 'png' | 'jpg' }.
// - PNG sources stay PNG (keeps text/transparency crisp); others become JPG.
// - PNGs within the size limit are reused unchanged (no quality loss). JPEGs
//   always go through the canvas even when small, because the browser applies
//   EXIF orientation when drawing to canvas but pdf-lib's embedJpg does not —
//   so passthrough would render rotated phone photos sideways.
function processImage(file) {
    const name = file.name.toLowerCase();
    const isPng = file.type === 'image/png' || name.endsWith('.png');

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            try {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h));

                // PNG within limits → reuse as-is (lossless, no orientation flag).
                if (scale === 1 && isPng) {
                    URL.revokeObjectURL(url);
                    const bytes = await file.arrayBuffer();
                    resolve({ bytes, type: 'png' });
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);
                const ctx = canvas.getContext('2d');
                if (!isPng) {
                    // JPEG has no transparency; fill white so edges aren't black.
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const outType = isPng ? 'image/png' : 'image/jpeg';
                canvas.toBlob(blob => {
                    URL.revokeObjectURL(url);
                    if (!blob) { reject(new Error('could not convert image')); return; }
                    blob.arrayBuffer()
                        .then(bytes => resolve({ bytes, type: isPng ? 'png' : 'jpg' }))
                        .catch(reject);
                }, outType, JPEG_QUALITY);
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('could not read image'));
        };
        img.src = url;
    });
}

function makeFileName(d) {
    // Format: YYYY-MM-DD_RequestorLastNameFirstInitial_Recipient_Amount.pdf
    const clean = (s) => (s || '').replace(/[^a-z0-9]+/gi, '');
    const when = d.date || new Date().toISOString().slice(0, 10);
    const requestor = nameCode(d.requestedBy) || 'Requestor';
    const recipient = clean(d.checkTo) || 'Recipient';
    const n = parseFloat(d.amount);
    const amount = isNaN(n) ? '0' : n.toFixed(2);
    return `${when}_${requestor}_${recipient}_${amount}.pdf`;
}

// "Sheila Dowe" => "DoweS"  (last word + first initial of the first word)
function nameCode(fullName) {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0].replace(/[^a-z0-9]/gi, '');
    const last = parts[parts.length - 1].replace(/[^a-z0-9]/gi, '');
    if (parts.length === 1) return first; // only one name given
    return last + first.charAt(0).toUpperCase();
}

function downloadPdf(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
