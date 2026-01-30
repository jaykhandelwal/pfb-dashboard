
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Camera, CheckCircle2, UserCheck, MapPin, Loader2, X, RotateCcw, AlertTriangle, UploadCloud, Bug } from 'lucide-react';
import { uploadImageToBunny, deleteImageFromBunny } from '../services/bunnyStorage';
import { getLocalISOString } from '../constants';

const Attendance: React.FC = () => {
   const { branches, addAttendance, attendanceRecords, appSettings } = useStore();
   const { currentUser, updateUser } = useAuth();

   const [branchId, setBranchId] = useState<string>('');
   const [capturedImage, setCapturedImage] = useState<string | null>(null); // Current captured but not uploaded
   const [collectedImages, setCollectedImages] = useState<string[]>([]); // Uploaded URLs
   const [currentStageIndex, setCurrentStageIndex] = useState(0);

   const [isCameraOpen, setIsCameraOpen] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isUploading, setIsUploading] = useState(false);
   const [successMsg, setSuccessMsg] = useState('');
   const [errorMsg, setErrorMsg] = useState('');
   const [warningMsg, setWarningMsg] = useState('');
   const [isDeleting, setIsDeleting] = useState(false);
   const [debugInfo, setDebugInfo] = useState<{ payload: any; responseStatus?: number; error?: string } | null>(null);

   const videoRef = useRef<HTMLVideoElement>(null);
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const [stream, setStream] = useState<MediaStream | null>(null);

   // Staged Attendance Config for Current User
   const isStaged = currentUser?.isStagedAttendanceEnabled && currentUser?.stagedAttendanceConfig && currentUser.stagedAttendanceConfig.length > 0;
   const stages = isStaged ? currentUser.stagedAttendanceConfig! : [];
   const currentStage = isStaged ? stages[currentStageIndex] : null;

   // Initialize Branch ID based on User Default
   useEffect(() => {
      if (currentUser?.defaultBranchId && branches.some(b => b.id === currentUser.defaultBranchId)) {
         setBranchId(currentUser.defaultBranchId);
      } else if (branches.length > 0) {
         setBranchId(branches[0].id);
      }
   }, [currentUser, branches]);

   // --- DEBUG SETTINGS OVERLAY ---
   // Temporary debug aid
   if (appSettings.enable_attendance_webhook_debug) {
      console.log("Attendance Render Settings:", appSettings);
   }

   // Check if already checked in today
   const today = getLocalISOString();
   const todayRecord = attendanceRecords.find(r => r.userId === currentUser?.id && r.date === today);

   // --- RESTORE PROGRESS & MISSING CHECK ---
   useEffect(() => {
      if (!currentUser) return;

      // 1. Restore Progress
      // Only update if the remote state is "ahead" or different to avoid overwriting active state with stale data during updates
      if (currentUser.stagedAttendanceProgress && currentUser.stagedAttendanceProgress.date === today) {
         const remoteProgress = currentUser.stagedAttendanceProgress;

         setCollectedImages(prev => {
            // Trust remote if it has more images
            if (remoteProgress.collectedImages && remoteProgress.collectedImages.length > prev.length) {
               return remoteProgress.collectedImages;
            }
            // If lengths are same but content differs, trust remote (sync), BUT
            // usually local is ahead. Let's just iterate and ensure we don't define holes?
            // Safer: If remote has images, and we have empty/fewer, take remote.
            // If we have equal/more, keep ours (assuming we just uploaded and remote is catching up)
            return prev.length === 0 ? (remoteProgress.collectedImages || []) : prev;
         });

         setCurrentStageIndex(prev => {
            const remoteIndex = remoteProgress.currentStageIndex || 0;
            // Only advance if remote is ahead (e.g. continuing elsewhere), 
            // NEVER regress (which happens if currentUser is stale during an update cycle)
            return remoteIndex > prev ? remoteIndex : prev;
         });
      }

      // 2. Check Missing Attendance (Yesterday)
      // Simple check: if yesterday exists in calendar and no record found
      const checkMissing = async () => {
         const d = new Date();
         d.setDate(d.getDate() - 1);
         const yesterday = d.toISOString().slice(0, 10);

         const yesterdayRecord = attendanceRecords.find(r => r.userId === currentUser.id && r.date === yesterday);

         if (!yesterdayRecord) {
            setWarningMsg(`You did not record attendance for yesterday (${yesterday}).`);
         }
      };

      if (!todayRecord) {
         checkMissing();
      }

   }, [currentUser, attendanceRecords, todayRecord]);

   // Camera Functions
   const startCamera = async () => {
      try {
         setErrorMsg('');
         let mediaStream: MediaStream;

         // Determine facing mode: 'user' (front) or 'environment' (back)
         // Default to 'user' for unstaged or if not specified
         const facingMode = currentStage?.cameraFacingMode || 'user';

         try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
               video: { facingMode }
            });
         } catch (e) {
            console.warn(`Camera request for ${facingMode} failed, trying fallback`, e);
            // Fallback to any video device
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
         }

         setStream(mediaStream);
         setIsCameraOpen(true);
         setTimeout(() => {
            if (videoRef.current) {
               videoRef.current.srcObject = mediaStream;
            }
         }, 100);
      } catch (err) {
         console.error("Camera Error:", err);
         setErrorMsg("Could not access camera. Please allow camera permissions.");
      }
   };

   const stopCamera = () => {
      if (stream) {
         stream.getTracks().forEach(track => track.stop());
         setStream(null);
      }
      setIsCameraOpen(false);
   };

   const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
         const video = videoRef.current;
         const canvas = canvasRef.current;

         canvas.width = video.videoWidth;
         canvas.height = video.videoHeight;

         const context = canvas.getContext('2d');
         if (context) {
            // Mirror only if using front camera (implied by 'user' mode or default)
            const isFrontCamera = !currentStage || currentStage.cameraFacingMode === 'user';

            if (isFrontCamera) {
               context.translate(canvas.width, 0);
               context.scale(-1, 1);
            }

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            setCapturedImage(dataUrl);
            stopCamera();
         }
      }
   };

   useEffect(() => {
      return () => {
         if (stream) {
            stream.getTracks().forEach(track => track.stop());
         }
      };
   }, [stream]);

   const handleUpload = async () => {
      if (!capturedImage || !currentUser) return;

      setIsUploading(true);
      try {
         // Upload immediately
         const folder = `attendance/${currentUser.id}/${today}/${currentStageIndex}`;
         const uploadedUrl = await uploadImageToBunny(capturedImage, folder);

         // --- WEBHOOK CALL START ---
         const globalWebhookEnabled = appSettings.enable_attendance_webhook;
         const globalWebhookUrl = appSettings.attendance_webhook_url;

         console.log('WEBHOOK DEBUG:', { globalWebhookEnabled, globalWebhookUrl, isStaged, currentStage });

         const shouldSendToWebhook = globalWebhookEnabled && globalWebhookUrl && (
            isStaged ? currentStage?.sendToWebhook : true
         );

         const payload = {
            image_url: uploadedUrl,
            branch: branches.find(b => b.id === branchId)?.name || 'Unknown',
            user_name: currentUser.name,
            stage_name: isStaged ? currentStage?.title : 'Attendance Check-in',
            user_id: currentUser.id,
            timestamp: new Date().toISOString()
         };

         if (shouldSendToWebhook) {

            // Debug UI Trigger (Sending)
            if (appSettings.enable_attendance_webhook_debug) {
               setDebugInfo({ payload, responseStatus: undefined });
            }

            try {
               console.log('WEBHOOK: Sending payload...', payload);
               const response = await fetch(globalWebhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
               });
               console.log('WEBHOOK: Response status:', response.status);

               if (appSettings.enable_attendance_webhook_debug) {
                  setDebugInfo(prev => prev ? { ...prev, responseStatus: response.status } : null);
               }
            } catch (webhookErr: any) {
               console.error("Webhook failed:", webhookErr);
               if (appSettings.enable_attendance_webhook_debug) {
                  setDebugInfo(prev => prev ? { ...prev, error: webhookErr?.message || 'Unknown Error' } : null);
               }
            }
         } else if (appSettings.enable_attendance_webhook_debug) {
            // Debug UI Trigger (Skipped)
            let skipReason = "Unknown";
            if (!globalWebhookEnabled) skipReason = "Global Webhook Disabled";
            else if (!globalWebhookUrl) skipReason = "No Webhook URL";
            else if (isStaged && !currentStage?.sendToWebhook) skipReason = "Stage Config Disabled";

            setDebugInfo({
               payload: { ...payload, _status: "SKIPPED", _reason: skipReason },
               error: `Skipped: ${skipReason}`
            });
         }
         // --- WEBHOOK CALL END ---

         const newImages = [...collectedImages];
         newImages[currentStageIndex] = uploadedUrl; // Place at specific index
         setCollectedImages(newImages);
         setCapturedImage(null); // Clear capture to show "Next" or "Uploaded" state

         // Save Progress to User Profile
         await updateUser({
            ...currentUser,
            stagedAttendanceProgress: {
               date: today,
               currentStageIndex: currentStageIndex, // Still on this stage until they click "Next"
               collectedImages: newImages
            }
         });

      } catch (e) {
         console.error("Upload Error", e);
         setErrorMsg("Failed to upload image. Please try again.");
      } finally {
         setIsUploading(false);
      }
   };

   const handleStageNext = async () => {
      // Advance stage
      if (currentStageIndex < stages.length - 1) {
         const nextIndex = currentStageIndex + 1;
         setCurrentStageIndex(nextIndex);

         // Update progress index
         if (currentUser) {
            await updateUser({
               ...currentUser,
               stagedAttendanceProgress: {
                  date: today,
                  currentStageIndex: nextIndex,
                  collectedImages: collectedImages
               }
            });
         }
      } else {
         // Final submit
         submitAttendance(collectedImages);
      }
   };

   const handleRetake = () => {
      setCapturedImage(null);
   };

   const handleSubmitUnstaged = () => {
      if (!capturedImage) {
         setErrorMsg("Please take a photo.");
         return;
      }
      submitAttendance([capturedImage]);
   };

   const submitAttendance = async (imagesToSubmit: string[]) => {
      if (!currentUser) return;
      setIsSubmitting(true);
      console.log('Submitting Attendance with Images:', imagesToSubmit);

      try {
         let uploadedUrls: string[] = [];

         if (isStaged) {
            // For staged, images are already uploaded one by one
            uploadedUrls = imagesToSubmit;
         } else {
            // For unstaged, upload now
            const uploadPromises = imagesToSubmit.map((img, idx) =>
               uploadImageToBunny(img, `attendance/${currentUser.id}/${today}/${idx}`)
            );
            uploadedUrls = await Promise.all(uploadPromises);
         }

         await addAttendance({
            userId: currentUser.id,
            userName: currentUser.name,
            branchId,
            date: today,
            timestamp: Date.now(),
            imageUrl: uploadedUrls[0], // Primary image for backward compatibility
            imageUrls: uploadedUrls
         });

         setSuccessMsg(`Checked in successfully at ${new Date().toLocaleTimeString()}!`);
         setCapturedImage(null);
         setCollectedImages([]);
         setCurrentStageIndex(0);

         // Clear progress from User Profile
         await updateUser({
            ...currentUser,
            stagedAttendanceProgress: undefined
         });

      } catch (e) {
         console.error("Attendance Submit Error", e);
         setErrorMsg("Failed to submit attendance. Please try again.");
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleDeleteImage = async () => {
      if (!currentUser || (!capturedImage && !collectedImages[currentStageIndex])) return;

      const imageToDelete = collectedImages[currentStageIndex];
      // simplified check: if we are in staged mode and have an image at current index, delete it.

      if (!imageToDelete) return;

      if (!window.confirm("Are you sure you want to delete this image? You will need to take a new photo.")) {
         return;
      }

      setIsDeleting(true);
      try {
         // 1. Delete from BunnyCDN
         const success = await deleteImageFromBunny(imageToDelete);

         if (success) {
            // 2. Update local state
            const newImages = [...collectedImages];
            delete newImages[currentStageIndex];

            setCollectedImages(newImages);
            setCapturedImage(null); // Ensure camera view comes back

            // 3. Update User Profile to persist the deletion
            await updateUser({
               ...currentUser,
               stagedAttendanceProgress: {
                  date: today,
                  currentStageIndex: currentStageIndex,
                  collectedImages: newImages
               }
            });

            setSuccessMsg("Image deleted successfully.");
            setTimeout(() => setSuccessMsg(''), 3000);
         } else {
            setErrorMsg("Failed to delete image. Please try again.");
         }

      } catch (e) {
         console.error("Delete Error", e);
         setErrorMsg("An error occurred while deleting.");
      } finally {
         setIsDeleting(false);
      }
   };


   if (todayRecord) {
      return (
         <div className="max-w-md mx-auto pt-10 px-4 text-center">
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-8">
               <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <CheckCircle2 size={40} />
               </div>
               <h2 className="text-2xl font-bold text-slate-800 mb-2">You're Checked In!</h2>
               <p className="text-slate-500 mb-6">Attendance recorded for today.</p>

               <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-3">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                     <span className="text-slate-500">Date</span>
                     <span className="font-bold text-slate-700">{todayRecord.date}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                     <span className="text-slate-500">Time</span>
                     <span className="font-bold text-slate-700">{new Date(todayRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-500">Branch</span>
                     <span className="font-bold text-slate-700">
                        {branches.find(b => b.id === todayRecord.branchId)?.name || 'Unknown'}
                     </span>
                  </div>
               </div>
            </div>
         </div>
      )
   }

   // --- RENDER ---

   return (
      <div className="max-w-md mx-auto pb-20">
         <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <UserCheck className="text-indigo-600" /> Staff Attendance
            </h2>
            <p className="text-slate-500">Verify your location and check in.</p>

            {appSettings.enable_attendance_webhook_debug && (
               <div className="mt-2 p-2 bg-slate-800 text-green-400 text-xs font-mono rounded overflow-hidden break-all">
                  <strong>DEBUG MODE:</strong> Settings Loaded<br />
                  Webhook Enabled: {appSettings.enable_attendance_webhook ? 'YES' : 'NO'}<br />
                  Webhook URL: {appSettings.attendance_webhook_url || '(Empty)'}<br />
                  Is Staged: {isStaged ? 'YES' : 'NO'}<br />
                  Current Stage: {currentStage ? `${currentStage.title} (Send: ${currentStage.sendToWebhook})` : 'N/A'}
               </div>
            )}
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Branch Selection (Only show on first stage if staged) */}
            {(!isStaged || currentStageIndex === 0) && (
               <div className="p-5 border-b border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                     <MapPin size={12} /> Select Location
                  </label>
                  <select
                     value={branchId}
                     onChange={(e) => setBranchId(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                     {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                     ))}
                  </select>
               </div>
            )}

            {/* Staged Progress Indicator - Visual Slots */}
            {isStaged && (
               <div className="px-5 pt-5 pb-0">
                  <div className="flex gap-2 mb-4 justify-center">
                     {stages.map((stage, idx) => {
                        const isCompleted = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;
                        const isPending = idx > currentStageIndex;

                        return (
                           <div
                              key={stage.id}
                              className={`relative flex-1 aspect-[3/4] max-w-[80px] rounded-lg border-2 overflow-hidden transition-all duration-300 ${isCurrent
                                 ? 'border-indigo-500 ring-2 ring-indigo-200 ring-offset-2 scale-105 z-10'
                                 : isCompleted
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 bg-slate-50 opacity-60'
                                 }`}
                           >
                              {isCompleted && collectedImages[idx] ? (
                                 <div className="w-full h-full relative">
                                    <img src={collectedImages[idx]} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                       <div className="bg-emerald-500 text-white rounded-full p-0.5">
                                          <CheckCircle2 size={12} strokeWidth={3} />
                                       </div>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                    <Camera size={20} className={isCurrent ? 'text-indigo-400 animate-pulse' : ''} />
                                    <span className="text-[10px] font-bold mt-1">{idx + 1}</span>
                                 </div>
                              )}

                              {/* Connector Line */}
                              {idx < stages.length - 1 && (
                                 <div className="absolute top-1/2 -right-3 w-4 h-0.5 bg-slate-200 -z-10 hidden" />
                              )}
                           </div>
                        );
                     })}
                  </div>

                  <div className="text-center mb-2">
                     <h3 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
                        {currentStage?.title}
                        <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
                           {currentStageIndex + 1}/{stages.length}
                        </span>
                     </h3>
                     <p className="text-xs text-slate-500 animate-pulse">
                        {currentStageIndex < stages.length - 1 ? 'More photos required to submit' : 'Final photo'}
                     </p>
                  </div>
               </div>
            )}

            {/* Debug Info Modal */}
            {debugInfo && (
               <div className="mx-5 mb-4 bg-slate-800 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-hidden">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                     <span className="font-bold flex items-center gap-2">
                        <Bug size={14} className="text-yellow-400" /> Webhook Debug
                     </span>
                     <button onClick={() => setDebugInfo(null)} className="text-slate-400 hover:text-white">
                        <X size={14} />
                     </button>
                  </div>
                  <div className="space-y-2">
                     <div>
                        <span className="text-slate-500">Payload:</span>
                        <pre className="mt-1 bg-slate-900 p-2 rounded overflow-x-auto">
                           {JSON.stringify(debugInfo.payload, null, 2)}
                        </pre>
                     </div>
                     <div className="flex gap-4">
                        <div>
                           <span className="text-slate-500">Status:</span>
                           <span className={`ml-2 font-bold ${debugInfo.responseStatus === 200 ? 'text-green-400' : 'text-orange-400'}`}>
                              {debugInfo.responseStatus !== undefined ? debugInfo.responseStatus : 'Sending...'}
                           </span>
                        </div>
                        {debugInfo.error && (
                           <div>
                              <span className="text-slate-500">Error:</span>
                              <span className="ml-2 text-red-400">{debugInfo.error}</span>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {/* Warning Message */}
            {warningMsg && (
               <div className="mx-5 mb-4 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <div>
                     <h4 className="font-bold text-amber-700 text-sm">Action Required</h4>
                     <p className="text-amber-600 text-xs mt-1">{warningMsg}</p>
                  </div>
               </div>
            )}

            {/* Camera Section */}
            <div className="p-5 flex flex-col items-center">
               <canvas ref={canvasRef} className="hidden" />

               {!isCameraOpen && !capturedImage && (
                  <div className="w-full">
                     {/* ... Header ... */}
                     <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                           <Camera size={12} /> Camera Verification
                        </span>
                        {!isStaged && (
                           <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100 uppercase tracking-wider">
                              Photo Mandatory
                           </span>
                        )}
                     </div>

                     {/* Explicit "Next Step" button when image is already uploaded for this stage */}
                     {isStaged && collectedImages[currentStageIndex] ? (
                        <div className="w-full mb-4">
                           <div className="relative aspect-video bg-emerald-50 rounded-xl overflow-hidden border border-emerald-100 flex flex-col items-center justify-center mb-4 group">
                              <img src={collectedImages[currentStageIndex]} alt="Uploaded" className="w-full h-full object-cover opacity-50" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                 <div className="bg-white/90 p-3 rounded-full shadow-sm mb-2">
                                    <CheckCircle2 className="text-emerald-600" size={32} />
                                 </div>
                                 <span className="font-bold text-emerald-800">Image Uploaded</span>
                              </div>

                              {/* Delete Overlay */}
                              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button
                                    onClick={handleDeleteImage}
                                    disabled={isDeleting}
                                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all"
                                 >
                                    {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <RotateCcw size={20} />}
                                    {isDeleting ? "Deleting..." : "Delete & Retake"}
                                 </button>
                              </div>
                           </div>


                           <button
                              onClick={handleStageNext}
                              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                           >
                              {currentStageIndex === stages.length - 1 ? (
                                 <>Finish & Submit Attendance <CheckCircle2 size={20} /></>
                              ) : (
                                 <>Next Step <CheckCircle2 size={20} /></>
                              )}
                           </button>

                           <div className="mt-3 text-center md:hidden">
                              <button
                                 onClick={handleDeleteImage}
                                 disabled={isDeleting}
                                 className="text-red-500 text-sm font-medium flex items-center justify-center gap-1 mx-auto py-2"
                              >
                                 {isDeleting ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                                 Tap to Delete & Retake
                              </button>
                           </div>

                        </div>
                     ) : (
                        <>
                           <button
                              onClick={startCamera}
                              className="w-full aspect-square md:aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group mb-4"
                           >
                              <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                 <Camera size={32} />
                              </div>
                              <span className="font-bold text-sm">Tap to Take Photo</span>
                           </button>

                           {/* Placeholder Disabled Button only if not staged or purely initial state */}
                           {!isStaged && (
                              <button
                                 disabled={true}
                                 className="w-full py-3.5 bg-slate-100 text-slate-400 rounded-xl font-bold border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                 <CheckCircle2 size={20} />
                                 Take Photo to Check In
                              </button>
                           )}
                        </>
                     )}
                  </div>
               )}

               {isCameraOpen && (
                  <div className="relative w-full aspect-[3/4] md:aspect-video bg-black rounded-xl overflow-hidden shadow-lg flex flex-col">
                     <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover flex-1 ${currentStage?.cameraFacingMode !== 'environment' ? 'scale-x-[-1]' : ''}`}
                     />
                     <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <button
                           onClick={stopCamera}
                           className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold"
                        >
                           Cancel
                        </button>
                        <button
                           onClick={capturePhoto}
                           className="w-14 h-14 bg-white rounded-full border-4 border-slate-200 shadow-lg active:scale-95 transition-transform"
                        />
                     </div>
                  </div>
               )}

               {capturedImage && (
                  <div className="w-full">
                     <div className="relative aspect-[3/4] md:aspect-video bg-slate-100 rounded-xl overflow-hidden mb-4 border border-slate-200">
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                        <button
                           onClick={handleRetake}
                           className="absolute top-2 right-2 bg-slate-800/50 text-white p-2 rounded-full hover:bg-slate-800"
                        >
                           <RotateCcw size={16} />
                        </button>
                     </div>

                     {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-4 flex items-center justify-center gap-2">
                           <X size={16} /> {errorMsg}
                        </div>
                     )}

                     {/* Actions based on Staged vs Unstaged */}
                     {isStaged ? (
                        <button
                           onClick={handleUpload}
                           disabled={isUploading}
                           className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                           {isUploading ? (
                              <><Loader2 size={20} className="animate-spin" /> Uploading...</>
                           ) : (
                              <><UploadCloud size={20} /> Upload Photo</>
                           )}
                        </button>
                     ) : (
                        <button
                           onClick={handleSubmitUnstaged}
                           disabled={isSubmitting}
                           className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                           {isSubmitting ? (
                              <><Loader2 size={20} className="animate-spin" /> Checking In...</>
                           ) : (
                              <><CheckCircle2 size={20} /> Confirm Attendance</>
                           )}
                        </button>
                     )}
                  </div>
               )}
            </div>
         </div>

         {successMsg && (
            <div className="fixed bottom-4 left-4 right-4 z-50">
               <div className="bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-lg text-center font-bold animate-fade-in-up flex items-center justify-center gap-2">
                  <CheckCircle2 size={24} />
                  {successMsg}
               </div>
            </div>
         )}
      </div>
   );
};

export default Attendance;
