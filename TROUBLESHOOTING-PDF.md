# Troubleshooting: PDF Not Loading

## Check These Steps:

### 1. Database Column Exists?
Run this SQL to check:
```sql
USE bluebeam_prototype;
DESCRIBE documents;
```

If `file_data` column doesn't exist, run:
```sql
ALTER TABLE documents 
ADD COLUMN file_data LONGTEXT NULL AFTER file_url;
```

### 2. Check Browser Console
Open browser DevTools (F12) and check:
- Any errors when uploading PDF?
- Any errors when loading PDF?
- Check console logs for "Converting base64 to blob URL"

### 3. Verify Base64 is Stored
Check if base64 data is actually in database:
```sql
SELECT id, name, 
       LENGTH(file_data) as base64_length,
       file_url, file_path
FROM documents 
WHERE project_id = 'YOUR_PROJECT_ID';
```

If `base64_length` is NULL or 0, the base64 wasn't saved.

### 4. Test Upload Flow
1. Upload a PDF
2. Check console for "Converting base64 to blob URL"
3. Check if blob URL is created successfully
4. Check if PDFViewer receives the URL

### 5. Common Issues

**Issue: "No file_data found"**
- Base64 wasn't saved to database
- Check FileUpload component is sending base64
- Check API route is saving fileData

**Issue: "Error converting base64 to blob"**
- Base64 data might be corrupted
- Check base64 string is valid
- Try re-uploading the PDF

**Issue: PDF loads but shows blank**
- Blob URL might be invalid
- Check if blob URL starts with "blob:"
- Try refreshing the page

### 6. Debug Steps

Add this to browser console after uploading:
```javascript
// Check if document has URL
console.log('Selected document:', selectedDocument);
console.log('Document URL:', selectedDocument?.url);
console.log('URL type:', selectedDocument?.url?.substring(0, 5));
```

### 7. Quick Fix

If PDF still doesn't load:
1. Delete the document from database
2. Re-upload the PDF
3. Make sure base64 is saved this time



