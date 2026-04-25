# Azure Fallback Deployment Checklist

## Pre-Deployment

- [ ] Backend code compiled successfully: `npm run build` (no errors)
- [ ] TypeScript compilation passes: `npx tsc --noEmit` (no errors)
- [ ] All dependencies installed: `npm install` (completed)
- [ ] `.env` file created/updated with `AZURE_BLOB_URL`
- [ ] Verified Azure blob URL is accessible: `curl https://complexstore.blob.core.windows.net/proofs/test.jpg`
- [ ] Local storage directory exists: `/tenantphotos/`
- [ ] Local storage has read permissions
- [ ] Test photos exist in Azure container

## Configuration

- [ ] `AZURE_BLOB_URL` set to: `https://complexstore.blob.core.windows.net/proofs`
- [ ] `.env` file saved in backend directory
- [ ] No hardcoded credentials in code (use env vars)
- [ ] Environment variables loaded before server starts

## Development Testing

- [ ] Backend starts without errors: `npm run dev`
- [ ] No TypeScript errors in console
- [ ] Logs show "✓ Azure Blob Storage initialized..." or "Azure Storage connection string not configured"
- [ ] Can access health endpoint: `curl http://localhost:5002/api/health`
- [ ] Can query tenant: `curl http://localhost:5002/api/tenants/1`

## Functional Testing

### Local Storage Path
- [ ] Test with photo in local storage: `GET /api/tenants/1/main-photo/azure`
- [ ] Response shows: `"source": "local"`
- [ ] Response time < 50ms
- [ ] Photo loads correctly in browser

### Azure Fallback Path
- [ ] Test with photo only in Azure: `GET /api/tenants/2/main-photo/azure`
- [ ] Response shows: `"source": "azure"`
- [ ] Response time < 1000ms
- [ ] Photo loads correctly in browser

### Error Cases
- [ ] Test missing photo: `GET /api/tenants/999/main-photo/azure`
- [ ] Returns 404 with clear error message
- [ ] Test invalid tenant: `GET /api/tenants/invalid/main-photo/azure`
- [ ] Returns appropriate error

### Format Variations
- [ ] Test with `?format=url` parameter
- [ ] Test without format parameter (blob streaming)
- [ ] Both return correct response type

### Header Testing
- [ ] Blob responses include `X-Photo-Source` header
- [ ] Header value is either `local` or `azure`
- [ ] Content-Type is `image/jpeg` for images

## Frontend Testing

- [ ] Frontend compiles: `npm run build` (in frontend directory)
- [ ] No TypeScript errors
- [ ] `TenantFullScreenView` component uses `useAzurePhotos={true}`
- [ ] Photos display correctly from both sources
- [ ] No console errors when loading photos
- [ ] Loading state shows briefly for Azure photos

## Integration Testing

- [ ] Full tenant detail page loads
- [ ] Fullscreen view displays main photo correctly
- [ ] Photo source indicator works (if implemented)
- [ ] All other photos/proofs still load correctly
- [ ] No breaking changes to existing functionality

## Performance Testing

- [ ] Local photo load time: < 100ms
- [ ] Azure photo load time: < 1500ms
- [ ] No memory leaks after repeated requests
- [ ] Multiple concurrent requests handled correctly
- [ ] Browser caching works for URL responses

## Docker Deployment

- [ ] Docker image builds: `docker build -t photo-app-backend .`
- [ ] Environment variables passed to container
- [ ] Volume mounted for local storage: `/app/tenantphotos`
- [ ] Container starts without errors
- [ ] Container can reach Azure endpoints
- [ ] Container logs show "✓" indicators

### docker-compose
- [ ] compose file includes `AZURE_BLOB_URL` in environment
- [ ] All services start: `docker-compose up -d`
- [ ] No connection errors in logs
- [ ] Frontend can reach backend
- [ ] Backend can reach Azure

## Staging Deployment

