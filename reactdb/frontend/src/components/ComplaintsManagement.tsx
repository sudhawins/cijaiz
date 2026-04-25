import React, { useState, useEffect, useMemo } from 'react';
import { apiService, getComplaintFileUrl } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './ComplaintsManagement.css';

interface Room {
  id: number;
  number: string;
  rent: number;
}

interface ComplaintType {
  id: number;
  type: string;
}

interface ComplaintStatus {
  id: number;
  status: string;
}

interface Complaint {
  id: number;
  description: string;
  complaintTypeId: number;
  complaintTypeName: string;
  complaintStatusId: number;
  complaintStatusName: string;
  closedDate: string | null;
  closureComments: string | null;
  createdDate: string;
  updatedDate: string | null;
  roomId: number;
  roomNumber: string;
  charges: number | null;
  chargesDetails: string | null;
  proof1Url: string | null;
  proof2Url: string | null;
  videoUrl: string | null;
}

export const ComplaintsManagement: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<ComplaintType[]>([]);
  const [statuses, setStatuses] = useState<ComplaintStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal and form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingComplaintId, setEditingComplaintId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    complaintTypeId: '',
    complaintStatusId: '',
    roomId: '',
    charges: '',
    chargesDetails: '',
    proof1Url: '',
    proof2Url: '',
    videoUrl: '',
    closedDate: '',
    closureComments: ''
  });

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState({
    proof1: null as File | null,
    proof2: null as File | null,
    video: null as File | null
  });
  const [filePreview, setFilePreview] = useState({
    proof1: null as string | null,
    proof2: null as string | null,
    video: null as string | null
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRoomId, setFilterRoomId] = useState('');
  const [filterTypeId, setFilterTypeId] = useState('');
  const [filterStatusId, setFilterStatusId] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [previewModal, setPreviewModal] = useState<{ type: 'image' | 'video', url: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [complaintsRes, roomsRes, typesRes, statusesRes] = await Promise.all([
        apiService.getComplaints(),
        apiService.getRooms(),
        apiService.getComplaintTypes(),
        apiService.getComplaintStatuses()
      ]);

      setComplaints(complaintsRes.data || []);
      setRooms((roomsRes.data || []).map((r: any) => ({
        id: r.id,
        number: r.number,
        rent: r.rent
      })));
      setTypes((typesRes.data || []).map((t: any) => ({
        id: t.id,
        type: t.type
      })));
      setStatuses((statusesRes.data || []).map((s: any) => ({
        id: s.id,
        status: s.status
      })));
      setError(null);
    } catch (err) {
      setError('Failed to load complaints data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      complaintTypeId: '',
      complaintStatusId: '',
      roomId: '',
      charges: '',
      chargesDetails: '',
      proof1Url: '',
      proof2Url: '',
      videoUrl: '',
      closedDate: '',
      closureComments: ''
    });
    setSelectedFiles({
      proof1: null,
      proof2: null,
      video: null
    });
    setFilePreview({
      proof1: null,
      proof2: null,
      video: null
    });
    setEditingComplaintId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (complaint: Complaint) => {
    setFormData({
      description: complaint.description,
      complaintTypeId: complaint.complaintTypeId.toString(),
      complaintStatusId: complaint.complaintStatusId.toString(),
      roomId: complaint.roomId.toString(),
      charges: complaint.charges?.toString() || '',
      chargesDetails: complaint.chargesDetails || '',
      proof1Url: complaint.proof1Url || '',
      proof2Url: complaint.proof2Url || '',
      videoUrl: complaint.videoUrl || '',
      closedDate: complaint.closedDate || '',
      closureComments: complaint.closureComments || ''
    });
    setEditingComplaintId(complaint.id);
    setShowFormModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (fieldName: 'proof1' | 'proof2' | 'video', file: File | null) => {
    console.log(`File selected for ${fieldName}:`, file);
    setSelectedFiles(prev => ({
      ...prev,
      [fieldName]: file
    }));

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        console.log(`File preview loaded for ${fieldName}, size:`, result.length);
        setFilePreview(prev => ({
          ...prev,
          [fieldName]: result
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(prev => ({
        ...prev,
        [fieldName]: null
      }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let proof1Url = formData.proof1Url;
      let proof2Url = formData.proof2Url;
      let videoUrl = formData.videoUrl;

      // Upload files if selected
      if (selectedFiles.proof1 || selectedFiles.proof2 || selectedFiles.video) {
        const formDataToUpload = new FormData();
        
        console.log('[Form] Files to upload:', {
          proof1: selectedFiles.proof1?.name,
          proof2: selectedFiles.proof2?.name,
          video: selectedFiles.video?.name
        });

        if (selectedFiles.proof1) {
          formDataToUpload.append('proof1', selectedFiles.proof1);
          console.log('[Form] Added proof1:', selectedFiles.proof1.name, selectedFiles.proof1.size, 'bytes');
        }
        if (selectedFiles.proof2) {
          formDataToUpload.append('proof2', selectedFiles.proof2);
          console.log('[Form] Added proof2:', selectedFiles.proof2.name, selectedFiles.proof2.size, 'bytes');
        }
        if (selectedFiles.video) {
          formDataToUpload.append('video', selectedFiles.video);
          console.log('[Form] Added video:', selectedFiles.video.name, selectedFiles.video.size, 'bytes');
        }

        try {
          console.log('[Form] Sending upload request...');
          const uploadResponse = await apiService.uploadComplaintFiles(formDataToUpload);
          console.log('[Form] Upload response received:', uploadResponse);
          
          if (uploadResponse.data?.files) {
            if (uploadResponse.data.files.proof1Url) {
              proof1Url = uploadResponse.data.files.proof1Url;
              console.log('[Form] Updated proof1Url:', proof1Url);
            }
            if (uploadResponse.data.files.proof2Url) {
              proof2Url = uploadResponse.data.files.proof2Url;
              console.log('[Form] Updated proof2Url:', proof2Url);
            }
            if (uploadResponse.data.files.videoUrl) {
              videoUrl = uploadResponse.data.files.videoUrl;
              console.log('[Form] Updated videoUrl:', videoUrl);
            }
          }
        } catch (uploadError) {
          console.error('[Form] File upload error:', uploadError);
          setError(`File upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
          return;
        }
      }

      const submitData = {
        description: formData.description,
        complaintTypeId: parseInt(formData.complaintTypeId),
        complaintStatusId: parseInt(formData.complaintStatusId),
        roomId: parseInt(formData.roomId),
        charges: formData.charges ? parseFloat(formData.charges) : 0,
        chargesDetails: formData.chargesDetails || null,
        proof1Url: proof1Url || null,
        proof2Url: proof2Url || null,
        videoUrl: videoUrl || null,
        closedDate: formData.closedDate || null,
        closureComments: formData.closureComments || null
      };

      console.log('[Form] Submitting complaint with:', submitData);

      if (editingComplaintId) {
        await apiService.updateComplaint(editingComplaintId, submitData);
        setSuccessMessage('Complaint updated successfully');
      } else {
        await apiService.createComplaint(submitData);
        setSuccessMessage('Complaint created successfully');
      }

      setShowFormModal(false);
      resetForm();
      await fetchData();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(editingComplaintId ? `Failed to update complaint: ${errorMsg}` : `Failed to create complaint: ${errorMsg}`);
      console.error('[Form] Error:', err);
    }
  };

  const handleDelete = async (complaintId: number) => {
    if (window.confirm('Are you sure you want to delete this complaint?')) {
      try {
        await apiService.deleteComplaint(complaintId);
        setSuccessMessage('Complaint deleted successfully');
        await fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setError('Failed to delete complaint');
        console.error(err);
      }
    }
  };

  const roomOptions = useMemo(
    () => rooms.map(r => ({ id: r.id, label: `Room ${r.number}` })),
    [rooms]
  );

  const typeOptions = useMemo(
    () => types.map(t => ({ id: t.id, label: t.type })),
    [types]
  );

  const statusOptions = useMemo(
    () => statuses.map(s => ({ id: s.id, label: s.status })),
    [statuses]
  );

  const filteredComplaints = useMemo(() => {
    return complaints.filter(complaint => {
      const matchesSearch = 
        complaint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        complaint.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        complaint.complaintTypeName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRoom = !filterRoomId || complaint.roomId.toString() === filterRoomId;
      const matchesType = !filterTypeId || complaint.complaintTypeId.toString() === filterTypeId;
      const matchesStatus = !filterStatusId || complaint.complaintStatusId.toString() === filterStatusId;

      const complaintDate = new Date(complaint.createdDate);
      const matchesFromDate = !filterFromDate || complaintDate >= new Date(filterFromDate);
      const matchesToDate = !filterToDate || complaintDate <= new Date(filterToDate);

      return matchesSearch && matchesRoom && matchesType && matchesStatus && 
             matchesFromDate && matchesToDate;
    });
  }, [complaints, searchTerm, filterRoomId, filterTypeId, filterStatusId, filterFromDate, filterToDate]);

  const stats = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter(c => c.complaintStatusName === 'Open').length,
    closed: complaints.filter(c => c.complaintStatusName === 'Closed').length,
    inProgress: complaints.filter(c => c.complaintStatusName === 'In Progress').length,
    totalCharges: complaints.reduce((sum, c) => sum + (c.charges || 0), 0)
  }), [complaints]);

  const formatCurrency = (amount: number | null): string => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterRoomId('');
    setFilterTypeId('');
    setFilterStatusId('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  if (loading) {
    return <div className="complaints-container"><div className="loading">Loading complaints...</div></div>;
  }

  if (error) {
    return <div className="complaints-container"><div className="error">{error}</div></div>;
  }

  return (
    <div className="complaints-container">
      <h2 className="section-heading">Complaints</h2>
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      <div className="complaints-header">
        <h2>Complaints Management</h2>
        <button className="btn-primary" onClick={openCreateModal}>
          ➕ Create New Complaint
        </button>
      </div>
      <div className="complaints-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Complaints</div>
        </div>
        <div className="stat-card open">
          <div className="stat-value">{stats.open}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card in-progress">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card closed">
          <div className="stat-value">{stats.closed}</div>
          <div className="stat-label">Closed</div>
        </div>
        <div className="stat-card charges">
          <div className="stat-value">{formatCurrency(stats.totalCharges)}</div>
          <div className="stat-label">Total Charges</div>
        </div>
      </div>

      <div className="complaints-filters">
        <div className="filter-header">
          <h3>Filters & Search</h3>
          <button className="clear-btn" onClick={clearFilters}>Clear All</button>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by description, room, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-grid">
          <SearchableDropdown
            label="Room"
            value={filterRoomId ? parseInt(filterRoomId) : null}
            onChange={(option) => setFilterRoomId(option.id.toString())}
            options={roomOptions}
            placeholder="All Rooms"
          />

          <SearchableDropdown
            label="Complaint Type"
            value={filterTypeId ? parseInt(filterTypeId) : null}
            onChange={(option) => setFilterTypeId(option.id.toString())}
            options={typeOptions}
            placeholder="All Types"
          />

          <SearchableDropdown
            label="Status"
            value={filterStatusId ? parseInt(filterStatusId) : null}
            onChange={(option) => setFilterStatusId(option.id.toString())}
            options={statusOptions}
            placeholder="All Statuses"
          />

          <div className="date-filter">
            <label>From Date</label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
            />
          </div>

          <div className="date-filter">
            <label>To Date</label>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="results-count">
          Showing {filteredComplaints.length} of {complaints.length} complaints
        </div>
      </div>

      <div className="complaints-table-wrapper">
        <table className="complaints-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Room</th>
              <th>Description</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Closed Date</th>
              <th>Charges</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredComplaints.length > 0 ? (
              filteredComplaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.id}</td>
                  <td className="room-cell">Room {complaint.roomNumber}</td>
                  <td className="description-cell" title={complaint.description}>
                    {complaint.description.substring(0, 50)}...
                  </td>
                  <td>{complaint.complaintTypeName}</td>
                  <td>
                    <span className={`status-badge ${complaint.complaintStatusName.toLowerCase()}`}>
                      {complaint.complaintStatusName}
                    </span>
                  </td>
                  <td>{formatDate(complaint.createdDate)}</td>
                  <td>{complaint.closedDate ? formatDate(complaint.closedDate) : '-'}</td>
                  <td className="charges-cell">{formatCurrency(complaint.charges)}</td>
                  <td className="details-cell">
                    <div className="proof-icons">
                      {complaint.proof1Url && (
                        <button
                          className="proof-link"
                          onClick={() => setPreviewModal({ type: 'image', url: complaint.proof1Url as string })}
                          title="Preview Proof 1"
                        >
                          📷
                        </button>
                      )}
                      {complaint.proof2Url && (
                        <button
                          className="proof-link"
                          onClick={() => setPreviewModal({ type: 'image', url: complaint.proof2Url as string })}
                          title="Preview Proof 2"
                        >
                          📷
                        </button>
                      )}
                      {complaint.videoUrl && (
                        <button
                          className="proof-link"
                          onClick={() => setPreviewModal({ type: 'video', url: complaint.videoUrl as string })}
                          title="Preview Video"
                        >
                          🎥
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-action btn-edit"
                      onClick={() => openEditModal(complaint)}
                      title="Edit complaint"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(complaint.id)}
                      title="Delete complaint"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="no-data">
                  No complaints found matching your criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="badge open-badge">Open</span>
            <span>Complaint opened and awaiting action</span>
          </div>
          <div className="legend-item">
            <span className="badge in-progress-badge">In Progress</span>
            <span>Complaint is being worked on</span>
          </div>
          <div className="legend-item">
            <span className="badge closed-badge">Closed</span>
            <span>Complaint resolved and closed</span>
          </div>
        </div>
      </div>

      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingComplaintId ? 'Edit Complaint' : 'Create New Complaint'}</h3>
              <button className="modal-close" onClick={() => setShowFormModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="complaint-form">
              <div className="form-grid">
                <SearchableDropdown
                  label="Room"
                  value={formData.roomId ? parseInt(formData.roomId) : null}
                  onChange={(option) => setFormData(prev => ({ ...prev, roomId: option.id.toString() }))}
                  options={roomOptions}
                  placeholder="Select a room"
                />

                <SearchableDropdown
                  label="Complaint Type"
                  value={formData.complaintTypeId ? parseInt(formData.complaintTypeId) : null}
                  onChange={(option) => setFormData(prev => ({ ...prev, complaintTypeId: option.id.toString() }))}
                  options={typeOptions}
                  placeholder="Select type"
                />

                <SearchableDropdown
                  label="Status"
                  value={formData.complaintStatusId ? parseInt(formData.complaintStatusId) : null}
                  onChange={(option) => setFormData(prev => ({ ...prev, complaintStatusId: option.id.toString() }))}
                  options={statusOptions}
                  placeholder="Select status"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Enter detailed complaint description"
                  rows={4}
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="charges">Charges ($)</label>
                  <input
                    type="number"
                    id="charges"
                    name="charges"
                    value={formData.charges}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="closedDate">Closed Date</label>
                  <input
                    type="date"
                    id="closedDate"
                    name="closedDate"
                    value={formData.closedDate}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="chargesDetails">Charges Details</label>
                <textarea
                  id="chargesDetails"
                  name="chargesDetails"
                  value={formData.chargesDetails}
                  onChange={handleFormChange}
                  placeholder="Enter details about charges"
                  rows={2}
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="closureComments">Closure Comments</label>
                <textarea
                  id="closureComments"
                  name="closureComments"
                  value={formData.closureComments}
                  onChange={handleFormChange}
                  placeholder="Enter closure comments if complaint is closed"
                  rows={2}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="proof1">Proof 1 (Image)</label>
                  <input
                    type="file"
                    id="proof1"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      console.log('proof1 input changed, file:', file);
                      handleFileChange('proof1', file || null);
                    }}
                  />
                  {selectedFiles.proof1 && (
                    <div style={{ color: 'blue', fontSize: '12px', marginTop: '4px' }}>
                      Selected: {selectedFiles.proof1.name}
                    </div>
                  )}
                  {filePreview.proof1 && (
                    <div className="file-preview" style={{ border: '2px solid green' }}>
                      <img src={filePreview.proof1} alt="Proof 1 preview" style={{ maxWidth: '100px', maxHeight: '100px' }} />
                      <p style={{ fontSize: '11px', color: 'green' }}>Preview loaded</p>
                    </div>
                  )}
                  {formData.proof1Url && !filePreview.proof1 && (
                    <div className="file-preview" style={{ border: '2px solid blue' }}>
                      <img src={getComplaintFileUrl(formData.proof1Url)} alt="Proof 1" style={{ maxWidth: '100px', maxHeight: '100px' }} />
                      <p style={{ fontSize: '11px', color: 'blue' }}>Existing file: {formData.proof1Url}</p>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="proof2">Proof 2 (Image)</label>
                  <input
                    type="file"
                    id="proof2"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      console.log('proof2 input changed, file:', file);
                      handleFileChange('proof2', file || null);
                    }}
                  />
                  {selectedFiles.proof2 && (
                    <div style={{ color: 'blue', fontSize: '12px', marginTop: '4px' }}>
                      Selected: {selectedFiles.proof2.name}
                    </div>
                  )}
                  {filePreview.proof2 && (
                    <div className="file-preview" style={{ border: '2px solid green' }}>
                      <img src={filePreview.proof2} alt="Proof 2 preview" style={{ maxWidth: '100px', maxHeight: '100px' }} />
                      <p style={{ fontSize: '11px', color: 'green' }}>Preview loaded</p>
                    </div>
                  )}
                  {formData.proof2Url && !filePreview.proof2 && (
                    <div className="file-preview" style={{ border: '2px solid blue' }}>
                      <img src={getComplaintFileUrl(formData.proof2Url)} alt="Proof 2" style={{ maxWidth: '100px', maxHeight: '100px' }} />
                      <p style={{ fontSize: '11px', color: 'blue' }}>Existing file: {formData.proof2Url}</p>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="video">Video</label>
                  <input
                    type="file"
                    id="video"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      console.log('video input changed, file:', file);
                      handleFileChange('video', file || null);
                    }}
                  />
                  {selectedFiles.video && (
                    <div style={{ color: 'blue', fontSize: '12px', marginTop: '4px' }}>
                      Selected: {selectedFiles.video.name}
                    </div>
                  )}
                  {filePreview.video && (
                    <div className="file-preview" style={{ border: '2px solid green' }}>
                      <video style={{ maxWidth: '100px', maxHeight: '100px' }} controls>
                        <source src={filePreview.video} />
                      </video>
                      <p style={{ fontSize: '11px', color: 'green' }}>Preview loaded</p>
                    </div>
                  )}
                  {formData.videoUrl && !filePreview.video && (
                    <div className="file-preview" style={{ border: '2px solid blue' }}>
                      <video style={{ maxWidth: '100px', maxHeight: '100px' }} controls>
                        <source src={getComplaintFileUrl(formData.videoUrl)} />
                      </video>
                      <p style={{ fontSize: '11px', color: 'blue' }}>Existing file: {formData.videoUrl}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">
                  {editingComplaintId ? 'Update Complaint' : 'Create Complaint'}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowFormModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewModal && (
        <div className="modal-overlay" onClick={() => setPreviewModal(null)}>
          <div className="modal-content preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewModal.type === 'image' ? 'Image Preview' : 'Video Preview'}</h3>
              <button className="modal-close" onClick={() => setPreviewModal(null)}>✕</button>
            </div>
            <div className="preview-container">
              {previewModal.type === 'image' ? (
                <img src={getComplaintFileUrl(previewModal.url)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '70vh' }} />
              ) : (
                <video style={{ maxWidth: '100%', maxHeight: '70vh' }} controls>
                  <source src={getComplaintFileUrl(previewModal.url)} />
                </video>
              )}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <a href={getComplaintFileUrl(previewModal.url)} download target="_blank" rel="noopener noreferrer" className="btn-primary">
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsManagement;
