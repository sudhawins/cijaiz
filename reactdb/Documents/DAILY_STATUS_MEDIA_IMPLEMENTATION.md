# Daily Room Status Media Upload Implementation

## Overview
This document outlines the implementation of photo and video upload functionality for the Daily Room Status Management screen. Users can now upload up to 2 photos and 2 videos per daily status record.

## Implementation Summary

### 1. Database Changes
**File Created:** [database_scripts/06_daily_status_media.sql](database_scripts/06_daily_status_media.sql)

#### New Table: `DailyRoomStatusMedia`
```sql
CREATE TABLE [dbo].[DailyRoomStatusMedia](
  [Id] [int] IDENTITY(1,1) NOT NULL,
  [DailyStatusId] [int] NOT NULL,
  [MediaType] [varchar](50) NOT NULL,          -- 'photo' or 'video'
  [SequenceNumber] [int] NOT NULL,             -- 1 or 2
  [FileName] [varchar](500) NOT NULL,
  [FilePath] [varchar](1000) NOT NULL,
  [FileSize] [bigint] NULL,
  [MimeType] [varchar](100) NULL,
  [UploadedDate] [datetime] NOT NULL,
  [CreatedBy] [int] NULL,
  PRIMARY KEY CLUSTERED ([Id] ASC)
)
```

**Features:**
- Foreign key relationship to `DailyRoomStatus` with CASCADE DELETE
- Indexes on `DailyStatusId` and `MediaType` for fast queries
- Cascade delete: Removing a daily status automatically deletes all associated media

### 2. Backend API Endpoints
**File Modified:** [backend/src/index.ts](backend/src/index.ts)

#### New Endpoints:

##### GET `/api/daily-status/:id/media`
Retrieves all media files for a specific daily status.

**Response:**
```json
[
  {
    "id": 1,
    "dailyStatusId": 1,
    "mediaType": "photo",
    "sequenceNumber": 1,
    "fileName": "photo_1_image.jpg",
    "filePath": "/complains/photo_1_image.jpg",
    "fileSize": 2048576,
    "mimeType": "image/jpeg",
    "uploadedDate": "2026-03-06T10:30:00"
  }
]
```

##### POST `/api/daily-status/:id/media/upload`
Uploads one or more media files (photos and/or videos) for a daily status.

**Request:**
- Method: POST with multipart/form-data
- FormData field: `files` (multiple files)
- Max files: 4 (2 photos + 2 videos)
- File types: Images (jpeg, png, gif, webp) and Videos (mp4, webm, quicktime)

**Validation:**
- Maximum 2 photos per status
- Maximum 2 videos per status
- File size limit: 50MB per file
- Only image and video MIME types are allowed

**Response:**
```json
{
  "message": "Media uploaded successfully",
  "data": [
    {
      "id": 1,
      "mediaType": "photo",
      "sequenceNumber": 1,
      "fileName": "photo_1_image.jpg",
      "filePath": "/complains/photo_1_image.jpg",
      "fileSize": 2048576,
      "mimeType": "image/jpeg"
    }
  ]
}
```

##### DELETE `/api/daily-status/media/:mediaId`
Deletes a specific media file by ID.

**Response:**
```json
{
  "message": "Media deleted successfully"
}
```

### 3. Frontend API Service
**File Modified:** [frontend/src/api.ts](frontend/src/api.ts)

#### New API Methods:

```typescript
// Get media files for a daily status
getDailyStatusMedia: (statusId: number) => api.get(`/daily-status/${statusId}/media`)

// Upload media files for a daily status
uploadDailyStatusMedia: (statusId: number, formData: FormData) => {
  // Uses fetch API to handle FormData properly
}

// Delete a media file
deleteDailyStatusMedia: (mediaId: number) => api.delete(`/daily-status/media/${mediaId}`)
```

### 4. Frontend Component
**File Modified:** [frontend/src/components/DailyStatusManagement.tsx](frontend/src/components/DailyStatusManagement.tsx)

#### New Features:

##### In Form (When Creating/Editing Status)
- Section to select and preview up to 2 photos before saving status
- Section to select and preview up to 2 videos before saving status
- File removal capability for selected files
- Visual feedback showing number of selected files

##### In Status Cards
- Media section showing all uploaded files
- "Add Media" button to reveal upload form
- Gallery view for uploaded photos and videos
- Delete button for each media file
- Status indicators showing no media uploaded

#### New State Variables:
```typescript
interface MediaItem {
  id: number;
  dailyStatusId: number;
  mediaType: 'photo' | 'video';
  sequenceNumber: number;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedDate?: string;
}

// Component state
const [statusMedia, setStatusMedia] = useState<{ [key: number]: MediaItem[] }>({});
const [selectedStatusForMedia, setSelectedStatusForMedia] = useState<number | null>(null);
const [mediaFiles, setMediaFiles] = useState<{
  photos: File[];
  videos: File[];
}>({
  photos: [],
  videos: []
});
```

#### Key Functions:

