const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function extract() {
  const docPath = path.resolve(__dirname, '..', '07 - The Reminder That Reaches.docx');
  const outPath = path.resolve(__dirname, '07-reminder.txt');
  try {
    const result = await mammoth.extractRawText({path: docPath});
    fs.writeFileSync(outPath, result.value, 'utf8');
    console.log('Extracted text written to', outPath);
  } catch (err) {
    console.error('Extraction failed:', err);
    process.exit(1);
  }
}

extract();