- [ ] Deploy to staging environment
- [ ] Test with real tenant data
- [ ] Monitor logs for errors
- [ ] Verify photos load from correct source
- [ ] Check for any 5xx errors
- [ ] Monitor database query performance

## Production Deployment

- [ ] Backup production database
- [ ] Deploy during low-traffic period
- [ ] Monitor error rates for first hour
- [ ] Check logs for "✓ Loaded photo from..." messages
- [ ] Verify users can view tenant photos
- [ ] Monitor Azure bandwidth costs
- [ ] Have rollback plan ready (revert code changes)

## Post-Deployment Verification

### Automated Checks
```bash
# Test endpoint from production
curl -I "https://api.example.com/api/tenants/1/main-photo/azure"

# Should return 200 status
# Should have X-Photo-Source header
```

### User Acceptance Testing
- [ ] Product team has verified photos display correctly
- [ ] No visual glitches or loading issues
- [ ] Performance is acceptable
- [ ] All tenant photos accessible

### Monitoring

- [ ] Enable application logging to monitor photo source distribution
- [ ] Set up alerts for 404 errors (missing photos)
- [ ] Monitor API response times
- [ ] Track Azure Blob access patterns
- [ ] Monitor bandwidth/cost

## Rollback Plan

If issues occur:

1. **Quick Rollback**
   ```bash
   git revert <commit-hash>
   npm run build
   npm start
   # Old code uses local storage only
   ```

2. **Database Revert**
   - No database changes made
   - Revert code only

3. **Monitoring During Rollback**
   - Check logs for errors
   - Verify photos load from local storage
   - Clear any browser caches if needed

## Documentation Updates

- [ ] Dev team trained on new fallback system
- [ ] Updated README with Azure setup steps
- [ ] Added troubleshooting guide to wiki
- [ ] Created incident response guide
- [ ] Updated deployment documentation

## Files Modified (for reference)

| File | Changes | Status |
|------|---------|--------|
| `backend/src/azureService.ts` | Created | ✓ |
| `backend/src/index.ts` | Updated endpoint | ✓ |
| `backend/.env` | Added `AZURE_BLOB_URL` | ✓ |
| `frontend/src/components/TenantFullScreenView.tsx` | Already compatible | ✓ |
| `frontend/src/api.ts` | Already compatible | ✓ |

## Testing Documentation

- [ ] Created: `AZURE_FALLBACK_QUICKSTART.md`
- [ ] Created: `AZURE_FALLBACK_IMPLEMENTATION.md`
- [ ] Created: `AZURE_FALLBACK_TESTING.md`
- [ ] Created: `IMPLEMENTATION_SUMMARY_AZURE_FALLBACK.md`
- [ ] Created: Deployment Checklist (this file)

## Final Sign-Off

- [ ] Code Review: Approved by _______________
- [ ] QA Testing: Passed by _______________
- [ ] Product: Approved by _______________
- [ ] Deployment: Executed by _______________
- [ ] Date Deployed: _____________
- [ ] Issues Found: None / See notes below

### Post-Deployment Notes

```
[Space for any issues or observations]

```

## Maintenance

### Weekly
- [ ] Check logs for unusual photo source distribution
- [ ] Verify no increase in 404 errors

### Monthly
- [ ] Review Azure bandwidth costs
- [ ] Check for stale local files to archive
- [ ] Test random photo access

### Quarterly
- [ ] Audit photo files in both locations
- [ ] Update documentation if needed
- [ ] Review performance metrics

## Related Documentation

- See `AZURE_FALLBACK_QUICKSTART.md` for quick setup
- See `AZURE_FALLBACK_IMPLEMENTATION.md` for technical details
- See `AZURE_FALLBACK_TESTING.md` for testing procedures
- See `IMPLEMENTATION_SUMMARY_AZURE_FALLBACK.md` for complete overview
- See `AZURE_BLOB_STORAGE_SETUP.md` for connection string setup
