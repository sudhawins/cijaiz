import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import React from 'react';
import { apiService, getFileUrl } from '../api';
import { useAuth } from './AuthContext';
import './ManagementStyles.css';

interface MediaFile {
  id: number;
  dailyStatusId: number;
  mediaType: string;
  sequenceNumber: number;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedDate?: string;
}

// Memoized component for form media display (edit mode)
const FormMediaSection = React.memo(({ 
  editingStatus, 
  mediaFiles, 
  editDeletingMedia, 
  replacingMediaId,
  editUploadingMedia,
  editUploadProgress,
  onReplacingMediaIdChange,
  onDeleteMedia,
  onEditMediaUpload,
  isImageFile 
}: any) => {
  if (!editingStatus) return null;
  
  const existingMedia = mediaFiles[editingStatus.id] || [];
  const photoCount = useMemo(() => existingMedia.filter((m: MediaFile) => m.mediaType === 'photo').length, [existingMedia]);
  const videoCount = useMemo(() => existingMedia.filter((m: MediaFile) => m.mediaType === 'video').length, [existingMedia]);

  return (
    <div className="edit-media-section">
      <h4>📷 Photos & Videos</h4>
      
      {/* Existing Media Display */}
      {existingMedia.length > 0 ? (
        <div className="edit-existing-media">
          <div className="media-type-group">
            <div className="media-type-header">Photos</div>
            <div className="edit-media-grid">
              {existingMedia
                .filter((m: MediaFile) => m.mediaType === 'photo')
                .sort((a: MediaFile, b: MediaFile) => a.sequenceNumber - b.sequenceNumber)
                .map((media: MediaFile) => (
                  <div key={media.id} className="edit-media-item">
                    {isImageFile(media.mimeType) ? (
                      <img
                        src={getFileUrl(media.filePath)}
                        alt={media.fileName}
                        className="edit-media-thumbnail"
                      />
                    ) : (
                      <div className="edit-media-placeholder">{media.fileName}</div>
                    )}
                    <div className="edit-media-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-info"
                        onClick={() => onReplacingMediaIdChange(media.id)}
                        disabled={editDeletingMedia[media.id] || replacingMediaId === media.id}
                      >
                        {replacingMediaId === media.id ? 'Choose File...' : 'Replace'}
                      </button>
                      {replacingMediaId === media.id && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => onEditMediaUpload(editingStatus.id, e.target.files, media.id)}
                          style={{ display: 'none' }}
                          id={`replace-photo-${media.id}`}
                        />
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          onReplacingMediaIdChange(null);
                          onDeleteMedia(media.id, editingStatus.id);
                        }}
                        disabled={editDeletingMedia[media.id]}
                      >
                        {editDeletingMedia[media.id] ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    {replacingMediaId === media.id && (
                      <label htmlFor={`replace-photo-${media.id}`} className="edit-media-upload-btn">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => onEditMediaUpload(editingStatus.id, e.target.files, media.id)}
                          id={`replace-photo-${media.id}`}
                        />
                        Select File
                      </label>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="media-type-group">
            <div className="media-type-header">Videos</div>
            <div className="edit-media-grid">
              {existingMedia
                .filter((m: MediaFile) => m.mediaType === 'video')
                .sort((a: MediaFile, b: MediaFile) => a.sequenceNumber - b.sequenceNumber)
                .map((media: MediaFile) => (
                  <div key={media.id} className="edit-media-item">
                    <video className="edit-media-thumbnail">
                      <source src={getFileUrl(media.filePath)} type={media.mimeType || 'video/mp4'} />
                    </video>
                    <div className="edit-media-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-info"
                        onClick={() => onReplacingMediaIdChange(media.id)}
                        disabled={editDeletingMedia[media.id] || replacingMediaId === media.id}
                      >
                        {replacingMediaId === media.id ? 'Choose File...' : 'Replace'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          onReplacingMediaIdChange(null);
                          onDeleteMedia(media.id, editingStatus.id);
                        }}
                        disabled={editDeletingMedia[media.id]}
                      >
                        {editDeletingMedia[media.id] ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    {replacingMediaId === media.id && (
                      <label htmlFor={`replace-video-${media.id}`} className="edit-media-upload-btn">
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => onEditMediaUpload(editingStatus.id, e.target.files, media.id)}
                          id={`replace-video-${media.id}`}
                        />
                        Select File
                      </label>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="edit-no-media">No media files yet</p>
      )}

      {/* Add New Media */}
      <div className="edit-add-media">
        {photoCount < 2 && (
          <div className="edit-media-upload-item">
            <label htmlFor={`add-photo-${editingStatus.id}`} className="edit-media-upload-btn-primary">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => onEditMediaUpload(editingStatus.id, e.target.files, undefined, 'photo')}
                id={`add-photo-${editingStatus.id}`}
                disabled={editUploadingMedia[editingStatus.id]}
              />
              {editUploadingMedia[editingStatus.id] ? '⏳ Adding Photos...' : '➕ Add Photos'}
            </label>
            {editUploadProgress[editingStatus.id] > 0 && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${editUploadProgress[editingStatus.id]}%` }}
                />
              </div>
            )}
          </div>
        )}
        {videoCount < 2 && (
          <div className="edit-media-upload-item">
            <label htmlFor={`add-video-${editingStatus.id}`} className="edit-media-upload-btn-primary">
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => onEditMediaUpload(editingStatus.id, e.target.files, undefined, 'video')}
                id={`add-video-${editingStatus.id}`}
                disabled={editUploadingMedia[editingStatus.id]}
              />
              {editUploadingMedia[editingStatus.id] ? '⏳ Adding Videos...' : '➕ Add Videos'}
            </label>
            {editUploadProgress[editingStatus.id] > 0 && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${editUploadProgress[editingStatus.id]}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps: any, nextProps: any) => {
  // Custom comparison for better performance
  return (
    prevProps.editingStatus?.id === nextProps.editingStatus?.id &&
    prevProps.mediaFiles === nextProps.mediaFiles &&
    prevProps.replacingMediaId === nextProps.replacingMediaId &&
    prevProps.editDeletingMedia === nextProps.editDeletingMedia &&
    prevProps.editUploadingMedia === nextProps.editUploadingMedia &&
    prevProps.editUploadProgress === nextProps.editUploadProgress
  );
});

const getSupportedRecordingMimeType = (): string => {
  const candidateTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];

  for (const mimeType of candidateTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return 'video/webm';
};

const LiveCameraCapture = React.memo(({
  mediaType,
  disabled,
  onCaptureReady
}: {
  mediaType: 'photo' | 'video';
  disabled: boolean;
  onCaptureReady: (file: File, mediaType: 'photo' | 'video') => Promise<void>;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setRecording(false);
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported on this browser/device.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: mediaType === 'video'
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start camera.';
      setCameraError(message);
    }
  }, [mediaType]);

  const resetCapture = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCapturedFile(null);
  }, [previewUrl]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 1280;
    canvas.height = videoElement.videoHeight || 720;

    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Unable to capture photo on this device.');
      return;
    }

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!blob) {
      setCameraError('Photo capture failed. Please try again.');
      return;
    }

    resetCapture();
    const fileName = `daily-status-photo-${Date.now()}.jpg`;
    const photoFile = new File([blob], fileName, { type: 'image/jpeg' });
    const nextPreviewUrl = URL.createObjectURL(photoFile);
    setCapturedFile(photoFile);
    setPreviewUrl(nextPreviewUrl);
  }, [resetCapture]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      return;
    }

    try {
      resetCapture();
      chunksRef.current = [];
      const mimeType = getSupportedRecordingMimeType();
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const videoFile = new File([blob], `daily-status-video-${Date.now()}.${extension}`, { type: mimeType });
        const nextPreviewUrl = URL.createObjectURL(videoFile);
        setCapturedFile(videoFile);
        setPreviewUrl(nextPreviewUrl);
        setRecording(false);
      };

      recorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to record video.';
      setCameraError(message);
    }
  }, [resetCapture]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const uploadCaptured = useCallback(async () => {
    if (!capturedFile) {
      return;
    }

    await onCaptureReady(capturedFile, mediaType);
    resetCapture();
  }, [capturedFile, mediaType, onCaptureReady, resetCapture]);

  useEffect(() => {
    setCameraError(null);
    resetCapture();
  }, [mediaType, resetCapture]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      stopCamera();
    };
  }, [previewUrl, stopCamera]);

  return (
    <div className="camera-capture-panel">
      <div className="camera-capture-actions">
        {!cameraActive ? (
          <button
            type="button"
            className="btn btn-sm btn-info"
            onClick={startCamera}
            disabled={disabled}
          >
            Start Camera
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={stopCamera}
            disabled={disabled || recording}
          >
            Stop Camera
          </button>
        )}

        {cameraActive && mediaType === 'photo' && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={capturePhoto}
            disabled={disabled}
          >
            Capture Photo
          </button>
        )}

        {cameraActive && mediaType === 'video' && !recording && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={startRecording}
            disabled={disabled}
          >
            Start Recording
          </button>
        )}

        {cameraActive && mediaType === 'video' && recording && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={stopRecording}
          >
            Stop Recording
          </button>
        )}
      </div>

      {cameraError && <p className="camera-error">{cameraError}</p>}

      <div className="camera-preview-wrap">
        <video
          ref={videoRef}
          className={`camera-preview-live ${cameraActive ? '' : 'hidden'}`}
          autoPlay
          muted
          playsInline
        />

        {previewUrl && (
          mediaType === 'photo' ? (
            <img src={previewUrl} alt="Captured preview" className="camera-preview-captured" />
          ) : (
            <video src={previewUrl} className="camera-preview-captured" controls />
          )
        )}
      </div>

      {capturedFile && (
        <div className="camera-capture-actions">
          <button
            type="button"
            className="btn btn-sm btn-success"
            onClick={uploadCaptured}
            disabled={disabled}
          >
            Upload Captured {mediaType === 'photo' ? 'Photo' : 'Video'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={resetCapture}
            disabled={disabled}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
});

// Memoized component for media display in list view
const ListMediaSection = React.memo(({ 
  status, 
  mediaFiles, 
  deletingMedia, 
  uploadingMedia, 
  uploadProgress,
  selectedMediaType,
  showMediaUpload,
  cameraOpenForStatus,
  onMediaTypeChange,
  onMediaUpload,
  onCapturedMediaUpload,
  onToggleCamera,
  onShowMediaUpload,
  onDeleteMedia,
  onOpenFullscreen,
  isImageFile,
  isAdmin
}: any) => {
  return (
    <div className="media-section">
      <h5>Media Files</h5>
      
      {/* Photos */}
      <div className="media-type-group">
        <div className="media-type-header">📷 Photos ({(mediaFiles[status.id] || []).filter((m: MediaFile) => m.mediaType === 'photo').length}/2)</div>
        <div className="media-gallery">
          {(mediaFiles[status.id] || [])
            .filter((m: MediaFile) => m.mediaType === 'photo')
            .sort((a: MediaFile, b: MediaFile) => a.sequenceNumber - b.sequenceNumber)
            .map((media: MediaFile) => (
              <div key={media.id} className="media-item">
                {isImageFile(media.mimeType) ? (
                  <img 
                    src={getFileUrl(media.filePath)} 
                    alt={media.fileName} 
                    className="media-thumbnail" 
                    onClick={() => onOpenFullscreen(media, status.id)}
                    style={{ cursor: 'pointer' }}
                  />
                ) : (
                  <div className="media-placeholder">{media.fileName}</div>
                )}
                {isAdmin && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onDeleteMedia(media.id, status.id)}
                    disabled={deletingMedia[media.id]}
                  >
                    {deletingMedia[media.id] ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Videos */}
      <div className="media-type-group">
        <div className="media-type-header">🎥 Videos ({(mediaFiles[status.id] || []).filter((m: MediaFile) => m.mediaType === 'video').length}/2)</div>
        <div className="media-gallery">
          {(mediaFiles[status.id] || [])
            .filter((m: MediaFile) => m.mediaType === 'video')
            .sort((a: MediaFile, b: MediaFile) => a.sequenceNumber - b.sequenceNumber)
            .map((media: MediaFile) => (
              <div key={media.id} className="media-item">
                <video 
                  className="media-thumbnail" 
                  onClick={() => onOpenFullscreen(media, status.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <source src={getFileUrl(media.filePath)} type={media.mimeType || 'video/mp4'} />
                </video>
                {isAdmin && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onDeleteMedia(media.id, status.id)}
                    disabled={deletingMedia[media.id]}
                  >
                    {deletingMedia[media.id] ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Upload Section */}
      {showMediaUpload === status.id ? (
        <div className="media-upload-form">
          <div className="form-group">
            <label>Media Type:</label>
            <select
              value={selectedMediaType}
              onChange={(e) => onMediaTypeChange(e.target.value as 'photo' | 'video')}
            >
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div className="form-group">
            <label>Select Files (max 2 per type):</label>
            <input
              type="file"
              multiple
              accept={selectedMediaType === 'photo' ? 'image/*' : 'video/*'}
              onChange={(e) => onMediaUpload(status.id, e.target.files)}
              disabled={uploadingMedia[status.id]}
            />
          </div>
          {uploadingMedia[status.id] && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress[status.id] || 0}%` }}
                ></div>
              </div>
              <p className="progress-text">{uploadProgress[status.id] || 0}% Uploaded</p>
            </div>
          )}

          <div className="camera-toggle-row">
            <button
              type="button"
              className="btn btn-sm btn-info"
              onClick={() => onToggleCamera(cameraOpenForStatus === status.id ? null : status.id)}
              disabled={uploadingMedia[status.id]}
            >
              {cameraOpenForStatus === status.id ? 'Hide Live Camera' : 'Use Live Camera'}
            </button>
          </div>

          {cameraOpenForStatus === status.id && (
            <LiveCameraCapture
              mediaType={selectedMediaType}
              disabled={uploadingMedia[status.id]}
              onCaptureReady={(file, mediaType) => onCapturedMediaUpload(status.id, file, mediaType)}
            />
          )}

          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onShowMediaUpload(null)}
            disabled={uploadingMedia[status.id]}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onShowMediaUpload(status.id)}
        >
          + Upload Media
        </button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.status.id === nextProps.status.id &&
    prevProps.mediaFiles === nextProps.mediaFiles &&
    prevProps.deletingMedia === nextProps.deletingMedia &&
    prevProps.uploadingMedia === nextProps.uploadingMedia &&
    prevProps.uploadProgress === nextProps.uploadProgress &&
    prevProps.selectedMediaType === nextProps.selectedMediaType &&
    prevProps.showMediaUpload === nextProps.showMediaUpload &&
    prevProps.cameraOpenForStatus === nextProps.cameraOpenForStatus
  );
});

// Memoized component for status list display
const StatusList = React.memo(({
  filteredStatuses,
  loading,
  mediaFiles,
  successMessage,
  successStatusId,
  error,
  errorStatusId,
  deletingMedia,
  uploadingMedia,
  uploadProgress,
  selectedMediaType,
  showMediaUpload,
  cameraOpenForStatus,
  isAdmin,
  onMediaTypeChange,
  onMediaUpload,
  onCapturedMediaUpload,
  onToggleCamera,
  onShowMediaUpload,
  onDeleteMedia,
  onEdit,
  onDelete,
  onOpenFullscreen,
  isImageFile
}: any) => {
  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  if (filteredStatuses.length === 0) {
    return (
      <div className="no-results-message">
        <p>No daily statuses found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="items-grid">
      {filteredStatuses.map((status: DailyStatus) => (
        <div key={status.id} className="item-card">
          {successMessage && successStatusId === status.id && (
            <div className="success-message">{successMessage}</div>
          )}
          {error && errorStatusId === status.id && (
            <div className="error-message">{error}</div>
          )}
          <div className="item-header">
            <h4>{new Date(status.date).toLocaleDateString()} - Id: {status.id}</h4>
            <div className="item-actions">
              <button className="btn btn-sm btn-info" onClick={() => onEdit(status)}>
                Edit
              </button>
              {isAdmin && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onDelete(status.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          
          {status.roomStatus && (
            <p><strong>Room Status:</strong> {status.roomStatus}</p>
          )}
          {status.waterLevelStatus && (
            <p><strong>Water Level:</strong> {status.waterLevelStatus}</p>
          )}
          {status.createdDate && (
            <p>
            {new Intl.DateTimeFormat("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true
            }).format(new Date(status.createdDate))}
          </p>
          )}

          {/* Media Section */}
          <ListMediaSection
            status={status}
            mediaFiles={mediaFiles}
            deletingMedia={deletingMedia}
            uploadingMedia={uploadingMedia}
            uploadProgress={uploadProgress}
            selectedMediaType={selectedMediaType}
            showMediaUpload={showMediaUpload}
            cameraOpenForStatus={cameraOpenForStatus}
            onMediaTypeChange={onMediaTypeChange}
            onMediaUpload={onMediaUpload}
            onCapturedMediaUpload={onCapturedMediaUpload}
            onToggleCamera={onToggleCamera}
            onShowMediaUpload={onShowMediaUpload}
            onDeleteMedia={onDeleteMedia}
            onOpenFullscreen={onOpenFullscreen}
            isImageFile={isImageFile}
            isAdmin={isAdmin}
          />
        </div>
      ))}
    </div>
  );
}, (prevProps: any, nextProps: any) => {
  // Custom comparison - only re-render if these specific props change
  return (
    prevProps.filteredStatuses === nextProps.filteredStatuses &&
    prevProps.loading === nextProps.loading &&
    prevProps.mediaFiles === nextProps.mediaFiles &&
    prevProps.successMessage === nextProps.successMessage &&
    prevProps.successStatusId === nextProps.successStatusId &&
    prevProps.error === nextProps.error &&
    prevProps.errorStatusId === nextProps.errorStatusId &&
    prevProps.selectedMediaType === nextProps.selectedMediaType &&
    prevProps.showMediaUpload === nextProps.showMediaUpload &&
    prevProps.cameraOpenForStatus === nextProps.cameraOpenForStatus &&
    prevProps.deletingMedia === nextProps.deletingMedia &&
    prevProps.uploadingMedia === nextProps.uploadingMedia &&
    prevProps.uploadProgress === nextProps.uploadProgress
  );
});

interface DailyStatus {
  id: number;
  date: string;
  roomStatus?: string;
  waterLevelStatus?: string;
  createdDate?: string;
}

const getLocalDateInputValue = (value: Date = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateOnlyValue = (value: string): string => {
  if (!value) {
    return '';
  }

  if (value.includes('T')) {
    return value.split('T')[0];
  }

  return value;
};

export default function DailyStatusManagement() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [statuses, setStatuses] = useState<DailyStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatusId, setErrorStatusId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successStatusId, setSuccessStatusId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState<DailyStatus | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'id-desc' | 'id-asc'>('id-desc');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  
  // Media upload states
  const [showMediaUpload, setShowMediaUpload] = useState<number | null>(null);
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile[]>>({});
  const [selectedMediaType, setSelectedMediaType] = useState<'photo' | 'video'>('photo');
  const [uploadingMedia, setUploadingMedia] = useState<Record<number, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [deletingMedia, setDeletingMedia] = useState<Record<number, boolean>>({});
  const [cameraOpenForStatus, setCameraOpenForStatus] = useState<number | null>(null);
  const [createMediaType, setCreateMediaType] = useState<'photo' | 'video'>('photo');
  const [createMediaFiles, setCreateMediaFiles] = useState<File[]>([]);
  const [createCameraOpen, setCreateCameraOpen] = useState(false);
  const [creatingStatusId, setCreatingStatusId] = useState<number | null>(null);
  
  // Fullscreen view states
  const [fullscreenMedia, setFullscreenMedia] = useState<MediaFile | null>(null);
  const [fullscreenStatusId, setFullscreenStatusId] = useState<number | null>(null);
  const [fullscreenMediaType, setFullscreenMediaType] = useState<'photo' | 'video' | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  
  // Edit mode media states
  const [editUploadingMedia, setEditUploadingMedia] = useState<Record<number, boolean>>({});
  const [editUploadProgress, setEditUploadProgress] = useState<Record<number, number>>({});
  const [editDeletingMedia, setEditDeletingMedia] = useState<Record<number, boolean>>({});
  const [replacingMediaId, setReplacingMediaId] = useState<number | null>(null);

  // Lazy loading states
  const [visibleCount, setVisibleCount] = useState(10);
  const [itemsPerPage] = useState(10);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const visibleCountRef = useRef(10);
  
  // Keep ref in sync with state
  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  const [formData, setFormData] = useState({
    date: getLocalDateInputValue(),
    roomStatus: '',
    waterLevelStatus: ''
  });

  // Auto-dismiss success message after 10 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setSuccessStatusId(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Auto-dismiss error message after 5 seconds
  // useEffect(() => {
  //   if (error) {
  //     const timer = setTimeout(() => {
  //       setError(null);
  //       setErrorStatusId(null);
  //     }, 5000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [error]);

  // Fetch statuses
  const fetchStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDailyStatuses();
      setStatuses(response.data);
      console.log('Fetched daily statuses:', response.data);
      // Fetch media for each status
      // for (const status of response.data) {
      //   await fetchMediaForStatus(status.id);
      // }
      await fetchMediaForAll(); // Fetch all media and organize by statusId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily statuses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch media for a specific status
  const fetchMediaForStatus = async (statusId: number) => {
    try {
      const response = await apiService.getDailyStatusMedia(statusId);
      setMediaFiles(prev => ({
        ...prev,
        [statusId]: response.data
      }));
    } catch (err) {
      console.error(`Failed to fetch media for status ${statusId}:`, err);
    }
  };

  // Fetch All media and organize by statusId
  const fetchMediaForAll = async () => {
    try {
      const response = await apiService.getDailyStatusAllMedia();
      console.log('Fetched all media files:', response.data);
      const mediaByStatus: Record<number, MediaFile[]> = {};
      response.data.forEach((media: MediaFile) => {
        if (!mediaByStatus[media.dailyStatusId]) {
          mediaByStatus[media.dailyStatusId] = [];
        }
        mediaByStatus[media.dailyStatusId].push(media);
      });
      setMediaFiles(mediaByStatus);
    } catch (err) {
      console.error(`Failed to fetch media for all statuses:`, err);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setErrorStatusId(null);

      if (editingStatus) {
        await apiService.updateDailyStatus(editingStatus.id, formData);
        setSuccessMessage('Daily status updated successfully!');
        setSuccessStatusId(editingStatus.id);
      } else {
        const createResponse = await apiService.createDailyStatus(formData);
        // Fetch media for the newly created status
        if (createResponse.data.id) {
          const createdStatusId = createResponse.data.id;

          if (createMediaFiles.length > 0) {
            setCreatingStatusId(createdStatusId);
            await performMediaUpload(
              createdStatusId,
              createMediaFiles,
              createMediaType,
              setUploadingMedia,
              setUploadProgress
            );
          } else {
            await fetchMediaForStatus(createdStatusId);
          }

          setSuccessStatusId(createdStatusId);
        }
        setSuccessMessage('Daily status created successfully!');
      }

      setShowForm(false);
      setEditingStatus(null);
      setFormData({
        date: getLocalDateInputValue(),
        roomStatus: '',
        waterLevelStatus: ''
      });
      setCreateMediaType('photo');
      setCreateMediaFiles([]);
      setCreateCameraOpen(false);
      await fetchStatuses();
      listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save daily status';
      setError(errorMsg);
      setErrorStatusId(editingStatus?.id || null);
    } finally {
      setLoading(false);
      setCreatingStatusId(null);
    }
  };

  // Memoized form input handlers
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, date: e.target.value }));
  }, []);

  const handleRoomStatusChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, roomStatus: e.target.value }));
  }, []);

  const handleWaterLevelStatusChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, waterLevelStatus: e.target.value }));
  }, []);

  // Memoized media operation handlers
  const handleReplacingMediaIdChange = useCallback((mediaId: number | null) => {
    setReplacingMediaId(mediaId);
  }, []);

  const handleMediaTypeChange = useCallback((mediaType: 'photo' | 'video') => {
    setSelectedMediaType(mediaType);
  }, []);

  const handleShowMediaUpload = useCallback((statusId: number | null) => {
    setShowMediaUpload(statusId);
    if (statusId === null) {
      setCameraOpenForStatus(null);
    }
  }, []);

  const handleCreateMediaFilesChange = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) {
      setCreateMediaFiles([]);
      return;
    }

    const selectedFiles = Array.from(files);
    if (selectedFiles.length > 2) {
      setError('You can upload up to 2 files while adding a status.');
      setCreateMediaFiles([]);
      return;
    }

    setError(null);
    setErrorStatusId(null);
    setCreateMediaFiles(selectedFiles);
  }, []);

  const handleCreateCapturedMedia = useCallback(async (file: File, mediaType: 'photo' | 'video') => {
    if (mediaType !== createMediaType) {
      setError(`Capture type mismatch. Switch media type to ${mediaType} and try again.`);
      return;
    }

    setCreateMediaFiles((prev) => {
      if (prev.length >= 2) {
        setError('You can upload up to 2 files while adding a status.');
        return prev;
      }

      setError(null);
      setErrorStatusId(null);
      return [...prev, file];
    });
  }, [createMediaType]);

  const handleRemoveCreateMediaFile = useCallback((indexToRemove: number) => {
    setCreateMediaFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }, []);

  const handleToggleCamera = useCallback((statusId: number | null) => {
    setCameraOpenForStatus(statusId);
  }, []);

  // Handle media file upload (list view)
  const handleMediaUpload = async (statusId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const existingMedia = mediaFiles[statusId] || [];
    const existingCount = existingMedia.filter(m => m.mediaType === selectedMediaType).length;

    if (existingCount + files.length > 2) {
      setError(`Cannot upload more than 2 ${selectedMediaType}s per status. Current: ${existingCount}`);
      setErrorStatusId(statusId);
      return;
    }

    await performMediaUpload(statusId, files, selectedMediaType, setUploadingMedia, setUploadProgress);
  };

  const handleCapturedMediaUpload = async (statusId: number, file: File, mediaType: 'photo' | 'video') => {
    const existingMedia = mediaFiles[statusId] || [];
    const existingCount = existingMedia.filter(m => m.mediaType === mediaType).length;

    if (existingCount + 1 > 2) {
      setError(`Cannot upload more than 2 ${mediaType}s per status. Current: ${existingCount}`);
      setErrorStatusId(statusId);
      return;
    }

    await performMediaUpload(statusId, [file], mediaType, setUploadingMedia, setUploadProgress);
    setCameraOpenForStatus(null);
  };

  // Handle media file upload (edit mode)
  const handleEditMediaUpload = async (statusId: number, files: FileList | null, replaceMediaId?: number, mediaTypeOverride?: 'photo' | 'video') => {
    if (!files || files.length === 0) return;

    const mediaType = mediaTypeOverride || 'photo';
    const existingMedia = mediaFiles[statusId] || [];
    let existingCount = existingMedia.filter(m => m.mediaType === mediaType).length;
    
    // If replacing, don't count the replaced media
    if (replaceMediaId) {
      existingCount = Math.max(0, existingCount - 1);
    }

    if (existingCount + files.length > 2) {
      setError(`Cannot have more than 2 ${mediaType}s per status. Current: ${existingCount}`);
      setErrorStatusId(statusId);
      return;
    }

    // If replacing, first delete the old media
    if (replaceMediaId) {
      try {
        setEditDeletingMedia(prev => ({ ...prev, [replaceMediaId]: true }));
        await apiService.deleteDailyStatusMedia(replaceMediaId);
        await fetchMediaForStatus(statusId);
      } catch (err) {
        console.error('Error deleting media for replacement:', err);
        setEditDeletingMedia(prev => ({ ...prev, [replaceMediaId]: false }));
        return;
      } finally {
        setEditDeletingMedia(prev => ({ ...prev, [replaceMediaId]: false }));
      }
    }

    await performMediaUpload(statusId, files, mediaType, setEditUploadingMedia, setEditUploadProgress);
    setReplacingMediaId(null);
  };

  // Perform actual media upload
  const performMediaUpload = async (
    statusId: number,
    files: FileList | File[],
    mediaType: 'photo' | 'video',
    setUploading: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
    setProgress: React.Dispatch<React.SetStateAction<Record<number, number>>>
  ) => {

    try {
      setUploading((prev: Record<number, boolean>) => ({ ...prev, [statusId]: true }));
      setProgress((prev: Record<number, number>) => ({ ...prev, [statusId]: 0 }));
      setError(null);
      setErrorStatusId(null);

      const formData = new FormData();
      formData.append('dailyStatusId', statusId.toString());
      formData.append('mediaType', mediaType);

      const filesToUpload = Array.isArray(files) ? files : Array.from(files);
      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append('files', filesToUpload[i]);
      }

      // Pass progress callback
      await apiService.uploadDailyStatusMedia(formData, (progress) => {
        setProgress((prev: Record<number, number>) => ({ ...prev, [statusId]: progress }));
      });
      
      setSuccessMessage(`${mediaType}(s) uploaded successfully!`);
      setSuccessStatusId(statusId);
      
      // Refresh media for this status
      await fetchMediaForStatus(statusId);
      setShowMediaUpload(null);
      setCameraOpenForStatus(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload media';
      setError(errorMsg);
      setErrorStatusId(statusId);
    } finally {
      setUploading((prev: Record<number, boolean>) => ({ ...prev, [statusId]: false }));
      setProgress((prev: Record<number, number>) => ({ ...prev, [statusId]: 0 }));
    }
  };

  // Handle media deletion
  const handleDeleteMedia = async (mediaId: number, statusId: number) => {
    try {
      setDeletingMedia(prev => ({ ...prev, [mediaId]: true }));
      setError(null);
      setErrorStatusId(null);

      await apiService.deleteDailyStatusMedia(mediaId);
      setSuccessMessage('Media deleted successfully!');
      setSuccessStatusId(statusId);
      
      // Refresh media for this status
      await fetchMediaForStatus(statusId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete media';
      setError(errorMsg);
      setErrorStatusId(statusId);
    } finally {
      setDeletingMedia(prev => ({ ...prev, [mediaId]: false }));
    }
  };

  // Open fullscreen view
  const handleOpenFullscreen = useCallback((media: MediaFile, statusId: number) => {
    setFullscreenMedia(media);
    setFullscreenStatusId(statusId);
    setFullscreenMediaType(media.mediaType as 'photo' | 'video');
    setFullscreenOpen(true);
  }, []);

  // Close fullscreen view
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenOpen(false);
    setFullscreenMedia(null);
    setFullscreenStatusId(null);
    setFullscreenMediaType(null);
  }, []);

  // Navigate to previous media in fullscreen
  const handlePreviousMedia = useCallback(() => {
    if (!fullscreenMedia || !fullscreenStatusId || !fullscreenMediaType) return;
    const allMedia = (mediaFiles[fullscreenStatusId] || []).filter(m => m.mediaType === fullscreenMediaType);
    const currentIndex = allMedia.findIndex(m => m.id === fullscreenMedia.id);
    if (currentIndex > 0) {
      setFullscreenMedia(allMedia[currentIndex - 1]);
    }
  }, [fullscreenMedia, fullscreenStatusId, fullscreenMediaType, mediaFiles]);

  // Navigate to next media in fullscreen
  const handleNextMedia = useCallback(() => {
    if (!fullscreenMedia || !fullscreenStatusId || !fullscreenMediaType) return;
    const allMedia = (mediaFiles[fullscreenStatusId] || []).filter(m => m.mediaType === fullscreenMediaType);
    const currentIndex = allMedia.findIndex(m => m.id === fullscreenMedia.id);
    if (currentIndex < allMedia.length - 1) {
      setFullscreenMedia(allMedia[currentIndex + 1]);
    }
  }, [fullscreenMedia, fullscreenStatusId, fullscreenMediaType, mediaFiles]);

  // Handle keyboard for fullscreen (ESC, arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fullscreenOpen) return;
      
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousMedia();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextMedia();
      }
    };
    if (fullscreenOpen) {
      // Prevent body scroll on mobile when fullscreen is open
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [fullscreenOpen, fullscreenMedia, fullscreenStatusId, fullscreenMediaType]);

  // Delete status
  const handleDelete = useCallback(async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteDailyStatus(id);
      setSuccessMessage('Daily status deleted successfully!');
      setSuccessStatusId(id);
      setShowDeleteConfirm(null);
      fetchStatuses();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete daily status';
      setError(errorMsg);
      setErrorStatusId(id);
    } finally {
      setLoading(false);
    }
  }, []);

  // Edit status
  const handleEdit = useCallback((status: DailyStatus) => {
    setEditingStatus(status);
    setFormData({
      date: status.date.split('T')[0],
      roomStatus: status.roomStatus || '',
      waterLevelStatus: status.waterLevelStatus || ''
    });
    setShowForm(true);
  }, []);

  // Memoize filtered and sorted statuses
  const filteredStatuses = useMemo(() => {
    return statuses.filter(s => {
      // Search filter
      const searchMatch = !searchQuery || 
        s.roomStatus?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.waterLevelStatus?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        new Date(s.date).toLocaleDateString().includes(searchQuery);
      
      // Date range filter
      const statusDate = getDateOnlyValue(String(s.date));
      const dateMatch = (!filterFromDate || statusDate >= filterFromDate) &&
                        (!filterToDate || statusDate <= filterToDate);
      
      return searchMatch && dateMatch;
    }).sort((a, b) => {
      return sortBy === 'id-desc' ? b.id - a.id : a.id - b.id;
    });
  }, [statuses, searchQuery, filterFromDate, filterToDate, sortBy]);

  // Paginated statuses for lazy loading
  const paginatedStatuses = useMemo(() => {
    return filteredStatuses.slice(0, visibleCount);
  }, [filteredStatuses, visibleCount]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, filterFromDate, filterToDate, sortBy]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCountRef.current < filteredStatuses.length) {
          console.log('Loading more items...');
          setVisibleCount(prev => Math.min(prev + itemsPerPage, filteredStatuses.length));
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [filteredStatuses.length, itemsPerPage]);

  const isImageFile = useCallback((mimeType: string | undefined) => {
    return mimeType?.startsWith('image/') ?? false;
  }, []);

  return (
    <div className="management-container daily-status-container">
      <h2 className="section-heading">Daily Status</h2>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search statuses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <div className="date-filter-group">
          <input
            type="date"
            value={filterFromDate}
            onChange={(e) => setFilterFromDate(e.target.value)}
            className="date-input"
            title="Filter from date"
          />
          <span className="date-separator">to</span>
          <input
            type="date"
            value={filterToDate}
            onChange={(e) => setFilterToDate(e.target.value)}
            className="date-input"
            title="Filter to date"
          />
          {(filterFromDate || filterToDate) && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setFilterFromDate('');
                setFilterToDate('');
              }}
              title="Clear date filter"
            >
              Clear Dates
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="sort-select"
        >
          <option value="id-desc">ID Descending</option>
          <option value="id-asc">ID Ascending</option>
        </select>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingStatus(null);
            setFormData({
              date: getLocalDateInputValue(),
              roomStatus: '',
              waterLevelStatus: ''
            });
            setCreateMediaType('photo');
            setCreateMediaFiles([]);
            setCreateCameraOpen(false);
            setShowForm(true);
          }}
        >
          + Add Status
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h3>{editingStatus ? 'Edit Daily Status' : 'Add New Daily Status'}</h3>
          <form onSubmit={handleSubmit}>
            <input
              type="date"
              value={formData.date}
              onChange={handleDateChange}
              required
            />
            <textarea
              placeholder="Room Status"
              value={formData.roomStatus}
              onChange={handleRoomStatusChange}
              rows={3}
            />
            <textarea
              placeholder="Water Level Status"
              value={formData.waterLevelStatus}
              onChange={handleWaterLevelStatusChange}
              rows={3}
            />

            {!editingStatus && (
              <div className="media-upload-form">
                <div className="form-group">
                  <label>Media Type:</label>
                  <select
                    value={createMediaType}
                    onChange={(e) => {
                      setCreateMediaType(e.target.value as 'photo' | 'video');
                      setCreateMediaFiles([]);
                      setCreateCameraOpen(false);
                    }}
                  >
                    <option value="photo">Photo</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="create-status-media-input" className="btn btn-sm btn-primary">
                    Upload Media
                  </label>
                  <input
                    id="create-status-media-input"
                    type="file"
                    multiple
                    accept={createMediaType === 'photo' ? 'image/*' : 'video/*'}
                    onChange={(e) => handleCreateMediaFilesChange(e.target.files)}
                    style={{ display: 'none' }}
                  />
                  {createMediaFiles.length > 0 && (
                    <>
                      <p className="progress-text">{createMediaFiles.length} file(s) selected</p>
                      <div className="selected-files-list">
                        {createMediaFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="selected-file-item">
                            <span className="selected-file-name" title={file.name}>{file.name}</span>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger selected-file-remove"
                              onClick={() => handleRemoveCreateMediaFile(index)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="camera-toggle-row">
                  <button
                    type="button"
                    className="btn btn-sm btn-info"
                    onClick={() => setCreateCameraOpen((prev) => !prev)}
                    disabled={loading}
                  >
                    {createCameraOpen ? 'Hide Live Camera' : 'Use Live Camera'}
                  </button>
                </div>

                {createCameraOpen && (
                  <LiveCameraCapture
                    mediaType={createMediaType}
                    disabled={loading}
                    onCaptureReady={handleCreateCapturedMedia}
                  />
                )}
              </div>
            )}

            {/* Upload progress for create form */}
            {!editingStatus && creatingStatusId !== null && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress[creatingStatusId] || 0}%` }}
                  />
                </div>
                <p className="progress-text">{uploadProgress[creatingStatusId] || 0}% Uploaded</p>
              </div>
            )}

            {/* Media Management Section in Edit Form */}
            <FormMediaSection
              editingStatus={editingStatus}
              mediaFiles={mediaFiles}
              editDeletingMedia={editDeletingMedia}
              replacingMediaId={replacingMediaId}
              editUploadingMedia={editUploadingMedia}
              editUploadProgress={editUploadProgress}
              onReplacingMediaIdChange={handleReplacingMediaIdChange}
              onDeleteMedia={handleDeleteMedia}
              onEditMediaUpload={handleEditMediaUpload}
              isImageFile={isImageFile}
            />
            
            <div className="form-buttons">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Saving...' : 'Save Status'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setCreateMediaType('photo');
                  setCreateMediaFiles([]);
                  setCreateCameraOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"></div>
      ) : filteredStatuses.length === 0 ? (
        <div className="no-results-message">
          <p>No daily statuses found for the selected filters.</p>
        </div>
      ) : (
        <>
          <div ref={listTopRef} />
          <StatusList
            filteredStatuses={paginatedStatuses}
            loading={loading}
            mediaFiles={mediaFiles}
            successMessage={successMessage}
            successStatusId={successStatusId}
            error={error}
            errorStatusId={errorStatusId}
            deletingMedia={deletingMedia}
            uploadingMedia={uploadingMedia}
            uploadProgress={uploadProgress}
            selectedMediaType={selectedMediaType}
            showMediaUpload={showMediaUpload}
            cameraOpenForStatus={cameraOpenForStatus}
            isAdmin={isAdmin}
            onMediaTypeChange={handleMediaTypeChange}
            onMediaUpload={handleMediaUpload}
            onCapturedMediaUpload={handleCapturedMediaUpload}
            onToggleCamera={handleToggleCamera}
            onShowMediaUpload={handleShowMediaUpload}
            onDeleteMedia={handleDeleteMedia}
            onEdit={handleEdit}
            onDelete={setShowDeleteConfirm}
            onOpenFullscreen={handleOpenFullscreen}
            isImageFile={isImageFile}
          />
        </>
      )}

      {/* Sentinel element for lazy loading - always rendered */}
      {filteredStatuses.length > 0 && (
        <div ref={sentinelRef} className="lazy-loading-sentinel">
          {visibleCount < filteredStatuses.length ? (
            <p className="lazy-loading-message">⬇️ Scroll down to load more...</p>
          ) : (
            <p className="lazy-loading-message">✓ All items loaded</p>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this daily status? This will also delete all associated media files.</p>
            <div className="modal-buttons">
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Media Modal with Thumbnails */}
      {fullscreenOpen && fullscreenMedia && fullscreenStatusId && fullscreenMediaType && (
        <div className="fullscreen-overlay" onClick={handleCloseFullscreen}>
          <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="fullscreen-close" 
              onClick={handleCloseFullscreen} 
              title="Close (or press ESC)"
              aria-label="Close fullscreen"
            >
              ✕
            </button>
            
            {/* Main Media Display */}
            <div className="fullscreen-main-container">
              {fullscreenMedia.mediaType === 'photo' ? (
                <img 
                  src={getFileUrl(fullscreenMedia.filePath)} 
                  alt={fullscreenMedia.fileName}
                  className="fullscreen-content"
                  loading="lazy"
                />
              ) : (
                <video 
                  className="fullscreen-content"
                  controls
                  autoPlay
                  controlsList="nodownload"
                >
                  <source src={getFileUrl(fullscreenMedia.filePath)} type={fullscreenMedia.mimeType || 'video/mp4'} />
                  Your browser does not support the video tag.
                </video>
              )}
              
              {/* Navigation Arrows */}
              {(() => {
                const allMedia = (mediaFiles[fullscreenStatusId] || []).filter(m => m.mediaType === fullscreenMediaType);
                return allMedia.length > 1 ? (
                  <>
                    <button 
                      className="fullscreen-nav-prev" 
                      onClick={handlePreviousMedia}
                      title="Previous (or ← arrow key)"
                      aria-label="Previous media"
                    >
                      ‹
                    </button>
                    <button 
                      className="fullscreen-nav-next" 
                      onClick={handleNextMedia}
                      title="Next (or → arrow key)"
                      aria-label="Next media"
                    >
                      ›
                    </button>
                  </>
                ) : null;
              })()}
            </div>
            
            {/* Info Section */}
            <div className="fullscreen-info">
              <p>{fullscreenMedia.fileName}</p>
            </div>

            {/* Thumbnail Gallery */}
            {(() => {
              const allMedia = (mediaFiles[fullscreenStatusId] || []).filter(m => m.mediaType === fullscreenMediaType);
              return allMedia.length > 1 ? (
                <div className="fullscreen-thumbnails">
                  {allMedia.map(media => (
                    <div
                      key={media.id}
                      className={`fullscreen-thumbnail ${media.id === fullscreenMedia.id ? 'active' : ''}`}
                      onClick={() => setFullscreenMedia(media)}
                      title={media.fileName}
                    >
                      {media.mediaType === 'photo' && isImageFile(media.mimeType) ? (
                        <img 
                          src={getFileUrl(media.filePath)} 
                          alt={media.fileName}
                        />
                      ) : (
                        <video>
                          <source src={getFileUrl(media.filePath)} type={media.mimeType || 'video/mp4'} />
                        </video>
                      )}
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

