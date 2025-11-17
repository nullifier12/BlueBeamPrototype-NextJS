# Fix: PDF Loading Issue

## Problem
PDF files couldn't load after importing because blob URLs are only valid in the session they were created. When loading from database, the blob URL is no longer valid.

## Solution
1. Convert PDF to base64 when uploading
2. Store base64 in database (new `file_data` column)
3. Convert base64 back to blob URL when loading from database

## Database Update Required

Run this SQL script to add the `file_data` column:

```sql
USE bluebeam_prototype;
ALTER TABLE documents 
ADD COLUMN file_data LONGTEXT NULL AFTER file_url;
```

Or run: `database/add_file_data_column.sql`

## Changes Made

1. **FileUpload.tsx** - Converts PDF to base64 before saving
2. **API route** - Stores base64 in `file_data` column
3. **page.tsx** - Converts base64 back to blob URL when loading documents

## How It Works Now

1. User uploads PDF → Converted to base64
2. Base64 stored in database `file_data` column
3. When loading documents → Base64 converted back to blob URL
4. PDF can now load properly even after page refresh

## Testing

1. Upload a PDF file
2. Refresh the page
3. PDF should still load correctly
4. All annotations should be preserved

