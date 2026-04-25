import { useState, useRef, useMemo, useEffect } from 'react';
import { apiService, getFileUrl } from '../api';
import { TenantWithOccupancy } from './TenantManagement';
import './TenantForm.css';
import './ManagementStyles.css';

interface TenantFormProps {
  tenant?: TenantWithOccupancy | null;
  onSubmit: (data: Omit<TenantWithOccupancy, 'id'>) => Promise<void>;
  onCancel: () => void;
  cardMode?: boolean;
}

interface FilePreview {
  file: File;
  preview: string;
  name: string;
}

interface ExistingFile {
  url: string;
  field: string; // 'photoUrl', 'photo2Url', etc.
}

const MAX_PHOTOS = 10;
const MAX_PROOFS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function TenantForm({ tenant, onSubmit, onCancel, cardMode = false }: TenantFormProps) {
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    phone: tenant?.phone || '',
    address: tenant?.address || '',
    city: tenant?.city || '',
    roomId: '',
    roomIds: [] as string[],
    checkInDate: '',
  });

  const [photos, setPhotos] = useState<FilePreview[]>([]);
  const [proofs, setProofs] = useState<FilePreview[]>([]);
  const [deletedPhotoFields, setDeletedPhotoFields] = useState<Set<string>>(new Set());
  const [deletedProofFields, setDeletedProofFields] = useState<Set<string>>(new Set());
  const [replacementPhotos, setReplacementPhotos] = useState<Map<string, FilePreview>>(new Map());
  const [replacementProofs, setReplacementProofs] = useState<Map<string, FilePreview>>(new Map());
  const [replacingPhotoField, setReplacingPhotoField] = useState<string | null>(null);
  const [replacingProofField, setReplacingProofField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Phone validation states
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  const [existingTenantName, setExistingTenantName] = useState<string | null>(null);
  const phoneCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // City search states
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const citySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const citySuggestionsRef = useRef<HTMLDivElement>(null);
  
  // Room selection states
  const [vacantRooms, setVacantRooms] = useState<Array<{id: number; number: string; rent: number; beds: number; lastCheckOutDate?: string | null; lastTenantName?: string | null; lastTenantPhone?: string | null; daysVacant?: number | null; vacancyStatus?: string}>>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);
  const replaceProofInputRef = useRef<HTMLInputElement>(null);

  // Get existing photos and proofs
  const existingPhotos = useMemo<ExistingFile[]>(() => {
    if (!tenant) return [];
    return [
      { url: tenant.photoUrl, field: 'photoUrl' },
      { url: tenant.photo2Url, field: 'photo2Url' },
      { url: tenant.photo3Url, field: 'photo3Url' },
      { url: tenant.photo4Url, field: 'photo4Url' },
      { url: tenant.photo5Url, field: 'photo5Url' },
      { url: tenant.photo6Url, field: 'photo6Url' },
      { url: tenant.photo7Url, field: 'photo7Url' },
      { url: tenant.photo8Url, field: 'photo8Url' },
      { url: tenant.photo9Url, field: 'photo9Url' },
      { url: tenant.photo10Url, field: 'photo10Url' },
    ].filter((item): item is ExistingFile => !!item.url);
  }, [tenant]);

  const existingProofs = useMemo<ExistingFile[]>(() => {
    if (!tenant) return [];
    return [
      { url: tenant.proof1Url, field: 'proof1Url' },
      { url: tenant.proof2Url, field: 'proof2Url' },
      { url: tenant.proof3Url, field: 'proof3Url' },
      { url: tenant.proof4Url, field: 'proof4Url' },
      { url: tenant.proof5Url, field: 'proof5Url' },
      { url: tenant.proof6Url, field: 'proof6Url' },
      { url: tenant.proof7Url, field: 'proof7Url' },
      { url: tenant.proof8Url, field: 'proof8Url' },
      { url: tenant.proof9Url, field: 'proof9Url' },
      { url: tenant.proof10Url, field: 'proof10Url' },
    ].filter((item): item is ExistingFile => !!item.url);
  }, [tenant]);

  // Reset form when tenant changes (for edit mode switching between different tenants)
  useEffect(() => {
    setFormData({
      name: tenant?.name || '',
      phone: tenant?.phone || '',
      address: tenant?.address || '',
      city: tenant?.city || '',
      roomId: tenant?.roomId ? String(tenant.roomId) : '',
      roomIds: tenant?.roomId ? [String(tenant.roomId)] : [],
      checkInDate: tenant?.checkInDate || '',
    });
    setPhotos([]);
    setProofs([]);
    setDeletedPhotoFields(new Set());
    setDeletedProofFields(new Set());
    setReplacementPhotos(new Map());
    setReplacementProofs(new Map());
    setReplacingPhotoField(null);
    setReplacingProofField(null);
    setError(null);
    setUploadProgress(0);
    setPhoneError(null);
    setPhoneExists(false);
    setIsCheckingPhone(false);
    setExistingTenantName(null);
  }, [tenant?.id]); // Only reset when tenant ID changes

  // Fetch vacant rooms on component mount
  useEffect(() => {
    const fetchVacantRooms = async () => {
      try {
        // console.log('[TenantForm] Fetching vacant rooms...');
        setIsLoadingRooms(true);
        const response = await apiService.getVacantRooms();
        // console.log('[TenantForm] Vacant rooms response:', response);
        // console.log('[TenantForm] Vacant rooms data:', response.data);
        
        let rooms = response.data || [];
        
        // If editing a tenant with current occupancy, include their current room in the list
        if (tenant?.id && tenant?.roomNumber && tenant?.roomId) {
          const currentRoomExists = rooms.some((r: any) => r.id === tenant.roomId);
          if (!currentRoomExists) {
            // Add current room to the list so tenant can keep it selected
            rooms = [{
              id: tenant.roomId,
              number: tenant.roomNumber,
              rent: tenant.rentFixed || 0,
              beds: 1, // Default value
              lastCheckOutDate: null,
              lastTenantName: tenant.name,
              lastTenantPhone: tenant.phone,
              daysVacant: 0,
              vacancyStatus: 'Currently Occupied',
            }, ...rooms];
          }
        }
        
        setVacantRooms(rooms);
        // console.log('[TenantForm] Vacant rooms set:', rooms?.length || 0);
      } catch (err) {
        console.error('[TenantForm] Error fetching vacant rooms:', err);
        if (err instanceof Error) {
          console.error('[TenantForm] Error message:', err.message);
          console.error('[TenantForm] Error stack:', err.stack);
        }
        setVacantRooms([]);
      } finally {
        setIsLoadingRooms(false);
      }
    };
    
    // Fetch for both new tenants and when editing
    // console.log('[TenantForm] Checking if should fetch vacant rooms. tenant?.id:', tenant?.id);
    fetchVacantRooms();
  }, [tenant?.id]);

  // Cleanup phone check timeout on unmount
  useEffect(() => {
    return () => {
      if (phoneCheckTimeoutRef.current) {
        clearTimeout(phoneCheckTimeoutRef.current);
      }
      if (citySearchTimeoutRef.current) {
        clearTimeout(citySearchTimeoutRef.current);
      }
    };
  }, []);

  // Validate phone number format and check database for duplicates
  const validatePhoneNumber = async (phone: string) => {
    setPhoneError(null);
    setPhoneExists(false);
    setExistingTenantName(null);

    // If phone is empty, clear error
    if (!phone.trim()) {
      setPhoneError(null);
      return;
    }

    // Validate phone format
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length === 0) {
      setPhoneError('Please enter at least one digit');
      return;
    }
    if (phoneDigits.length < 10) {
      setPhoneError(`Phone number must be exactly 10 digits (currently ${phoneDigits.length})`);
      return;
    }
    if (phoneDigits.length > 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return;
    }

    // Check database for duplicate (debounced)
    setIsCheckingPhone(true);
    if (phoneCheckTimeoutRef.current) {
      clearTimeout(phoneCheckTimeoutRef.current);
    }

    phoneCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiService.checkPhoneNumber(
          phone.trim(),
          tenant?.id // Exclude current tenant if editing
        );
        if (response.data.exists) {
          const conflictingName = response.data.tenantName?.trim() || 'Unknown Tenant';
          setPhoneError(`Phone number ${phone.trim()} is already registered to ${conflictingName}`);
          setExistingTenantName(conflictingName);
          setPhoneExists(true);
        } else {
          setPhoneError(null);
          setPhoneExists(false);
          setExistingTenantName(null);
        }
      } catch (err) {
        console.error('Error checking phone number:', err);
        // Don't show error for API failures, just log it
      } finally {
        setIsCheckingPhone(false);
      }
    }, 500); // Wait 500ms after user stops typing
  };

  // Search for cities
  const searchCities = async (searchQuery: string) => {
    setCitySuggestions([]);
    
    if (!searchQuery.trim()) {
      setShowCitySuggestions(false);
      return;
    }

    setIsSearchingCities(true);
    
    if (citySearchTimeoutRef.current) {
      clearTimeout(citySearchTimeoutRef.current);
    }

    citySearchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiService.searchCities(searchQuery.trim());
        if (response.data.cities && response.data.cities.length > 0) {
          setCitySuggestions(response.data.cities);
          setShowCitySuggestions(true);
        } else {
          setCitySuggestions([]);
          setShowCitySuggestions(false);
        }
      } catch (err) {
        console.error('Error searching cities:', err);
        setCitySuggestions([]);
        setShowCitySuggestions(false);
      } finally {
        setIsSearchingCities(false);
      }
    }, 300); // Wait 300ms after user stops typing
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time phone validation
    if (name === 'phone') {
      validatePhoneNumber(value);
    }
    
    // Real-time city search
    if (name === 'city') {
      searchCities(value);
    }
  };

  const handleSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Load check-in date field when room is selected
    if (name === 'roomId' && value) {
      setFormData((prev) => ({
        ...prev,
        checkInDate: new Date().toISOString().split('T')[0],
      }));
    }
  };

  const handleMultiRoomSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedRoomIds = Array.from(e.target.selectedOptions).map((option) => option.value);

    setFormData((prev) => ({
      ...prev,
      roomIds: selectedRoomIds,
      checkInDate: selectedRoomIds.length > 0
        ? (prev.checkInDate || new Date().toISOString().split('T')[0])
        : ''
    }));
  };

  const handleSelectCity = (city: string) => {
    setFormData((prev) => ({
      ...prev,
      city: city,
    }));
    setShowCitySuggestions(false);
    setCitySuggestions([]);
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    if (citySuggestionsRef.current && !citySuggestionsRef.current.contains(e.target as Node)) {
      setShowCitySuggestions(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File ${file.name} exceeds 10MB limit`;
    }
    if (!file.type.startsWith('image/')) {
      return `File ${file.name} is not an image`;
    }
    return null;
  };

  const handlePhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Calculate total current count: existing + new + replacement
    const totalCurrentPhotos = (existingPhotos.length - deletedPhotoFields.size) + photos.length + replacementPhotos.size;

    const newPhotos: FilePreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const projectedTotal = totalCurrentPhotos + newPhotos.length + 1;
      if (projectedTotal > MAX_PHOTOS) {
        setError(`Maximum ${MAX_PHOTOS} photos allowed. You currently have ${totalCurrentPhotos} photos. Cannot add more.`);
        break;
      }

      const file = files[i];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        setPhotos((prev) => [
          ...prev,
          {
            file,
            preview,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleProofsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Calculate total current count: existing + new + replacement
    const totalCurrentProofs = (existingProofs.length - deletedProofFields.size) + proofs.length + replacementProofs.size;

    const newProofs: FilePreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const projectedTotal = totalCurrentProofs + newProofs.length + 1;
      if (projectedTotal > MAX_PROOFS) {
        setError(`Maximum ${MAX_PROOFS} proofs allowed. You currently have ${totalCurrentProofs} proofs. Cannot add more.`);
        break;
      }

      const file = files[i];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        setProofs((prev) => [
          ...prev,
          {
            file,
            preview,
            name: file.name,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    if (proofInputRef.current) {
      proofInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeProof = (index: number) => {
    setProofs((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (field: string) => {
    setDeletedPhotoFields((prev) => new Set([...prev, field]));
  };

  const removeExistingProof = (field: string) => {
    setDeletedProofFields((prev) => new Set([...prev, field]));
  };

  const startReplacingPhoto = (field: string) => {
    setReplacingPhotoField(field);
    replacePhotoInputRef.current?.click();
  };

  const startReplacingProof = (field: string) => {
    setReplacingProofField(field);
    replaceProofInputRef.current?.click();
  };

  const handleReplacePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingPhotoField) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;
      setReplacementPhotos((prev) => new Map(prev).set(replacingPhotoField, {
        file,
        preview,
        name: file.name,
      }));
      setReplacingPhotoField(null);
    };
    reader.readAsDataURL(file);

    if (replacePhotoInputRef.current) {
      replacePhotoInputRef.current.value = '';
    }
  };

  const handleReplaceProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingProofField) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;
      setReplacementProofs((prev) => new Map(prev).set(replacingProofField, {
        file,
        preview,
        name: file.name,
      }));
      setReplacingProofField(null);
    };
    reader.readAsDataURL(file);

    if (replaceProofInputRef.current) {
      replaceProofInputRef.current.value = '';
    }
  };

  const cancelReplacePhoto = (field: string) => {
    setReplacementPhotos((prev) => {
      const newMap = new Map(prev);
      newMap.delete(field);
      return newMap;
    });
  };

  const cancelReplaceProof = (field: string) => {
    setReplacementProofs((prev) => {
      const newMap = new Map(prev);
      newMap.delete(field);
      return newMap;
    });
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.city.trim()) {
      setError('City is required');
      return false;
    }
    if (!formData.address.trim()) {
      setError('Address is required');
      return false;
    }
    // Validate phone format - must be exactly 10 digits
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      setError('Phone number must be exactly 10 digits');
      return false;
    }
    // Check if phone validation errors exist
    if (phoneError) {
      setError(phoneError);
      return false;
    }
    // Check if phone exists in database
    if (phoneExists) {
      const message = existingTenantName 
        ? `Phone number ${formData.phone.trim()} is already registered to ${existingTenantName}`
        : `Phone number ${formData.phone.trim()} already exists in the database`;
      setError(message);
      return false;
    }
    // Validate occupancy fields
    // For NEW tenants: if room is selected, check-in date is required
    if (!tenant?.id && formData.roomId && !formData.checkInDate) {
      setError('Check-in date is required when selecting a room for a new tenant');
      return false;
    }
    // For EXISTING tenants: if assigning rooms, require check-in date
    if (tenant?.id && formData.roomIds.length > 0 && !formData.checkInDate) {
      setError('Check-in date is required when assigning room(s)');
      return false;
    }
    // If check-in date is set but no room is selected on new tenant, error
    if (!tenant?.id && formData.checkInDate && !formData.roomId) {
      setError('Room is required when setting a check-in date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Start with existing file URLs (for edit mode), excluding deleted ones
      // Extract just the filename (blob name) from URLs
      // This ensures old photos are ALWAYS preserved during updates
      let photoUrls: (string | null)[] = [
        tenant?.photoUrl || null,
        tenant?.photo2Url || null,
        tenant?.photo3Url || null,
        tenant?.photo4Url || null,
        tenant?.photo5Url || null,
        tenant?.photo6Url || null,
        tenant?.photo7Url || null,
        tenant?.photo8Url || null,
        tenant?.photo9Url || null,
        tenant?.photo10Url || null,
      ]
        .map((url, idx) => {
          const field = `photo${idx === 0 ? '' : idx + 1}Url`;
          // Keep the existing photo URL unless it was explicitly deleted
          // This guarantees old photos are retained
          if (deletedPhotoFields.has(field)) {
            return null; // Only set to null if user explicitly deleted it
          }
          // Extract just the filename from the URL (everything after the last '/')
          if (url) {
            return url.split('/').pop() || null;
          }
          return null;
        });
      
      console.log('[Tenant Form Submit] Initial photo URLs (with existing preserved):', photoUrls);


      let proofUrls: (string | null)[] = [
        tenant?.proof1Url || null,
        tenant?.proof2Url || null,
        tenant?.proof3Url || null,
        tenant?.proof4Url || null,
        tenant?.proof5Url || null,
        tenant?.proof6Url || null,
        tenant?.proof7Url || null,
        tenant?.proof8Url || null,
        tenant?.proof9Url || null,
        tenant?.proof10Url || null,
      ]
        .map((url, idx) => {
          const field = `proof${idx + 1}Url`;
          // Keep the existing proof URL unless it was explicitly deleted
          // This guarantees old proofs are retained
          if (deletedProofFields.has(field)) {
            return null; // Only set to null if user explicitly deleted it
          }
          // Extract just the filename from the URL (everything after the last '/')
          if (url) {
            return url.split('/').pop() || null;
          }
          return null;
        });
      
      console.log('[Tenant Form Submit] Initial proof URLs (with existing preserved):', proofUrls);

      // Collect files to upload (new photos + replacement photos + new proofs + replacement proofs)
      const filesToUpload = new FormData();
      
      // Add new photos
      photos.forEach((photo) => {
        filesToUpload.append('photos', photo.file);
      });

      // Add replacement photos
      replacementPhotos.forEach((photo) => {
        filesToUpload.append('photos', photo.file);
      });

      // Add new proofs
      proofs.forEach((proof) => {
        filesToUpload.append('proofs', proof.file);
      });

      // Add replacement proofs
      replacementProofs.forEach((proof) => {
        filesToUpload.append('proofs', proof.file);
      });

      // If new/replacement files are provided, upload them
      if (filesToUpload.entries().next().value !== undefined) {
        console.log(`[Tenant ${tenant ? 'Update' : 'Creation'}] Uploading files...`, {
          newPhotoCount: photos.length,
          replacementPhotoCount: replacementPhotos.size,
          newProofCount: proofs.length,
          replacementProofCount: replacementProofs.size,
        });

        try {
          const uploadResponse = await apiService.uploadTenantFiles(filesToUpload, (progress) => {
            setUploadProgress(progress);
          });
          // console.log(`[Tenant ${tenant ? 'Update' : 'Creation'}] Upload response:`, uploadResponse);
          
          if (uploadResponse.data) {
            const uploadedPhotos = uploadResponse.data.photoUrls || [];
            const uploadedProofs = uploadResponse.data.proofUrls || [];
            
            console.log('[Tenant Form Submit] Processing uploaded files:', {
              uploadedPhotos: uploadedPhotos.length,
              uploadedProofs: uploadedProofs.length,
              hasReplacements: replacementPhotos.size > 0,
              hasProofReplacements: replacementProofs.size > 0
            });
            
            // Handle replacement photos - these overwrite at specific positions
            let uploadedPhotoIndex = 0;
            replacementPhotos.forEach((_, field) => {
              // Get the position of the field to replace
              const fieldIndex = parseInt(field.match(/\d+/)?.[0] || '0');
              const position = field === 'photoUrl' ? 0 : fieldIndex - 1;
              
              if (uploadedPhotoIndex < uploadedPhotos.length) {
                // Replace at the correct position
                photoUrls[position] = uploadedPhotos[uploadedPhotoIndex];
                console.log(`[Tenant Form Submit] Replacing photo at position ${position}`);
                uploadedPhotoIndex++;
              }
            });
            
            // Add remaining new photos to first available null slots
            // This preserves existing photos while adding new ones
            while (uploadedPhotoIndex < uploadedPhotos.length) {
              const nullIndex = photoUrls.findIndex((url) => url === null);
              if (nullIndex !== -1) {
                photoUrls[nullIndex] = uploadedPhotos[uploadedPhotoIndex];
                console.log(`[Tenant Form Submit] Adding new photo to position ${nullIndex}`);
                uploadedPhotoIndex++;
              } else {
                console.warn('[Tenant Form Submit] No more empty photo slots available');
                break; // No more null slots available
              }
            }
            
            // Handle replacement proofs - these overwrite at specific positions
            let uploadedProofIndex = 0;
            replacementProofs.forEach((_, field) => {
              // Get the position of the field to replace
              const position = parseInt(field.match(/\d+/)?.[0] || '1') - 1;
              
              if (uploadedProofIndex < uploadedProofs.length) {
                // Replace at the correct position
                proofUrls[position] = uploadedProofs[uploadedProofIndex];
                console.log(`[Tenant Form Submit] Replacing proof at position ${position}`);
                uploadedProofIndex++;
              }
            });
            
            // Add remaining new proofs to first available null slots
            // This preserves existing proofs while adding new ones
            while (uploadedProofIndex < uploadedProofs.length) {
              const nullIndex = proofUrls.findIndex((url) => url === null);
              if (nullIndex !== -1) {
                proofUrls[nullIndex] = uploadedProofs[uploadedProofIndex];
                console.log(`[Tenant Form Submit] Adding new proof to position ${nullIndex}`);
                uploadedProofIndex++;
              } else {
                console.warn('[Tenant Form Submit] No more empty proof slots available');
                break; // No more null slots available
              }
            }
            
            console.log('[Tenant Form Submit] Final photo URLs:', photoUrls);
            console.log('[Tenant Form Submit] Final proof URLs:', proofUrls);
          }
        } catch (uploadErr) {
          let errorMessage = 'File upload failed';
          
          // Handle response error with specific error details
          if (uploadErr && typeof uploadErr === 'object' && 'response' in uploadErr) {
            const axiosErr = uploadErr as any;
            if (axiosErr.response?.data?.error) {
              errorMessage = axiosErr.response.data.error;
            } else if (axiosErr.response?.status === 413) {
              errorMessage = 'File(s) are too large. Maximum 10MB per file.';
            } else if (axiosErr.response?.statusText) {
              errorMessage = axiosErr.response.statusText;
            }
          } else if (uploadErr instanceof Error) {
            errorMessage = uploadErr.message;
          }
          
          setError(`Upload failed: ${errorMessage}`);
          setLoading(false);
          return;
        }
      }

      // Create submit data with all 10 photo and proof URLs
      const submitData: Omit<TenantWithOccupancy, 'id'> = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        roomId: !tenant?.id && formData.roomId ? parseInt(formData.roomId) : undefined,
        roomIds: tenant?.id ? formData.roomIds.map((roomId) => parseInt(roomId, 10)).filter((roomId) => Number.isInteger(roomId) && roomId > 0) : undefined,
        checkInDate: formData.checkInDate || undefined,
        photoUrl: photoUrls[0],
        photo2Url: photoUrls[1],
        photo3Url: photoUrls[2],
        photo4Url: photoUrls[3],
        photo5Url: photoUrls[4],
        photo6Url: photoUrls[5],
        photo7Url: photoUrls[6],
        photo8Url: photoUrls[7],
        photo9Url: photoUrls[8],
        photo10Url: photoUrls[9],
        proof1Url: proofUrls[0],
        proof2Url: proofUrls[1],
        proof3Url: proofUrls[2],
        proof4Url: proofUrls[3],
        proof5Url: proofUrls[4],
        proof6Url: proofUrls[5],
        proof7Url: proofUrls[6],
        proof8Url: proofUrls[7],
        proof9Url: proofUrls[8],
        proof10Url: proofUrls[9],
      };

      // console.log(`[Tenant ${tenant ? 'Update' : 'Creation'}] Submitting data:`, submitData);
      await onSubmit(submitData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save tenant';
      setError(errorMsg);
      console.error('[Tenant Form] Error:', err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="tenant-form">
      {error && <div className="form-error">{error}</div>}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <span className="progress-text">
            <span>📸 Uploading photos & proofs...</span>
            <span>{uploadProgress}%</span>
          </span>
        </div>
      )}

      {/* Basic Information */}
      <div className="form-section">
        <h3>Basic Information</h3>

        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter tenant name"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">
            Phone Number *
            {isCheckingPhone && (
              <span className="validation-loading" title="Checking database...">
                ⟳
              </span>
            )}
            {!isCheckingPhone && formData.phone.trim() && !phoneError && (
              <span className="validation-success" title="Phone number is valid and available">
                ✓
              </span>
            )}
          </label>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Enter phone number (exactly 10 digits)"
            disabled={loading}
            required
            className={phoneError ? 'input-error' : formData.phone.trim() && !isCheckingPhone && !phoneError ? 'input-success' : ''}
          />
          {phoneError && (
            <div className="validation-error-message">
              ✗ {phoneError}
            </div>
          )}
          {isCheckingPhone && (
            <div className="validation-checking-message">
              Checking phone number...
            </div>
          )}
          {!phoneError && formData.phone.trim() && !isCheckingPhone && (
            <div className="validation-success-message">
              ✓ Phone number is valid and available
            </div>
          )}
        </div>

            <div className="form-row">
              <div className="form-group city-autocomplete-container" onClick={handleClickOutside}>
                <label htmlFor="city">
                  City *
                  {isSearchingCities && (
                    <span className="validation-loading" title="Searching cities...">
                      ⟳
                    </span>
                  )}
                </label>
                <input
                  id="city"
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  onFocus={() => formData.city && setShowCitySuggestions(true)}
                  placeholder="Start typing to search cities..."
                  disabled={loading}
                  required
                  autoComplete="off"
                />
                {showCitySuggestions && citySuggestions.length > 0 && (
                  <div className="city-suggestions" ref={citySuggestionsRef}>
                    {citySuggestions.map((city, index) => (
                      <div
                        key={index}
                        className="city-suggestion-item"
                        onClick={() => handleSelectCity(city)}
                      >
                        {city}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="address">Address *</label>
                <input
                  id="address"
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Enter address"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Occupancy Fields - Shown for both new and existing tenants */}
            <>
              <div className="form-group">
                <label htmlFor="roomId">Room {!tenant?.id && '(Optional - leave blank to add tenant without occupancy)'}</label>
                {tenant?.id ? (
                  <>
                    <select
                      id="roomId"
                      name="roomIds"
                      multiple
                      value={formData.roomIds}
                      onChange={handleMultiRoomSelectChange}
                      disabled={loading || isLoadingRooms || vacantRooms.length === 0}
                    >
                      {vacantRooms.map((room) => {
                        let ageInfo = '';
                        if (room.daysVacant !== null && room.daysVacant !== undefined) {
                          const days = room.daysVacant;
                          if (days === 0) {
                            ageInfo = ' | Age: New';
                          } else if (days < 30) {
                            ageInfo = ` | Age: ${days}d`;
                          } else {
                            const months = Math.floor(days / 30);
                            const remainingDays = days % 30;
                            ageInfo = remainingDays > 0
                              ? ` | Age: ${months}m ${remainingDays}d`
                              : ` | Age: ${months}m`;
                          }
                        } else if (room.vacancyStatus === 'Never Occupied') {
                          ageInfo = ' | Age: New/Never Occupied';
                        } else if (room.vacancyStatus === 'Currently Occupied') {
                          ageInfo = ' | Status: Currently Occupied (Current Assignment)';
                        }

                        const tooltipText = room.lastTenantName
                          ? `Last tenant: ${room.lastTenantName} (${room.lastTenantPhone || 'N/A'}) | Checked out: ${room.lastCheckOutDate || 'N/A'} | Vacant for ${room.daysVacant || 0} days | Status: ${room.vacancyStatus}`
                          : 'This room has never been occupied';
                        return (
                          <option key={room.id} value={room.id} title={tooltipText}>
                            Room {room.number} - ₹{room.rent} ({room.beds} bed{room.beds !== 1 ? 's' : ''}){ageInfo}
                          </option>
                        );
                      })}
                    </select>
                    <p className="field-hint">Hold Ctrl (or Cmd on Mac) to select multiple rooms.</p>
                  </>
                ) : (
                  <select
                    id="roomId"
                    name="roomId"
                    value={formData.roomId}
                    onChange={handleSelectChange}
                    disabled={loading || isLoadingRooms || vacantRooms.length === 0}
                  >
                    <option value="">
                      {isLoadingRooms ? 'Loading rooms...' : vacantRooms.length === 0 ? 'No vacant rooms available' : 'Select a room (Optional)'}
                    </option>
                    {vacantRooms.map((room) => {
                      let ageInfo = '';
                      if (room.daysVacant !== null && room.daysVacant !== undefined) {
                        const days = room.daysVacant;
                        if (days === 0) {
                          ageInfo = ' | Age: New';
                        } else if (days < 30) {
                          ageInfo = ` | Age: ${days}d`;
                        } else {
                          const months = Math.floor(days / 30);
                          const remainingDays = days % 30;
                          ageInfo = remainingDays > 0
                            ? ` | Age: ${months}m ${remainingDays}d`
                            : ` | Age: ${months}m`;
                        }
                      } else if (room.vacancyStatus === 'Never Occupied') {
                        ageInfo = ' | Age: New/Never Occupied';
                      } else if (room.vacancyStatus === 'Currently Occupied') {
                        ageInfo = ' | Status: Currently Occupied (Current Assignment)';
                      }

                      const tooltipText = room.lastTenantName
                        ? `Last tenant: ${room.lastTenantName} (${room.lastTenantPhone || 'N/A'}) | Checked out: ${room.lastCheckOutDate || 'N/A'} | Vacant for ${room.daysVacant || 0} days | Status: ${room.vacancyStatus}`
                        : 'This room has never been occupied';
                      return (
                        <option key={room.id} value={room.id} title={tooltipText}>
                          Room {room.number} - ₹{room.rent} ({room.beds} bed{room.beds !== 1 ? 's' : ''}){ageInfo}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {((tenant?.id && formData.roomIds.length > 0) || (!tenant?.id && formData.roomId)) && (
                <div className="form-group">
                  <label htmlFor="checkInDate">Check-in Date {!tenant?.id && '*'}</label>
                  <input
                    id="checkInDate"
                    type="date"
                    name="checkInDate"
                    value={formData.checkInDate}
                    onChange={handleInputChange}
                    disabled={loading}
                    required={!tenant?.id}
                  />
                  {tenant?.id && <p className="field-hint">Required when assigning selected room(s) to this tenant.</p>}
                </div>
              )}
            </>
          </div>

          {/* Photo Upload Section */}
          <div className="form-section">
            <div className="section-header">
              <h3>Tenant Photos {tenant && '(Click to update)'}</h3>
              <span className="count-badge">{photos.length + replacementPhotos.size + (existingPhotos.length - deletedPhotoFields.size)} / {MAX_PHOTOS}</span>
            </div>

            {/* Display Existing Photos */}
            {existingPhotos.length > 0 && (
              <div className="edit-media-section">
                <h4>Current Photos</h4>
                <div className="edit-media-grid">
                  {existingPhotos
                    .filter((photo) => !deletedPhotoFields.has(photo.field))
                    .map((photo) => (
                      <div key={photo.field} className="edit-media-item">
                        {replacementPhotos.has(photo.field) ? (
                          <>
                            <img
                              src={replacementPhotos.get(photo.field)?.preview}
                              alt={`Replacement ${photo.field}`}
                              className="edit-media-thumbnail replacement-preview"
                            />
                            <div className="replacement-badge">New</div>
                          </>
                        ) : (
                          <img
                            src={getFileUrl(photo.url)}
                            alt={photo.field}
                            className="edit-media-thumbnail"
                          />
                        )}
                        <div className="edit-media-actions">
                          {replacementPhotos.has(photo.field) ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => cancelReplacePhoto(photo.field)}
                              disabled={loading}
                              title="Cancel replacement"
                            >
                              ✕ Cancel
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn-info"
                                onClick={() => startReplacingPhoto(photo.field)}
                                disabled={loading}
                                title="Replace photo"
                              >
                                🔄 Replace
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => removeExistingPhoto(photo.field)}
                                disabled={loading}
                                title="Delete photo"
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            <div className="file-upload-area">
              <div
                className="upload-placeholder"
                onClick={() => photoInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="upload-icon">📸</div>
                <p>Click to {tenant && photos.length === 0 ? 'add or update' : 'upload'} photos (up to {MAX_PHOTOS})</p>
                <span className="upload-hint">PNG, JPG, GIF up to 10MB each</span>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotosChange}
                className="file-input"
                disabled={loading || (photos.length + replacementPhotos.size + (existingPhotos.length - deletedPhotoFields.size)) >= MAX_PHOTOS}
                multiple
              />
            </div>

            {photos.length > 0 && (
              <div className="file-gallery">
                <h4>New Photos to Add</h4>
                {photos.map((photo, index) => (
                  <div key={index} className="gallery-item">
                    <img src={photo.preview} alt={`Photo ${index + 1}`} />
                    <div className="file-name" title={photo.name}>{photo.name}</div>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={() => removePhoto(index)}
                      disabled={loading}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden input for photo replacement */}
            <input
              ref={replacePhotoInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplacePhotoChange}
              className="file-input"
              hidden
            />
          </div>

          {/* Proof Upload Section */}
          <div className="form-section">
            <div className="section-header">
              <h3>Proof Documents {tenant && '(Click to update)'}</h3>
              <span className="count-badge">{proofs.length + replacementProofs.size + (existingProofs.length - deletedProofFields.size)} / {MAX_PROOFS}</span>
            </div>

            {/* Display Existing Proofs */}
            {existingProofs.length > 0 && (
              <div className="edit-media-section">
                <h4>Current Proofs</h4>
                <div className="edit-media-grid">
                  {existingProofs
                    .filter((proof) => !deletedProofFields.has(proof.field))
                    .map((proof) => (
                      <div key={proof.field} className="edit-media-item">
                        {replacementProofs.has(proof.field) ? (
                          <>
                            <img
                              src={replacementProofs.get(proof.field)?.preview}
                              alt={`Replacement ${proof.field}`}
                              className="edit-media-thumbnail replacement-preview"
                            />
                            <div className="replacement-badge">New</div>
                          </>
                        ) : (
                          <img
                            src={getFileUrl(proof.url)}
                            alt={proof.field}
                            className="edit-media-thumbnail"
                          />
                        )}
                        <div className="edit-media-actions">
                          {replacementProofs.has(proof.field) ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => cancelReplaceProof(proof.field)}
                              disabled={loading}
                              title="Cancel replacement"
                            >
                              ✕ Cancel
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn-info"
                                onClick={() => startReplacingProof(proof.field)}
                                disabled={loading}
                                title="Replace proof"
                              >
                                🔄 Replace
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => removeExistingProof(proof.field)}
                                disabled={loading}
                                title="Delete proof"
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="file-upload-area">
              <div
                className="upload-placeholder"
                onClick={() => proofInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="upload-icon">📄</div>
                <p>Click to {tenant && proofs.length === 0 ? 'add or update' : 'upload'} proof documents (up to {MAX_PROOFS})</p>
                <span className="upload-hint">PNG, JPG, GIF up to 10MB each</span>
              </div>
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*"
                onChange={handleProofsChange}
                className="file-input"
                disabled={loading || (proofs.length + replacementProofs.size + (existingProofs.length - deletedProofFields.size)) >= MAX_PROOFS}
                multiple
              />
            </div>

            {proofs.length > 0 && (
              <div className="file-gallery">
                <h4>New Proofs to Add</h4>
                {proofs.map((proof, index) => (
                  <div key={index} className="gallery-item">
                    <img src={proof.preview} alt={`Proof ${index + 1}`} />
                    <div className="file-name" title={proof.name}>{proof.name}</div>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={() => removeProof(index)}
                      disabled={loading}
                      title="Remove proof"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden input for proof replacement */}
            <input
              ref={replaceProofInputRef}
              type="file"
              accept="image/*"
              onChange={handleReplaceProofChange}
              className="file-input"
              hidden
            />
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading
                ? `Saving... ${uploadProgress > 0 ? uploadProgress + '%' : ''}`
                : tenant
                ? 'Update Tenant'
                : 'Create Tenant'}
            </button>
          </div>
        </form>
  );

  // Render form in card mode or as modal
  if (cardMode) {
    return formContent;
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tenant ? 'Edit Tenant' : 'Add New Tenant'}</h2>
          <button className="btn-close" onClick={onCancel} disabled={loading}>
            ✕
          </button>
        </div>
        {formContent}
      </div>
    </div>
  );
}