**fetchMediaForStatus(statusId: number)**
- Fetches all media files for a specific daily status
- Called when component mounts and after status updates

**handlePhotoSelect(files: FileList)**
- Handles photo file selection
- Enforces max 2 photos limit
- Updates local state with selected files

**handleVideoSelect(files: FileList)**
- Handles video file selection
- Enforces max 2 videos limit
- Updates local state with selected files

**removeMediaFile(type: 'photo' | 'video', index: number)**
- Removes a selected file from the local state
- Updates UI immediately

**handleMediaUpload(statusId: number)**
- Uploads selected media files to the server
- Creates FormData with files
- Handles success/error responses
- Refreshes media gallery after upload

**handleMediaDelete(mediaId: number, statusId: number)**
- Deletes a media file from the database
- Updates media gallery after deletion

### 5. Styling
**File Modified:** [frontend/src/components/ManagementStyles.css](frontend/src/components/ManagementStyles.css)

#### New CSS Classes:

```css
/* Media Upload Section */
.media-upload-section { }
.file-input-group { }
.file-input { }
.file-label { }
.selected-files { }
.file-item { }

/* Media Display Section */
.media-section { }
.media-header { }
.media-upload-form { }
.upload-section { }
.upload-buttons { }
.uploaded-media { }
.media-grid { }
.media-item { }
.media-thumbnail { }
.media-label { }
```

**Features:**
- Responsive grid layout for media gallery (120px minimum width)
- Hover effects on buttons and cards
- Mobile-friendly file input styling
- Animated transitions
- Color-coded sections (blue for photos, consistent with app theme)

## User Interface Flow

### Adding Media to Existing Status:
1. Open the "Daily Room Status Management" screen
2. View existing daily status cards
3. Click "Add Media" button on the desired status card
4. Select up to 2 photos and 2 videos
5. Preview selected files in the form
6. Click "Upload Media" to upload
7. Media gallery displays thumbnails with delete option

### Inline Media Upload (When Creating Status):
1. Create or edit a daily status
2. Use media upload section in the form
3. Select photos and videos before saving the status
4. Photos and videos can be managed separately

## Technical Notes

### File Storage:
- All media files are stored in the shared `complains` directory (subject to change)
- Files are served via `/api/complains/` endpoint
- File naming: Auto-generated unique names with original extension

### Database Cascade:
- Deleting a daily status automatically deletes all associated media
- Deleting media is independent and doesn't affect the status

### API Error Handling:
- 400: Invalid request (too many files, invalid file types)
- 404: Daily status or media file not found
- 500: Server error during upload or deletion
- Error messages are propagated to user interface

### File Validation:
- **Backend**: Checks file type (MIME) and count limits
- **Frontend**: Input accept attributes limit selectable types
- **Server**: Max file size 50MB, enforced by multer

## Database Migration Script
Execute the script before deploying changes:
```bash
sqlcmd -S {server} -d mansion -i database_scripts/06_daily_status_media.sql
```

## Testing Recommendations

1. **File Upload:**
   - Upload 2 photos and 2 videos successfully
   - Try uploading 3 photos (should fail)
   - Try uploading invalid file types

2. **File Deletion:**
   - Delete individual media files
   - Verify files are removed from disk and database
   - Delete status and verify all media is deleted

3. **Edge Cases:**
   - Upload large files (near 50MB limit)
   - Upload with same filename
   - Rapid sequential uploads
   - Browser back button after upload

4. **UI/UX:**
   - Verify responsive design on mobile
   - Check accessibility of file inputs
   - Test keyboard navigation
   - Verify loading states during upload

## Future Enhancements

1. **Media Editing:**
   - Image cropping and rotation
   - Video preprocessing/compression
   - Metadata extraction

2. **Advanced Features:**
   - Drag-and-drop file upload
   - Batch operations
   - Media search/filter
   - Image compression before upload
   - Gallery lightbox view

3. **Integration:**
   - Store media metadata (dimensions, duration, etc.)
   - Generate thumbnails
   - Cloud storage integration (AWS S3, Azure Blob)
   - Media versioning/history

## File Changes Summary

| File | Type | Changes |
|------|------|---------|
| `database_scripts/06_daily_status_media.sql` | Created | New table structure |
| `backend/src/index.ts` | Modified | 3 new endpoints (GET, POST, DELETE) |
| `frontend/src/api.ts` | Modified | 3 new API methods |
| `frontend/src/components/DailyStatusManagement.tsx` | Modified | Major UI/logic update |
| `frontend/src/components/ManagementStyles.css` | Modified | 30+ new CSS classes |

## Support & Troubleshooting

### Issue: Upload fails with "Maximum 2 photos allowed"
- Ensure you're selecting max 2 photos
- Clear selection and try again

### Issue: Files not appearing after upload
- Check network tab in browser dev tools
- Verify server logs for upload errors
- Ensure complains directory has proper permissions

### Issue: Deleted media still appears
- Try refreshing the page
- Clear browser cache
- Verify database transaction completed

---

**Implementation Date:** March 6, 2026
**Status:** Complete
**Version:** 1.0
