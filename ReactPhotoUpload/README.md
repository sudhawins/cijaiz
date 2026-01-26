# Photo and Video Upload Application

A full-stack web application for uploading photos and videos with Docker containerization and persistent volume storage.

## Features

- 📸 Photo upload (JPEG, PNG, GIF)
- 🎬 Video upload (MP4, MOV, AVI)
- 📊 File management (view, download, delete)
- 📱 Responsive design
- 🐳 Docker containerization
- 📦 Volume mount for persistent storage
- ⚡ Progress tracking
- 🔒 File size validation

## Project Structure

```
ReactPhotoUpload/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.js
│   │   │   └── FileList.js
│   │   ├── App.js
│   │   └── index.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── server/                 # Node.js backend
│   ├── server.js
│   ├── Dockerfile
│   ├── package.json
│   └── .env
├── uploads/                # Volume mount directory for uploaded files
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- npm or yarn

## Quick Start with Docker

### 1. Build and start containers

```bash
docker-compose up --build
```

### 2. Access the application

- Frontend: http://localhost:3000
- API: http://localhost:5000

### 3. Upload files

- Select a photo or video file
- Click "Choose File" and select your file
- Click "Upload"
- View all uploaded files in the right panel

## Development

### Local Setup (without Docker)

#### Frontend
```bash
cd client
npm install
npm start
```

#### Backend
```bash
cd server
npm install
npm start
```

## Docker Details

### Volume Mount

The application uses a volume mount at `./uploads:/uploads` which:
- Persists uploaded files on your host machine
- Allows files to survive container restarts
- Makes files accessible from the host OS

### Container Configuration

**Frontend Container:**
- Image: node:18-alpine + nginx
- Port: 3000
- Serves React app via nginx with API proxy

**Backend Container:**
- Image: node:18-alpine
- Port: 5000
- Handles file uploads and downloads
- Uses mounted volume for file storage

## API Endpoints

### Upload File
- **POST** `/api/upload`
- **Body:** FormData with `file` field
- **Response:** `{ file: { id, filename, originalName, size, uploadedAt } }`

### Get All Files
- **GET** `/api/files`
- **Response:** Array of file objects

### Download File
- **GET** `/api/download/:filename`
- **Response:** File download

### Delete File
- **DELETE** `/api/delete/:filename`
- **Response:** `{ message: "File deleted successfully" }`

### Health Check
- **GET** `/api/health`
- **Response:** `{ status: "OK" }`

## Configuration

### Environment Variables

**Backend (.env):**
```
PORT=5000
UPLOAD_DIR=/uploads
NODE_ENV=production
```

**Frontend (.env):**
```
REACT_APP_API_URL=http://localhost:5000
```

## Supported File Types

**Images:** JPEG, PNG, GIF, WebP
**Videos:** MP4, MOV, AVI

## File Limits

- Maximum file size: 100MB
- Concurrent uploads: Unlimited

## Management Commands

### View logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop containers
```bash
docker-compose stop
```

### Remove containers
```bash
docker-compose down
```

### Clean up volumes (WARNING: Deletes all uploaded files)
```bash
docker-compose down -v
```

## Troubleshooting

### Uploads not persisting
- Check that `./uploads` directory exists
- Verify volume mount in `docker-compose.yml`
- Check file permissions on host machine

### API connection fails
- Ensure both containers are running: `docker-compose ps`
- Check that ports 3000 and 5000 are available
- Review logs: `docker-compose logs backend`

### Out of disk space
- Clean up old uploads in `./uploads` directory
- Monitor disk usage: `du -sh ./uploads`

## Performance Tips

1. Compress images before uploading
2. Use MP4 format for videos (better compatibility)
3. For large files, increase nginx timeout in `nginx.conf`
4. Consider using a CDN for file serving

## Security Considerations

1. Implement authentication/authorization
2. Add virus scanning for uploaded files
3. Validate file contents (not just extensions)
4. Implement rate limiting on upload endpoint
5. Consider using S3 or similar for production storage
6. Add HTTPS in production

## Future Enhancements

- [ ] User authentication
- [ ] File sharing/public links
- [ ] Image thumbnail generation
- [ ] Video preview/streaming
- [ ] Advanced search/filtering
- [ ] File organization (folders)
- [ ] Upload scheduling
- [ ] Automatic cleanup policies

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
